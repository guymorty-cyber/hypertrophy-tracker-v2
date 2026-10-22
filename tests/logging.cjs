'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
function setup(){const h=boot(script);h.app.startSession(0);return h;}
function log(h){return h.app.data.activeSession.exercises[0];}
function complete(h,i=0){const id=log(h).exerciseId;h.app.updateSetField(id,i,'weight',30);h.app.updateSetField(id,i,'reps',10);h.app.toggleSetComplete(id,i,true);}
function edit(h,overrides={}){
  const ex=h.app.data.program[0].exercises[0];h.app.openExerciseEditModal(0,ex.id);
  for(const [id,value] of Object.entries({fEditName:ex.name,fEditSets:ex.sets,fEditRepMin:ex.repMin,fEditRepMax:ex.repMax,fEditRest:ex.restSec,fEditInc:ex.inc,fEditNote:ex.note||'',...overrides}))h.element(id).value=String(value);
  h.element('fEditSave').onclick();
}
test('Programme edits preserve completed sets and active coaching settings, including after reopening',()=>{
  const h=setup();complete(h,2);const before=JSON.stringify(log(h)),id=log(h).exerciseId;
  edit(h,{fEditName:'Future press',fEditSets:1,fEditRest:0,fEditInc:0});
  assert.equal(JSON.stringify(log(h)),before);
  assert.equal(h.app.data.program[0].exercises[0].sets,1);
  assert.equal(h.app.data.program[0].exercises[0].inc,0);
  assert.equal(h.app.data.program[0].exercises[0].restSec,0);
  h.app.toggleSetComplete(id,2,false);h.app.toggleSetComplete(id,2,true);
  assert.equal(h.app.timer.remaining,log(h).definition.restSec);
  const r=boot(script,{'htData_v1':h.records.get('htData_v1')});
  assert.equal(r.app.data.activeSession.exercises[0].sets[2].completed,true);
  assert(r.app.renderActiveSession().includes('Incline Dumbbell Press'));
});
test('Failed programme edits leave the programme and workout unchanged',()=>{
  const h=setup(),before=JSON.stringify(h.app.data);h.state.writeFailure=true;edit(h,{fEditName:'Should not save',fEditSets:1});assert.equal(JSON.stringify(h.app.data),before);
});
test('Legacy unfinished workouts acquire definitions in memory without rewriting stored history',()=>{
  const h=setup(),data=JSON.parse(h.records.get('htData_v1'));
  for(const e of data.activeSession.exercises)delete e.definition;delete data.activeSession.isLower;
  const raw=JSON.stringify(data),r=boot(script,{'htData_v1':raw});
  assert.equal(r.records.get('htData_v1'),raw);assert(r.app.data.activeSession.exercises[0].definition);
  complete(r,2);edit(r,{fEditSets:1});assert.equal(log(r).sets[2].completed,true);
});
test('Removing an exercise from the programme does not hide its active sets or prevent finishing',()=>{
  const h=setup();complete(h);h.app.data.program[0].exercises=[];h.app.save();
  const r=boot(script,{'htData_v1':h.records.get('htData_v1')});assert(r.app.renderActiveSession().includes('Incline Dumbbell Press'));
  r.app.finishWorkoutFlow();assert.equal(r.app.data.sessions[0].totalVolume,300);
});
test('Swaps refuse entered or completed sets instead of renaming recorded performance',()=>{
  const h=setup();log(h).definition.alts=['Cable press'];const id=log(h).exerciseId,alt=log(h).definition.alts[0];
  h.app.updateSetField(id,0,'weight',0);const before=JSON.stringify(h.app.data);
  assert.equal(h.app.swapWorkoutExercise(id,alt),false);assert.equal(JSON.stringify(h.app.data),before);
  complete(h);assert.equal(h.app.swapWorkoutExercise(id,alt),false);
});
test('Empty exercise swaps persist, restrict choices and roll back on save failure',()=>{
  const h=setup();log(h).definition.alts=['Cable press'];const id=log(h).exerciseId,alt=log(h).definition.alts[0],before=JSON.stringify(h.app.data);
  assert.equal(h.app.swapWorkoutExercise(id,'Not an alternative'),false);
  h.state.writeFailure=true;assert.equal(h.app.swapWorkoutExercise(id,alt),false);assert.equal(JSON.stringify(h.app.data),before);
  h.state.writeFailure=false;assert.equal(h.app.swapWorkoutExercise(id,alt),true);
  const r=boot(script,{'htData_v1':h.records.get('htData_v1')});assert.equal(log(r).name,alt);
});
test('Invalid edits cannot silently complete or finish using an old valid value',()=>{
  const h=setup();complete(h);const id=log(h).exerciseId;
  h.app.updateSetField(id,0,'reps',2.5);assert.equal(log(h).sets[0].reps,null);assert.equal(log(h).sets[0].completed,false);
  h.app.toggleSetComplete(id,0,true);assert.equal(log(h).sets[0].completed,false);
  h.app.finishWorkoutFlow();assert.equal(h.app.data.sessions.length,0);
});
test('Partial finish can be cancelled and only completed sets contribute to totals',()=>{
  const h=setup();complete(h);h.app.updateSetField(log(h).exerciseId,1,'weight',999);h.app.updateSetField(log(h).exerciseId,1,'reps',99);
  h.state.confirm=false;h.app.finishWorkoutFlow();assert(h.app.data.activeSession);assert.equal(h.app.data.sessions.length,0);
  h.state.confirm=true;h.app.finishWorkoutFlow();assert.equal(h.app.data.sessions[0].totalSets,1);assert.equal(h.app.data.sessions[0].totalVolume,300);
  h.app.finishWorkoutFlow();assert.equal(h.app.data.sessions.length,1);
});
test('Malformed exercise snapshots are rejected without overwriting a valid workout',()=>{
  const h=setup(),raw=h.records.get('htData_v1'),bad=JSON.parse(raw);bad.activeSession.exercises[0].definition.restSec=-1;
  assert.throws(()=>h.app.validateData(bad));assert.equal(h.records.get('htData_v1'),raw);
});
test('Rest extensions, skip and expired recovery keep clock-based state consistent',()=>{
  const h=setup();h.app.startRestTimer(60);const end=h.app.data.restEndAt;
  h.element('rtAdd30').onclick();assert.equal(h.app.data.restEndAt,end+30000);
  h.state.clock+=100000;h.app.updateRestTimerFromClock();assert.equal(h.app.timer.running,false);assert.equal(h.app.data.restEndAt,null);
  h.app.startRestTimer(60);h.element('rtSkip').onclick();assert.equal(h.app.data.restEndAt,null);
});
console.log(count+' Phase 2 logging checks passed');
