'use strict';
const assert=require('node:assert/strict');const {boot,script}=require('./regression.cjs');
let count=0;function test(name,fn){fn();console.log('PASS '+name);count++;}
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(totals=[[8,8,7],[8,8,7],[8,8,7]]){
 const h=boot(script),ex=h.app.data.program[0].exercises[0];
 h.app.data.sessions=totals.map((reps,i)=>({id:'s'+i,date:'2026-10-19',startedAt:i+1,dayId:'d1',dayName:'Upper A',weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name:ex.name,definition:clone(ex),notes:'',sets:reps.map(reps=>({weight:40,reps,completed:true}))}]}));h.app.save();
 const latest=()=>h.app.data.sessions.at(-1).exercises[0];const rec=options=>h.app.computeRecommendation(ex,latest(),{weekNumber:1,...options});return {h,ex,latest,rec};
}
test('Three flat comparable workouts hold progression without an automatic load reduction',()=>{const {rec}=fixture();const r=rec();assert.equal(r.insight.pattern,'stall');assert.equal(r.type,'maintain');assert.equal(r.nextWeight,40);assert(r.detail.includes('23 → 23 → 23'));assert(!r.detail.includes('aim for one more'));});
test('Improving reps retain double progression, and repeated ceiling workouts do not become false stalls',()=>{const a=fixture([[7,7,7],[8,8,7],[9,8,7]]).rec();assert.equal(a.insight.pattern,'improving');assert.equal(a.type,'reps');const b=fixture([[10,10,10],[10,10,10],[10,10,10]]).rec();assert.equal(b.type,'up');assert.equal(b.nextWeight,42.5);});
test('A three-workout decline holds rather than inventing a one-session load reduction',()=>{const r=fixture([[10,10,10],[9,9,9],[8,8,8]]).rec();assert.equal(r.insight.pattern,'declining');assert.equal(r.type,'maintain');assert.equal(r.nextWeight,40);});
test('One reported effort miss blocks an increase without reducing load',()=>{const {latest,rec}=fixture([[10,10,10]]);latest().effortRir=0;const r=rec();assert.equal(r.type,'maintain');assert.equal(r.nextWeight,40);assert(r.detail.includes('harder than its 2 RIR target'));assert(!r.detail.includes('Increase by'));});
test('Two comparable effort misses without rep progress use one programmed increment',()=>{const {h,rec}=fixture([[8,8,8],[8,8,8]]);h.app.data.sessions.forEach(s=>s.exercises[0].effortRir=0);const r=rec();assert.equal(r.type,'down');assert.equal(r.nextWeight,37.5);});
test('Easier effort does not bypass the rep ceiling and missing feedback does not invent effort',()=>{const {latest,rec}=fixture([[8,8,7]]);latest().effortRir=5;assert.equal(rec().type,'reps');delete latest().effortRir;assert.equal(rec().nextWeight,40);assert(!rec().detail.includes('Reported final-set'));});
test('Lower readiness pauses today only, preserves deload and never changes the saved programme',()=>{const {h,rec}=fixture([[10,10,10]]),before=JSON.stringify(h.app.data);const low=rec({readiness:'low'});assert.equal(low.type,'maintain');assert.equal(low.nextWeight,40);assert.equal(low.context.partialsAllowed,false);assert(low.context.rirMin>=2);assert.equal(rec().type,'up');assert.equal(JSON.stringify(h.app.data),before);const d=rec({weekNumber:5,readiness:'low'});assert.equal(d.sets,2);assert.equal(d.context.rirMin,3);assert.equal(d.context.rirMax,4);});
test('Load changes, incomplete/mixed sets and variant switches cannot fabricate a trend',()=>{
 for(const change of [s=>s.exercises[0].sets.forEach(set=>set.weight=35),s=>s.exercises[0].sets[0].completed=false,s=>s.exercises[0].sets[1].weight=35,s=>s.exercises[0].name='Other variation']){
  const {h,rec}=fixture();change(h.app.data.sessions[1]);assert(rec().insight.count<3);assert.notEqual(rec().insight.pattern,'stall');
 }
});
test('Deload and lower-readiness history reset comparisons rather than diagnosing a plateau',()=>{for(const change of [s=>s.phase='Deload',s=>s.readiness='low']){const {h,rec}=fixture();change(h.app.data.sessions[1]);assert.equal(rec().insight.count,1);}});
test('Changed prescriptions and long gaps hold progression and reset comparable history',()=>{
 const {latest,rec}=fixture([[10,10,10]]);latest().definition.tempo='slow';assert.equal(rec().type,'maintain');assert(rec().detail.includes('prescription changed'));
 const b=fixture([[10,10,10]]);b.h.app.data.sessions[0].date='2026-08-01';assert.equal(b.rec().type,'maintain');assert(b.rec().detail.includes('28 days'));
});
test('Bodyweight and zero increments never produce a fabricated external-load reduction',()=>{for(const inc of [0,2.5]){const f=fixture([[8,8,8],[8,8,8]]);f.ex.inc=inc;f.h.app.data.sessions.forEach(s=>{s.exercises[0].definition.inc=inc;s.exercises[0].sets.forEach(set=>set.weight=0);s.exercises[0].effortRir=0;});assert.equal(f.rec().nextWeight,0);assert.notEqual(f.rec().type,'down');}});
test('Feedback requires complete planned sets, saves atomically and survives recovery',()=>{
 const {h,ex}=fixture();h.app.startSession(0);assert.equal(h.app.setExerciseEffort(ex.id,'0'),false);
 for(let i=0;i<3;i++){h.app.updateSetField(ex.id,i,'weight',40);h.app.updateSetField(ex.id,i,'reps',8);h.app.toggleSetComplete(ex.id,i,true);}assert(h.app.setExerciseEffort(ex.id,'1'));assert(h.app.setWorkoutReadiness('low'));
 const raw=h.records.get('htData_v1'),r=boot(script,{'htData_v1':raw});assert.equal(r.app.data.activeSession.readiness,'low');assert.equal(r.app.data.activeSession.exercises[0].effortRir,1);
 const before=JSON.stringify(h.app.data);h.state.writeFailure=true;assert.equal(h.app.setExerciseEffort(ex.id,'2'),false);assert.equal(h.app.setWorkoutReadiness('usual'),false);assert.equal(JSON.stringify(h.app.data),before);assert.equal(h.records.get('htData_v1'),raw);
});
test('Invalid feedback is rejected on entry and import without modifying saved records',()=>{
 const {h}=fixture(),raw=h.records.get('htData_v1');for(const value of [-1,1.5,6,'0']){const d=clone(h.app.data);d.sessions[0].exercises[0].effortRir=value;assert.throws(()=>h.app.validateData(d));}const d=clone(h.app.data);d.sessions[0].readiness='unwell';assert.throws(()=>h.app.validateData(d));assert.equal(h.records.get('htData_v1'),raw);
});
test('History corrections, deletion and Undo immediately change coaching evidence',()=>{
 const {h,rec}=fixture([[10,10,10]]),original=h.app.data.sessions[0],draft=clone(original);draft.exercises[0].effortRir=0;assert(h.app.saveHistoryEdit(original.id,draft,JSON.stringify(original)));assert.equal(rec().type,'maintain');const corrected=clone(h.app.data.sessions[0]);corrected.exercises[0].effortRir=2;assert(h.app.saveHistoryEdit(original.id,corrected,JSON.stringify(h.app.data.sessions[0])));assert.equal(rec().type,'up');h.app.deleteWorkout(original.id);assert.equal(h.app.lastSessionFor('d1e1'),null);h.app.undoDeleteWorkout();assert.equal(rec().type,'up');
});
test('Feedback export/import preserves values and legacy reads add no inferred data',()=>{const {h}=fixture();const initial=h.records.get('htData_v1'),legacy=boot(script,{'htData_v1':initial});assert.equal(legacy.records.get('htData_v1'),initial);assert.equal(legacy.app.data.sessions[0].readiness,undefined);h.app.data.sessions[0].readiness='low';h.app.data.sessions[0].exercises[0].effortRir=1;h.app.save();const raw=h.records.get('htData_v1');h.app.importData({target:{files:[{content:raw}],value:'feedback.json'}});assert.equal(h.app.data.sessions[0].readiness,'low');assert.equal(h.app.data.sessions[0].exercises[0].effortRir,1);});
console.log(count+' Phase 6 adaptive-coaching checks passed');
