'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let failures=0,count=0;
const test=(name,run)=>{count++;try{run();console.log('PASS '+name);}catch(error){failures++;console.error('FAIL '+name+': '+error.stack);}};
const setup=()=>{const h=boot(script);return {...h,ex:h.app.data.program[0].exercises[0]};};
const log=(reps,weights=40)=>({exerciseId:'d1e1',name:'Incline Dumbbell Press',notes:'',sets:reps.map((reps,i)=>({weight:Array.isArray(weights)?weights[i]:weights,reps,completed:true}))});
const saved=(h,id,entry,startedAt)=>({id,date:'2026-10-19',startedAt,dayId:'d1',dayName:'Upper A',weekNumber:1,phase:'Calibration',exercises:[entry],notes:'',kneePain:{before:null,after:null,nextMorning:null}});
const rec=(h,entry,weekNumber=1)=>h.app.computeRecommendation(h.ex,entry,{weekNumber});

test('Missing or malformed previous performance gives a safe baseline',()=>{
  const h=setup();
  for(const previous of [null,{sets:[]},{sets:{}},{sets:[{weight:'40',reps:8,completed:true},{weight:NaN,reps:null,completed:true}]}]){
    const r=rec(h,previous);assert.equal(r.type,'first');assert.equal(r.nextWeight,null);
    assert.equal(r.sets,3);assert(!r.text.includes('NaN'));assert(r.context.effort.includes('2 RIR'));
  }
});
test('40kg 8/8/7 targets 9/8/7 without increasing weight',()=>{
  const h=setup(),r=rec(h,log([8,8,7]));assert.equal(r.nextWeight,40);
  assert.deepEqual(r.prescription.map(s=>s.reps),[9,8,7]);assert.equal(r.targetTotal,24);
});
test('40kg 9/9/8 holds 40kg and builds reps',()=>{
  const h=setup(),r=rec(h,log([9,9,8]));assert.equal(r.type,'reps');assert.equal(r.nextWeight,40);
  assert.equal(r.targetTotal,27);assert.deepEqual(r.prescription.map(s=>s.reps),[10,9,8]);
});
test('40kg 10/10/10 uses the actual exercise increment and resets reps',()=>{
  const h=setup(),r=rec(h,log([10,10,10]));assert.equal(r.type,'up');assert.equal(r.nextWeight,42.5);
  assert.deepEqual(r.prescription.map(s=>s.reps),[6,6,6]);
  assert.equal(h.app.computeRecommendation({...h.ex,inc:5},log([10,10,10])).nextWeight,45);
});
test('Partial workouts cannot trigger a load increase',()=>{
  const h=setup(),r=rec(h,log([10]));assert.equal(r.type,'maintain');assert.equal(r.nextWeight,40);
  assert(r.detail.includes('1 of 3'));assert.equal(r.prescription.length,3);
});
test('Mixed loads keep separate prescriptions rather than increasing a median load',()=>{
  const h=setup(),r=rec(h,log([10,10,10],[40,35,30]));assert.equal(r.type,'maintain');assert.equal(r.nextWeight,null);
  assert.deepEqual(r.prescription.map(s=>s.weight),[40,35,30]);assert(r.detail.includes('different loads'));
});
test('Optional extra sets do not change progression of the prescribed working sets',()=>{
  const h=setup(),r=rec(h,log([10,10,10,4],[40,40,40,20]));assert.equal(r.type,'up');assert.equal(r.nextWeight,42.5);
});
test('A single poor workout does not trigger a load reduction',()=>{
  const h=setup(),r=rec(h,log([4,4,4]));assert.equal(r.type,'maintain');assert.equal(r.nextWeight,40);
  assert(r.detail.includes('One workout'));assert(r.prescription.every(s=>s.reps>=6 && s.reps<=10));
});
test('Two poor comparable workouts permit an exercise-specific reduction',()=>{
  const h=setup(),before=log([4,4,4]),latest=log([4,4,4]);
  h.app.data.sessions=[saved(h,'a',before,1),saved(h,'b',latest,2)];
  const r=rec(h,latest);assert.equal(r.type,'down');assert.equal(r.nextWeight,37.5);
});
test('A performance drop holds the load and explains the actual comparison',()=>{
  const h=setup(),before=log([10,10,10]),latest=log([7,7,7]);h.app.data.sessions=[saved(h,'a',before,1),saved(h,'b',latest,2)];
  const r=rec(h,latest);assert.equal(r.type,'maintain');assert(r.detail.includes('30 → 21'));
});
test('Zero external load remains bodyweight, not missing history or a fabricated weight increase',()=>{
  const h=setup(),r=rec(h,log([10,10,10],0));assert.equal(r.nextWeight,0);assert.equal(r.type,'maintain');
  assert(r.detail.includes('Bodyweight'));assert(r.prescription.every(s=>s.weight===0));
});
test('Zero increments and fractional equipment increments are respected exactly',()=>{
  const h=setup();assert.equal(h.app.computeRecommendation({...h.ex,inc:0},log([10,10,10])).nextWeight,40);
  assert.equal(h.app.computeRecommendation({...h.ex,inc:0},log([10,10,10])).type,'maintain');
  assert.equal(h.app.computeRecommendation({...h.ex,inc:0.1},log([10,10,10],40.3)).nextWeight,40.4);
});
test('Effort guidance follows compound, isolation and training phase rules',()=>{
  const h=setup(),isolation={...h.ex,cat:'isolation',finalPartials:true};
  assert.equal(h.app.getCoachingPrescription(h.ex,1).rirMin,2);
  assert.equal(h.app.getCoachingPrescription(isolation,1).rirMin,1);
  assert.equal(h.app.getCoachingPrescription(h.ex,3).rirMax,2);
  assert.equal(h.app.getCoachingPrescription(h.ex,8).finalRir,1);
  assert.equal(h.app.getCoachingPrescription(isolation,8).finalRir,0);
  assert.equal(h.app.getCoachingPrescription(isolation,1).partialsAllowed,false);
  assert.equal(h.app.getCoachingPrescription(isolation,8).partialsAllowed,true);
});
test('Deload prescribes fewer sets and 3–4 RIR without progressing loads or partials',()=>{
  const h=setup(),r=rec(h,log([10,10,10]),5);assert.equal(r.type,'maintain');assert.equal(r.nextWeight,40);
  assert.equal(r.sets,2);assert.equal(r.context.rirMin,3);assert.equal(r.context.rirMax,4);
  assert.equal(r.context.partialsAllowed,false);assert(r.detail.includes('No partials'));
  h.app.data.programStartDate=new Date(h.state.clock-28*86400000).toISOString().slice(0,10);
  h.app.startSession(0);assert.equal(h.app.data.activeSession.weekNumber,5);
  assert.equal(h.app.data.activeSession.exercises[0].sets.length,2);assert.equal(h.app.data.program[0].exercises[0].sets,3);
});
test('Recovery keeps the workout start phase instead of changing recommendations mid-session',()=>{
  const h=setup();h.app.startSession(0);h.state.clock+=28*86400000;
  h.app.startSession(1);
  assert(h.element('phaseLabel').textContent.includes('Week 1 · Calibration'));
  const html=h.app.renderActiveSession();assert(html.includes('Today’s target · Calibration'));
  assert(!html.includes('Today’s prescription · Deload'));
});
test('A chosen exercise variation persists into the next workout and its visible heading',()=>{
  const h=setup();h.app.data.program[0].exercises[1].currentDisplay='Pendlay Row';h.app.startSession(0);
  assert.equal(h.app.data.activeSession.exercises[1].name,'Pendlay Row');assert(h.app.renderActiveSession().includes('2. Pendlay Row</h3>'));
});
test('End-to-end recorded workouts drive the next recommendation',()=>{
  const h=setup();
  for(const reps of [[8,8,7],[9,9,8],[10,10,10]]){
    h.app.startSession(0);const id=h.ex.id;
    reps.forEach((r,i)=>{h.app.updateSetField(id,i,'weight',40);h.app.updateSetField(id,i,'reps',r);h.app.toggleSetComplete(id,i,true);});
    h.app.finishWorkoutFlow();assert.equal(h.app.data.activeSession,null);
    const last=h.app.lastSessionFor(id).log;const r=rec(h,last);
    assert.equal(r.nextWeight,reps[0]===10?42.5:40);
  }
  assert.equal(h.app.data.sessions.length,3);
});
test('Training weeks follow calendar days across the UK daylight-saving change',()=>{
  const previous=process.env.TZ;
  try{
    process.env.TZ='Europe/London';
    const h=setup();h.state.clock=Date.parse('2026-04-05T12:00:00Z');h.app.data.programStartDate='2026-03-08';
    assert.equal(h.app.getWeekNumber(),5);
    assert.equal(h.app.getCoachingPrescription(h.ex).phase,'Deload');
  }finally{if(previous===undefined) delete process.env.TZ;else process.env.TZ=previous;}
});
console.log(count+' Phase 1 coaching checks, '+failures+' failures');
if(failures) process.exitCode=1;
