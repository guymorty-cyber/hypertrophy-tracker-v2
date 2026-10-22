'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
const key='htData_v1';
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(){
  const h=boot(script),ex=h.app.data.program[0].exercises[0];
  const make=(id,weight,startedAt)=>({id,date:'2026-10-19',startedAt,finishedAt:startedAt+60000,durationSec:60,dayId:h.app.data.program[0].id,dayName:'Upper A',weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:0,after:1,nextMorning:null},exercises:[{exerciseId:ex.id,name:ex.name,notes:'',sets:[{weight,reps:10,completed:true},{weight:null,reps:null,completed:false}]}]});
  h.app.data.sessions=h.app.rebuildHistory([make('a',30,100),make('b',35,200),make('c',32,300)]);h.app.save();return h;
}
function edit(h,index=0){const original=h.app.data.sessions[index];return {sid:original.id,draft:clone(original),raw:JSON.stringify(original)};}
function save(h,e){return h.app.saveHistoryEdit(e.sid,e.draft,e.raw);}
test('Corrections persist date, notes and sets, recalculate totals and retain all unrelated data',()=>{
  const h=fixture();h.app.startSession(0);h.app.data.bodyweight=[{date:'2026-10-19',weight:73}];h.app.save();
  const active=JSON.stringify(h.app.data.activeSession),program=JSON.stringify(h.app.data.program),others=h.app.data.sessions.slice(1).map(s=>JSON.stringify(s.exercises));
  const e=edit(h);e.draft.date='2026-10-18';e.draft.notes='Corrected';e.draft.exercises[0].notes='Equipment setting 3';e.draft.exercises[0].sets[0].weight=31.25;e.draft.exercises[0].sets[0].reps=8;
  e.draft.id='forged';e.draft.dayName='forged';assert(save(h,e));
  const record=h.app.data.sessions[0];assert.equal(record.id,'a');assert.equal(record.dayName,'Upper A');assert.equal(record.totalVolume,250);assert.equal(record.totalReps,8);assert.equal(record.totalSets,1);
  assert.equal(record.startedAt,100);assert.equal(record.durationSec,60);assert.equal(JSON.stringify(h.app.data.activeSession),active);assert.equal(JSON.stringify(h.app.data.program),program);
  assert.deepEqual(h.app.data.sessions.slice(1).map(s=>JSON.stringify(s.exercises)),others);
  const r=boot(script,{[key]:h.records.get(key)});assert.equal(r.app.data.sessions[0].notes,'Corrected');assert.equal(r.app.data.bodyweight[0].weight,73);
});
test('Invalid dates, fractional reps, missing or negative completed loads and zero reps cannot corrupt history',()=>{
  const h=fixture(),before=h.records.get(key);
  for(const mutate of [d=>d.date='2026-02-30',d=>d.date='',d=>d.exercises[0].sets[0].reps=1.5,d=>d.exercises[0].sets[0].reps=0,d=>d.exercises[0].sets[0].weight=null,d=>d.exercises[0].sets[0].weight=-1]){
    const e=edit(h);mutate(e.draft);assert.equal(save(h,e),false);assert.equal(h.records.get(key),before);
  }
});
test('Bodyweight zero is valid and uncompleted entered values do not inflate totals',()=>{
  const h=fixture(),e=edit(h);e.draft.exercises[0].sets[0].weight=0;e.draft.exercises[0].sets[1]={weight:999,reps:999,completed:false};assert(save(h,e));assert.equal(h.app.data.sessions[0].totalVolume,0);assert.equal(h.app.data.sessions[0].totalSets,1);assert.equal(h.app.data.sessions[0].newPRs.length,0);
});
test('Historical edits require a completed set for training but allow zero-set rest records',()=>{
  const h=fixture(),e=edit(h);e.draft.exercises[0].sets[0].completed=false;assert.equal(save(h,e),false);
  h.app.data.sessions[0].exercises=[];h.app.save();const rest=edit(h);rest.draft.notes='Recovery walk';assert(save(h,rest));assert.equal(h.app.data.sessions[0].totalSets,0);
});
test('Quota failure and stale tabs retain the complete original history',()=>{
  const h=fixture(),e=edit(h),before=JSON.stringify(h.app.data);e.draft.notes='Correction';h.state.writeFailure=true;assert.equal(save(h,e),false);assert.equal(JSON.stringify(h.app.data),before);
  h.state.writeFailure=false;assert(save(h,e));
  const next=edit(h),newer=clone(h.app.data);newer.sessions[0].notes='Other tab';h.records.set(key,JSON.stringify(newer));next.draft.notes='Old tab';assert.equal(save(h,next),false);assert.equal(JSON.parse(h.records.get(key)).sessions[0].notes,'Other tab');
});
test('An outdated edit cannot resurrect a deleted workout or overwrite a newer correction',()=>{
  const h=fixture(),old=edit(h),newer=edit(h);newer.draft.notes='New correction';assert(save(h,newer));assert.equal(save(h,old),false);
  const deleted=edit(h);h.app.deleteWorkout(deleted.sid);assert.equal(save(h,deleted),false);assert.equal(h.app.data.sessions.length,2);
});
test('Editing a record moves later PR badges using exercise identity and variation',()=>{
  const h=fixture(),e=edit(h);assert.deepEqual(h.app.data.sessions.map(s=>s.newPRs.length),[1,1,0]);e.draft.exercises[0].sets[0].weight=40;assert(save(h,e));assert.deepEqual(h.app.data.sessions.map(s=>s.newPRs.length),[1,0,0]);
  h.app.data.sessions[1].exercises[0].name='Different variation';const result=h.app.rebuildHistory(h.app.data.sessions);assert.equal(result[1].newPRs.length,1);
});
test('Multiple deletions undo in reverse order and failed Undo remains retryable',()=>{
  const h=fixture();h.app.deleteWorkout('a');h.app.deleteWorkout('b');assert.deepEqual(h.app.data.sessions.map(s=>s.id),['c']);
  h.state.writeFailure=true;assert.equal(h.app.undoDeleteWorkout(),false);assert.equal(h.app.data.sessions.length,1);
  h.state.writeFailure=false;assert(h.app.undoDeleteWorkout());assert(h.app.undoDeleteWorkout());assert.deepEqual(h.app.data.sessions.map(s=>s.id),['a','b','c']);assert.equal(h.app.undoDeleteWorkout(),false);assert.deepEqual(h.app.data.sessions.map(s=>s.newPRs.length),[1,1,0]);
});
test('Failed deletion leaves earlier Undo available and never alters stored records',()=>{
  const h=fixture();h.app.deleteWorkout('a');const before=h.records.get(key);h.state.writeFailure=true;assert.equal(h.app.deleteWorkout('b'),false);assert.equal(h.records.get(key),before);h.state.writeFailure=false;h.app.undoDeleteWorkout();assert.equal(h.app.data.sessions[0].id,'a');
});
test('Editing a reminder date and deleting/undoing its workout retain valid references',()=>{
  const h=fixture();h.app.data.pendingNextMorning={sessionId:'a',dayName:'Upper A',date:'2026-10-19'};h.app.save();const e=edit(h);e.draft.date='2026-10-18';assert(save(h,e));assert.equal(h.app.data.pendingNextMorning.date,'2026-10-18');h.app.deleteWorkout('a');assert.equal(h.app.data.pendingNextMorning,null);h.app.undoDeleteWorkout();assert.equal(h.app.data.pendingNextMorning.date,'2026-10-18');
});
test('Search includes notes and dates, escapes input, and orders same-day records newest first',()=>{
  const h=fixture();h.app.data.sessions[0].notes='Unusual equipment';h.app.historyQuery=' unusual ';assert(h.app.renderHistory().includes('1 of 3 workouts'));h.app.historyQuery='2026-10-19';assert(h.app.renderHistory().includes('3 of 3 workouts'));
  h.app.historyQuery='';const html=h.app.renderHistory();assert(html.indexOf('data-sid="c"')<html.indexOf('data-sid="b"'));h.app.historyQuery='" onfocus="bad';assert(!h.app.renderHistory().includes('value="" onfocus='));
});
test('Removed programme exercises stay editable and sparse set numbers remain accurate',()=>{
  const h=fixture();h.app.data.program[0].exercises=[];h.app.data.sessions[0].exercises[0].sets.unshift({weight:null,reps:null,completed:false});h.app.save();const e=edit(h);e.draft.exercises[0].sets[1].weight=20;assert(save(h,e));h.app.openSessionDetail('a');assert(h.element('modalBody').innerHTML.includes('Set 2'));
});
test('JSON import round-trips corrections, replaces Undo state and recalculates derived totals',()=>{
  const h=fixture(),e=edit(h);e.draft.notes='Exported correction';assert(save(h,e));const exported=clone(h.app.data);exported.sessions[0].totalVolume=999999;
  h.app.deleteWorkout('a');h.app.importData({target:{files:[{content:JSON.stringify(exported)}],value:'backup.json'}});assert.equal(h.app.data.sessions[0].notes,'Exported correction');assert.equal(h.app.data.sessions[0].totalVolume,300);assert.equal(h.app.undoDeleteWorkout(),false);
});
console.log(count+' Phase 3 history checks passed');
