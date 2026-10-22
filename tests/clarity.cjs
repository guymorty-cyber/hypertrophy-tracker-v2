'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
function fixture(reps=[[7,7,7],[8,7,7],[9,7,7]]){
 const h=boot(script),day=h.app.data.program[0],ex=day.exercises[0];
 h.app.data.sessions=reps.map((values,i)=>({id:'clarity'+i,date:'2026-10-19',startedAt:i+1,dayId:day.id,dayName:day.name,weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name:ex.name,definition:clone(ex),notes:'',sets:values.map(reps=>({weight:40,reps,completed:true}))}]}));h.app.save();
 const rec=options=>h.app.computeRecommendation(ex,h.app.data.sessions.at(-1)?.exercises[0],{weekNumber:1,...options});
 return {h,day,ex,rec};
}
test('Short targets use the actual overridden prescription for reps, load increase and reduction',()=>{
 let f=fixture();assert.equal(f.h.app.coachingSummary(f.rec()),'Keep 40 kg. Aim for one more total rep: 24 total reps across 3 sets.');
 f=fixture([[10,10,10]]);assert(f.h.app.coachingSummary(f.rec()).startsWith('Try 42.5 kg'));f.h.app.data.sessions[0].exercises[0].effortRir=0;assert(!f.h.app.coachingSummary(f.rec()).includes('42.5'));
 f=fixture([[3,3,3],[3,3,3]]);assert(f.h.app.coachingSummary(f.rec()).startsWith('Reduce to 37.5 kg'));
});
test('Baseline, bodyweight, mixed-load, low-readiness and deload targets never invent a load',()=>{
 const f=fixture([]),a=f.h.app;assert(a.coachingSummary(f.rec()).includes('Choose a controlled load'));assert(a.coachingSummary(f.rec({readiness:'low'})).includes('Choose a controlled load'));
 const g=fixture([[8,8,7]]);g.h.app.data.sessions[0].exercises[0].sets.forEach(s=>s.weight=0);assert(g.h.app.coachingSummary(g.rec()).includes('bodyweight (0 kg)'));
 g.h.app.data.sessions[0].exercises[0].sets[1].weight=10;assert(g.h.app.coachingSummary(g.rec()).includes('listed set loads'));
 const low=fixture([[10,10,10]]);assert(!low.h.app.coachingSummary(low.rec({readiness:'low'})).includes('42.5'));assert(low.h.app.coachingSummary(low.rec({weekNumber:5})).includes('3–4 reps in reserve'));
});
test('Verdicts require three comparable workouts and separate planned deload from decline',()=>{
 const f=fixture();assert.equal(f.h.app.coachingVerdict(f.rec()).key,'improving');
 for(const values of [[[8,8,7]],[[8,8,7],[9,8,7]]]){const g=fixture(values);assert.equal(g.h.app.coachingVerdict(g.rec()).key,'baseline');}
 for(const values of [[[8,8,7],[8,8,7],[8,8,7]],[[10,10,10],[9,9,9],[8,8,8]]]){const g=fixture(values);assert.equal(g.h.app.coachingVerdict(g.rec()).key,'attention');}
 const held=fixture([[8,8,7],[9,8,7],[8,9,7]]);assert.equal(held.h.app.coachingVerdict(held.rec()).key,'holding');assert.equal(f.h.app.coachingVerdict(f.rec({weekNumber:5})).key,'deload');assert.equal(f.h.app.coachingVerdict(f.rec({readiness:'low'})).key,'holding');
});
test('Changed prescriptions, load changes, incomplete sets, stale and lower-readiness history reset verdicts',()=>{
 for(const change of [f=>f.ex.tempo='slow',f=>f.h.app.data.sessions.at(-2).exercises[0].sets.forEach(s=>s.weight=35),f=>f.h.app.data.sessions.at(-2).exercises[0].sets[0].completed=false,f=>f.h.app.data.sessions.forEach(s=>s.date='2026-08-01'),f=>f.h.app.data.sessions.at(-2).readiness='low']){const f=fixture();change(f);assert.equal(f.h.app.coachingVerdict(f.rec()).key,'baseline');}
});
test('Weekly review counts movements once while exposing distinct day prescriptions and attention priority',()=>{
 const h=boot(script),slots=h.app.data.program.flatMap(day=>day.exercises.filter(e=>e.name==='Dumbbell Shoulder Press').map(ex=>({day,ex})));
 h.app.data.sessions=slots.flatMap(({day,ex},slot)=>[0,1,2].map(i=>({id:slot+'-'+i,date:'2026-10-19',startedAt:i*2+slot,dayId:day.id,dayName:day.name,weekNumber:1,phase:'Calibration',exercises:[{exerciseId:ex.id,name:ex.name,definition:clone(ex),sets:Array.from({length:ex.sets},()=>({weight:20,reps:slot?9:7+i,completed:true}))}]})));
 const review=h.app.weeklyCoachingReview(1);assert.equal(review.movements.length,1);assert.equal(review.movements[0].slots.length,2);assert.equal(review.counts.attention,1);assert.equal(review.counts.improving,0);assert(review.focus.includes(slots[1].day.name));
});
test('Review counts only finished lifting through today, includes legacy/removed movements without invented trends',()=>{
 const f=fixture(),a=f.h.app;a.data.sessions.push({...clone(a.data.sessions[0]),id:'rest',exercises:[]},{...clone(a.data.sessions[0]),id:'future',date:'2026-10-21'});a.startSession(0);
 assert.equal(a.weeklyCoachingReview(1).movements.length,1);a.data.program[0].exercises.shift();const review=a.weeklyCoachingReview(1);assert.equal(review.counts.baseline,1);assert.equal(review.movements[0].slots.length,0);
 a.data.sessions.forEach(s=>s.date='2026-10-18');assert.equal(a.weeklyCoachingReview(1).movements.length,0);
});
test('Week boundaries use calendar Monday; earlier workouts can supply trend evidence without adding old movements',()=>{
 const f=fixture();f.h.app.data.sessions[0].date='2026-10-17';f.h.app.data.sessions[1].date='2026-10-18';const r=f.h.app.weeklyCoachingReview(1);assert.equal(r.start,'2026-10-19');assert.equal(r.counts.improving,1);
});
test('History correction, deletion and Undo immediately refresh weekly verdicts',()=>{
 const f=fixture(),a=f.h.app;assert.equal(a.weeklyCoachingReview(1).counts.improving,1);const original=a.data.sessions.at(-1),draft=clone(original);draft.exercises[0].sets.forEach(s=>s.reps=6);assert(a.saveHistoryEdit(original.id,draft,JSON.stringify(original)));assert.equal(a.weeklyCoachingReview(1).counts.improving,0);a.deleteWorkout(original.id);assert.equal(a.weeklyCoachingReview(1).counts.baseline,1);a.undoDeleteWorkout();assert.equal(a.weeklyCoachingReview(1).counts.improving,0);
});
test('Rendering is read-only, escapes names and obeys the coaching visibility preference',()=>{
 const f=fixture(),a=f.h.app;a.data.program[0].exercises[0].name='<img src=x>';a.data.program[0].exercises[0].currentDisplay='<img src=x>';a.data.sessions.forEach(s=>s.exercises[0].name='<img src=x>');a.save();const raw=f.h.records.get('htData_v1'),before=JSON.stringify(a.data);const html=a.renderHome(1,{name:'Calibration'});assert(html.includes('&lt;img src=x&gt;'));assert(html.includes('weeklyReview'));a.renderProgress();assert.equal(JSON.stringify(a.data),before);assert.equal(f.h.records.get('htData_v1'),raw);a.data.dashboard={showCoaching:false};assert(!a.renderHome(1,{name:'Calibration'}).includes('weeklyReview'));
});
test('Train puts a concise target before inputs and full evidence inside a closed native disclosure',()=>{
 const f=fixture();f.h.app.startSession(0);const html=f.h.app.renderActiveSession();assert(html.indexOf('coach-goal')<html.indexOf('class="setlabels"'));assert(html.includes('<details class="coach-explanation"><summary>Why this target?'));assert(!html.includes('<details class="coach-explanation" open'));assert(html.includes('Last time ('));
});
console.log(count+' coaching clarity checks passed');
