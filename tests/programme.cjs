'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
const clone=value=>JSON.parse(JSON.stringify(value));
function setup(){const h=boot(script);h.app.save();return h;}
function fields(ex,overrides={}){return {...ex,rirTarget:ex.rirTarget??null,tempo:ex.tempo||'',note:ex.note||'',alts:ex.alts||[],...overrides};}
function history(h){h.app.startSession(0);const id=h.app.data.activeSession.exercises[0].exerciseId;h.app.updateSetField(id,0,'weight',30);h.app.updateSetField(id,0,'reps',10);h.app.toggleSetComplete(id,0,true);h.app.finishWorkoutFlow();return clone(h.app.data.sessions);}
test('Day create, rename and reorder preserve IDs, logs and the programme start date',()=>{
 const h=setup(),logs=history(h),date=h.app.data.programStartDate,day=h.app.data.program[0],id=day.id;
 assert(h.app.saveProgrammeDay(null,{name:'Custom lower',type:'training',isLower:true}));const added=h.app.data.program.at(-1);assert.equal(added.exercises.length,0);
 assert(h.app.saveProgrammeDay(id,{name:'Upper renamed',type:'training',isLower:false},JSON.stringify(day)));assert.equal(h.app.data.program[0].id,id);assert(h.app.moveProgrammeDay(id,1));assert.equal(h.app.data.program[1].id,id);assert.equal(h.app.data.programStartDate,date);assert.deepEqual(h.app.data.sessions,logs);
});
test('Copy day gives every exercise a new slot while sharing same-movement records',()=>{
 const h=setup();history(h);const day=h.app.data.program[0];assert(h.app.duplicateProgrammeDay(day.id));const copy=h.app.data.program[1];assert.notEqual(copy.id,day.id);assert.equal(copy.name,day.name+' copy');assert.equal(copy.exercises.length,day.exercises.length);
 const ids=h.app.data.program.flatMap(d=>[d.id,...d.exercises.map(e=>e.id)]);assert.equal(new Set(ids).size,ids.length);assert.equal(h.app.getPRFor(copy.exercises[0].id),null);assert.equal(h.app.getPRFor(copy.exercises[0].id,copy.exercises[0].name).heaviest.weight,30);
});
test('Day deletion retains History/Progress, refuses the active day and keeps a final day',()=>{
 const h=setup(),logs=history(h),day=h.app.data.program[0];h.app.startSession(0);assert.equal(h.app.deleteProgrammeDay(day.id),false);assert(h.app.data.activeSession);
 h.app.commitData({...h.app.data,activeSession:null});assert(h.app.deleteProgrammeDay(day.id));assert.deepEqual(h.app.data.sessions,logs);const shared=h.app.progressExercises().find(e=>e.key===h.app.movementKey(day.exercises[0].name));assert(shared && shared.current && shared.days.includes(day.name));assert.equal(h.app.exerciseProgress(shared.id,shared.name).length,1);
 h.app.commitData({...h.app.data,program:[h.app.data.program[0]]});assert.equal(h.app.deleteProgrammeDay(h.app.data.program[0].id),false);
});
test('Day mutation fails atomically on full storage, cancellation and stale tabs',()=>{
 const h=setup(),day=h.app.data.program[0],before=JSON.stringify(h.app.data);h.state.writeFailure=true;
 assert.equal(h.app.duplicateProgrammeDay(day.id),false);assert.equal(h.app.moveProgrammeDay(day.id,1),false);assert.equal(h.app.saveProgrammeDay(null,{name:'Not saved',type:'rest'}),false);assert.equal(JSON.stringify(h.app.data),before);
 h.state.writeFailure=false;h.state.confirm=false;assert.equal(h.app.deleteProgrammeDay(day.id),false);assert.equal(JSON.stringify(h.app.data),before);
 const newer=clone(h.app.data);newer.program[0].name='Newer tab';h.records.set('htData_v1',JSON.stringify(newer));assert.equal(h.app.moveProgrammeDay(day.id,1),false);assert.equal(JSON.parse(h.records.get('htData_v1')).program[0].name,'Newer tab');
});
test('Rest conversion cannot erase exercises and empty training days cannot start',()=>{
 const h=setup(),day=h.app.data.program[0];assert.equal(h.app.saveProgrammeDay(day.id,{name:'Rest',type:'rest'}),false);assert(day.exercises.length);
 assert(h.app.saveProgrammeDay(null,{name:'Empty day',type:'training'}));h.app.startSession(h.app.data.program.length-1);assert.equal(h.app.data.activeSession,null);
});
test('Multiple rest days log the selected identity and deleting an open rest day clears its screen',()=>{
 const h=setup();assert(h.app.saveProgrammeDay(null,{name:'Extra recovery',type:'rest'}));const idx=h.app.data.program.length-1,day=h.app.data.program[idx];h.app.startRestDay(idx);assert.equal(h.app.data.restDayId,day.id);h.app.logRestDay();assert.equal(h.app.data.sessions.at(-1).dayId,day.id);
 h.app.startRestDay(idx);assert(h.app.deleteProgrammeDay(day.id));assert.equal(h.app.data.restDayOpen,false);assert.equal(h.app.data.restDayId,null);
});
test('Exercise edits retain zero/fractional increments, category, per-leg, RIR, tempo and unique alternatives',()=>{
 const h=setup(),day=h.app.data.program[0],ex=day.exercises[0];assert(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex,{inc:.25,restSec:0,cat:'isolation',rirTarget:3,tempo:'3-1-1-0',perLeg:true,alts:[' Alt ','Alt','',ex.name]}),JSON.stringify(ex)));
 const saved=h.app.data.program[0].exercises[0];assert.equal(saved.inc,.25);assert.equal(saved.restSec,0);assert.equal(saved.rirTarget,3);assert.equal(saved.cat,'isolation');assert.equal(saved.perLeg,true);assert.deepEqual(saved.alts,['Alt']);
 const r=boot(script,{'htData_v1':h.records.get('htData_v1')});assert.equal(r.app.data.program[0].exercises[0].tempo,'3-1-1-0');
});
test('Blank/fractional counts, invalid ranges and effort values cannot silently change the programme',()=>{
 const h=setup(),day=h.app.data.program[0],ex=day.exercises[0],raw=h.records.get('htData_v1');
 for(const patch of [{sets:NaN},{sets:2.5},{repMin:1.2},{repMax:2},{inc:-1},{restSec:-1},{restSec:1.5},{rirTarget:6},{rirTarget:1.5},{tempo:'a'.repeat(81)}]){assert.equal(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex,patch)),false);assert.equal(h.records.get('htData_v1'),raw);}
});
test('Exercise copy/move/remove preserve the active workout and historical logs',()=>{
 const h=setup(),logs=history(h);h.app.startSession(0);const active=JSON.stringify(h.app.data.activeSession),day=h.app.data.program[0],id=day.exercises[0].id;
 assert(h.app.duplicateProgrammeExercise(day.id,id));assert.notEqual(h.app.data.program[0].exercises[1].id,id);assert(h.app.moveProgrammeExercise(day.id,id,1));assert(h.app.deleteProgrammeExercise(day.id,id));assert.equal(JSON.stringify(h.app.data.activeSession),active);assert.deepEqual(h.app.data.sessions,logs);
});
test('Explicit RIR reaches coaching and deload retains 3–4 RIR with no partial cue',()=>{
 const h=setup(),ex={...h.app.data.program[0].exercises[0],cat:'isolation',rirTarget:3,finalPartials:true};const peak=h.app.getCoachingPrescription(ex,8);assert.equal(peak.rirMin,3);assert.equal(peak.finalRir,3);assert.equal(peak.partialsAllowed,false);
 const deload=h.app.getCoachingPrescription({...ex,rirTarget:0},5);assert.equal(deload.rirMin,3);assert.equal(deload.rirMax,4);assert.equal(deload.partialsAllowed,false);assert.equal(h.app.getCoachingPrescription({...ex,rirTarget:null},1).rirMin,1);
});
test('New workouts snapshot new tempo/effort while an existing workout retains its prior settings',()=>{
 const h=setup(),day=h.app.data.program[0],ex=day.exercises[0];h.app.startSession(0);const before=JSON.stringify(h.app.data.activeSession);assert(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex,{rirTarget:4,tempo:'slow lowering'})));assert.equal(JSON.stringify(h.app.data.activeSession),before);
 h.app.commitData({...h.app.data,activeSession:null});h.app.startSession(0);assert.equal(h.app.data.activeSession.exercises[0].definition.rirTarget,4);assert(h.app.renderActiveSession().includes('Tempo: slow lowering'));assert(h.app.renderActiveSession().includes('4 RIR'));
});
test('Stale editor drafts cannot recreate removed exercises or overwrite newer settings',()=>{
 const h=setup(),day=h.app.data.program[0],ex=day.exercises[0],expected=JSON.stringify(ex);assert(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex,{sets:2}),expected));assert.equal(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex,{sets:1}),expected),false);h.app.deleteProgrammeExercise(day.id,ex.id);assert.equal(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex),expected),false);
});
test('Programme export/import round-trips builder settings without changing history',()=>{
 const h=setup(),logs=history(h),day=h.app.data.program[0],ex=day.exercises[0];assert(h.app.saveProgrammeExercise(day.id,ex.id,fields(ex,{rirTarget:2,tempo:'2-1-1-0',inc:0})));h.app.saveProgrammeDay(null,{name:'New rest',type:'rest'});const exported=JSON.stringify(h.app.data);h.app.importData({target:{files:[{content:exported}],value:'backup.json'}});assert.equal(h.app.data.program[0].exercises[0].inc,0);assert.equal(h.app.data.program[0].exercises[0].tempo,'2-1-1-0');assert.deepEqual(h.app.data.sessions,logs);
});
console.log(count+' Phase 5 programme checks passed');
