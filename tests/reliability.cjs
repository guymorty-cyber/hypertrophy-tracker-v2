'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
const checks=[];function test(name,run){checks.push({name,run});}
const key='htData_v1',backup=key+'_backup',clone=x=>JSON.parse(JSON.stringify(x));
function setup(){const h=boot(script);h.app.startSession(0);const ex=h.app.data.activeSession.exercises[0];h.app.updateSetField(ex.exerciseId,0,'weight',30);h.app.updateSetField(ex.exerciseId,0,'reps',8);return {h,id:ex.exerciseId};}
function selected(content){return {target:{files:[{content:typeof content==='string'?content:JSON.stringify(content)}],value:'selected'}};}
function resolveRead(h,i){const {reader,file}=h.state.readers[i];reader.onload({target:{result:file.content}});}
test('A failed completion or uncompletion never changes saved or visible completion and never starts rest',()=>{
 const {h,id}=setup(),raw=h.records.get(key);h.state.writeFailure=true;h.app.toggleSetComplete(id,0,true);assert.equal(h.app.data.activeSession.exercises[0].sets[0].completed,false);assert.equal(h.app.timer.running,false);assert.equal(h.records.get(key),raw);
 h.state.writeFailure=false;h.app.toggleSetComplete(id,0,true);h.state.writeFailure=true;h.app.toggleSetComplete(id,0,false);assert.equal(h.app.data.activeSession.exercises[0].sets[0].completed,true);
});
test('Completion and its rest deadline are one primary write and recover together',()=>{
 const {h,id}=setup();h.state.writes=[];h.app.toggleSetComplete(id,0,true);assert.equal(h.state.writes.filter(k=>k===key).length,1);const saved=JSON.parse(h.records.get(key));assert.equal(saved.activeSession.exercises[0].sets[0].completed,true);assert.equal(saved.restEndAt,h.app.timer.endAt);const r=boot(script,{[key]:h.records.get(key)});assert(r.app.timer.running);assert.equal(r.app.timer.endAt,saved.restEndAt);
});
test('Stale-tab completion cannot overwrite another tab or start an unsaved timer',()=>{
 const {h,id}=setup(),newer=clone(h.app.data);newer.activeSession.notes='Other tab';h.records.set(key,JSON.stringify(newer));h.app.toggleSetComplete(id,0,true);assert.equal(h.app.data.activeSession.exercises[0].sets[0].completed,false);assert.equal(h.app.timer.running,false);assert.equal(JSON.parse(h.records.get(key)).activeSession.notes,'Other tab');
});
test('Start, extend and skip retain the previous deadline when storage is full',()=>{
 const {h}=setup();assert(h.app.startRestTimer(90));const deadline=h.app.timer.endAt,raw=h.records.get(key);h.state.writeFailure=true;assert.equal(h.app.startRestTimer(120),false);assert.equal(h.app.extendRestTimer(),false);assert.equal(h.app.stopRestTimer(),false);assert.equal(h.app.timer.endAt,deadline);assert.equal(h.app.data.restEndAt,deadline);assert(h.app.timer.running);assert.equal(h.records.get(key),raw);
 h.state.writeFailure=false;assert(h.app.extendRestTimer());assert.equal(h.app.timer.endAt,deadline+30000);assert(h.app.stopRestTimer());assert.equal(h.app.data.restEndAt,null);
});
test('Expired rest stops once even when cleanup cannot save, without repeated writes or a recovered timer',()=>{
 const {h}=setup();h.app.startRestTimer(0);h.state.writeFailure=true;h.state.clock+=1000;h.app.updateRestTimerFromClock();assert.equal(h.app.timer.running,false);assert(h.app.unsaved);const raw=h.records.get(key);h.app.updateRestTimerFromClock();assert.equal(h.records.get(key),raw);const r=boot(script,{[key]:raw});assert.equal(r.app.timer.running,false);
});
test('Unchanged saves preserve the useful previous snapshot through Retry and update-style saves',()=>{
 const {h}=setup(),previous=h.records.get(backup);assert(previous);h.app.save();h.app.save();assert.equal(h.records.get(backup),previous);h.app.restoreBackup();assert.equal(h.app.data.activeSession.exercises[0].sets[0].reps,null);
});
test('A backup-write failure does not prevent saving the current workout',()=>{
 const {h,id}=setup();h.state.writeFailureKey=backup;h.app.updateSetField(id,0,'reps',9);assert.equal(JSON.parse(h.records.get(key)).activeSession.exercises[0].sets[0].reps,9);assert.equal(h.app.unsaved,false);
});
test('Ordinary Export preserves the original damaged bytes instead of exporting empty fallback data',async()=>{
 for(const damaged of ['{damaged workout bytes','']){const h=boot(script,{[key]:damaged});h.app.exportData();assert.equal(await h.state.downloads[0].text(),damaged);assert.equal(h.records.get(key),damaged);assert(h.app.blocked);}
});
test('Only the latest selected import can commit; superseded errors cannot clear the current selection',()=>{
 const {h}=setup();h.state.deferReads=true;const a=clone(h.app.data),b=clone(a);a.marker='Older selection';b.marker='Latest selection';const first=selected(a),second=selected(b);h.app.importData(first);h.app.importData(second);h.state.readers[0].reader.onerror();assert.equal(second.target.value,'selected');resolveRead(h,1);const raw=h.records.get(key);resolveRead(h,0);assert.equal(h.app.data.marker,'Latest selection');assert.equal(h.records.get(key),raw);
});
test('Editing or finishing during a slow import rejects its obsolete replacement',()=>{
 const {h,id}=setup();h.state.deferReads=true;h.app.importData(selected(clone(h.app.data)));h.app.updateSetField(id,0,'reps',11);const raw=h.records.get(key);resolveRead(h,0);assert.equal(h.records.get(key),raw);assert.equal(h.app.data.activeSession.exercises[0].sets[0].reps,11);assert(h.state.alerts.at(-1).includes('data changed'));
});
test('A delayed import also respects another tab, quota failures and a cancelled confirmation',()=>{
 for(const mode of ['stale','quota','cancel']){const {h}=setup();h.state.deferReads=true;h.app.importData(selected(h.app.defaultData()));const raw=h.records.get(key);if(mode==='stale')h.records.set(key,raw+' ');if(mode==='quota')h.state.writeFailure=true;if(mode==='cancel')h.state.confirm=false;const expected=h.records.get(key);resolveRead(h,0);assert.equal(h.records.get(key),expected);assert(h.app.data.activeSession);}
});
test('Malformed or ambiguous programme/active identities and fractional prescriptions are rejected before import',()=>{
 const {h}=setup(),before=h.records.get(key);
 const mutations=[d=>d.program[1].exercises[0].id=d.program[0].exercises[0].id,d=>d.activeSession.exercises.push(clone(d.activeSession.exercises[0])),d=>d.program[0].exercises[0].repMin=6.5,d=>d.program[0].exercises[0].repMax=10.5,d=>d.program[0].exercises[0].repMin=0,d=>d.program[0]=null,d=>d.program[0].exercises[0].currentDisplay={},d=>d.program[0].id=123,d=>d.program[0].exercises[0].id=123,d=>{d.activeSession.exercises[0].exerciseId=123;d.activeSession.exercises[0].definition.id=123;}];
 for(const change of mutations){const bad=clone(h.app.data);change(bad);assert.throws(()=>h.app.validateData(bad));h.app.importData(selected(bad));assert.equal(h.records.get(key),before);}
});
test('Historical repeated movements remain valid and no legacy read rewrites stored data',()=>{
 const {h}=setup(),saved=clone(h.app.data),active=saved.activeSession;saved.activeSession=null;saved.sessions=[{...active,id:'old',exercises:[clone(active.exercises[0]),clone(active.exercises[0])]}];for(const log of saved.sessions[0].exercises)delete log.definition;delete saved.dashboard;const raw=JSON.stringify(saved);const r=boot(script,{[key]:raw});assert(!r.app.blocked);assert.equal(r.records.get(key),raw);assert.equal(r.app.data.sessions[0].exercises.length,2);for(const log of saved.sessions[0].exercises)log.exerciseId=123;assert.doesNotThrow(()=>h.app.validateData(saved));
});
test('Reminder metadata is derived from the referenced workout without discarding extra fields',()=>{
 const {h}=setup(),data=clone(h.app.data),s={...data.activeSession,id:'history',date:'2026-10-19',dayName:'Actual lower day'};data.activeSession=null;data.sessions=[s];data.pendingNextMorning={sessionId:s.id,date:'invalid',dayName:'Wrong day',customFlag:'Keep'};const valid=h.app.validateData(data);assert.equal(valid.pendingNextMorning.date,s.date);assert.equal(valid.pendingNextMorning.dayName,s.dayName);assert.equal(valid.pendingNextMorning.customFlag,'Keep');data.pendingNextMorning.sessionId='missing';assert.equal(h.app.validateData(data).pendingNextMorning,null);
});
test('Future-dated history cannot supply today’s coaching or advance the workout sequence',()=>{
 const {h,id}=setup(),active=clone(h.app.data.activeSession),name=active.exercises[0].name;const past={...clone(active),id:'past',date:'2026-10-19'},future={...clone(active),id:'future',date:'2026-10-21',dayId:h.app.data.program[2].id};future.exercises[0].sets=[{weight:100,reps:10,completed:true}];past.exercises[0].sets=[{weight:30,reps:8,completed:true}];h.app.data.sessions=[future,past];assert.equal(h.app.lastSessionFor(id,name).session.id,'past');assert.equal(h.app.getNextProgramIndex(),1);assert.equal(h.app.getPRFor(id,name).heaviest.weight,100);h.app.data.sessions=[future];assert.equal(h.app.lastSessionFor(id,name),null);assert.equal(h.app.getNextProgramIndex(),0);
});
test('432 coaching combinations preserve valid prescriptions, bodyweight, deload and equipment increments',()=>{
 const h=boot(script),template=h.app.data.program[0].exercises[0];let cases=0;
 for(let week=1;week<=8;week++)for(const cat of ['heavy','moderate','isolation'])for(const [sets,repMin,repMax] of [[1,1,3],[3,6,10],[5,12,15]])for(const inc of [0,.25,2.5])for(const weight of [0,20]){
  const ex={...template,sets,repMin,repMax,cat,inc},context=h.app.getCoachingPrescription(ex,week),log={exerciseId:ex.id,name:ex.name,definition:clone(ex),sets:Array.from({length:sets},()=>({weight,reps:repMax,completed:true}))};h.app.data.sessions=[{id:'matrix',date:'2026-10-20',startedAt:1,weekNumber:week,phase:context.phase,exercises:[log]}];const before=JSON.stringify(h.app.data),rec=h.app.computeRecommendation(ex,log,{weekNumber:week});assert.equal(rec.sets,context.sets);assert.equal(rec.prescription.length,context.sets);assert.equal(rec.targetTotal,rec.prescription.reduce((n,s)=>n+s.reps,0));for(const s of rec.prescription){assert(Number.isFinite(s.weight) && s.weight>=0);assert(Number.isInteger(s.reps) && s.reps>=repMin && s.reps<=repMax);}if(context.deload || inc===0 || weight===0)assert.notEqual(rec.type,'up');else{assert.equal(rec.type,'up');assert.equal(rec.nextWeight,weight+inc);}assert.equal(JSON.stringify(h.app.data),before);cases++;
 }assert.equal(cases,432);
});
(async()=>{for(const check of checks){await check.run();console.log('PASS '+check.name);}console.log(checks.length+' Phase 9 reliability checks passed');})().catch(error=>{console.error(error);process.exitCode=1;});
