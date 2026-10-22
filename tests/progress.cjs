'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let count=0;
function test(name,fn){fn();console.log('PASS '+name);count++;}
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const h=boot(script),ex=h.app.data.program[0].exercises[0];
 const session=(id,date,time,sets,name=ex.name)=>({id,date,startedAt:time,dayId:h.app.data.program[0].id,dayName:'Upper A',weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name,notes:'',sets}]});
 const set=(weight,reps,completed=true)=>({weight,reps,completed});
 h.app.data.sessions=[session('z-old','2026-10-19',100,[set(30,10),set(25,12)]),session('a-new','2026-10-19',200,[set(35,8),set(30,10),set(999,99,false)]),session('variant','2026-10-20',300,[set(100,10)],'Different press')];h.app.save();return {h,ex,session,set};
}
test('Latest and previous metrics compare whole workouts in chronological order, not adjacent sets or IDs',()=>{
 const {h,ex}=fixture(),rows=h.app.exerciseProgress(ex.id,ex.name);assert.deepEqual(rows.map(r=>r.sessionId),['z-old','a-new']);assert.equal(rows[1].best.weight,35);assert.equal(rows[0].best.weight,30);assert.equal(rows[1].volume,580);assert.equal(rows[1].sets.length,2);assert.equal(rows[1].reps,10);
 const html=h.app.renderProgress();assert(html.includes('35 kg × 8'));assert(html.includes('30 kg × 10'));
});
test('Variations remain separate and removed exercises retain charts and records',()=>{
 const {h,ex}=fixture();assert.equal(h.app.exerciseProgress(ex.id,'Different press').length,1);assert.equal(h.app.getPRFor(ex.id,ex.name).heaviest.weight,35);
 h.app.data.program[0].exercises=[];const archived=h.app.progressExercises().find(e=>e.id===ex.id && e.name===ex.name);assert(archived && !archived.current);h.app.progressSelection=archived.key;assert(h.app.renderProgress().includes('Historical variation / removed exercise'));assert.equal(h.app.allExercisePRs().length,2);
});
test('Heaviest record chooses the most reps at that load, including bodyweight zero',()=>{
 const {h,ex,set}=fixture();h.app.data.sessions[0].exercises[0].sets=[set(35,5),set(35,12)];assert.equal(h.app.getPRFor(ex.id,ex.name).heaviest.reps,12);
 h.app.data.sessions.forEach(s=>s.exercises[0].sets=[set(0,s.id==='a-new'?20:10)]);assert.equal(h.app.getPRFor(ex.id,ex.name).heaviest.weight,0);assert.equal(h.app.getPRFor(ex.id,ex.name).bestE1RM.reps,20);assert.equal(h.app.exerciseProgress(ex.id,ex.name)[1].e1rm,null);
});
test('Invalid and incomplete sets never inflate exercise or training analytics',()=>{
 const {h,ex,set}=fixture();h.app.data.sessions[0].exercises[0].sets=[set(30,0),set(20,1.5),set(-1,10),set(999,99,false),set(0,15)];const row=h.app.exerciseProgress(ex.id,ex.name)[0];assert.equal(row.totalReps,15);assert.equal(row.volume,0);assert.equal(row.sets.length,1);
});
test('Date ranges include the boundary day, exclude older and future logs, and do not alter all-time PRs',()=>{
 const {h,ex,session,set}=fixture();h.app.data.sessions=[session('old','2026-09-20',1,[set(90,10)]),session('edge','2026-09-21',2,[set(40,10)]),session('future','2026-10-21',3,[set(100,10)])];
 assert.equal(h.app.progressCutoff('30'),'2026-09-21');assert.deepEqual(h.app.exerciseProgress(ex.id,ex.name,'30').map(r=>r.sessionId),['edge']);assert.equal(h.app.getPRFor(ex.id,ex.name).heaviest.weight,100);
});
test('Weekly training excludes rest and active sessions, fills missing weeks and derives counters from sets',()=>{
 const {h,session,set}=fixture();h.app.data.sessions=[session('a','2026-09-28',1,[set(30,10)]),session('b','2026-10-19',2,[set(40,8)])];h.app.data.sessions[0].totalVolume=999999;h.app.data.sessions.push({...session('rest','2026-10-20',3,[]),exercises:[]});h.app.startSession(0);
 const weeks=h.app.weeklyTraining('all');assert.deepEqual(weeks.map(w=>w.volume),[300,0,0,320]);assert.equal(weeks.reduce((n,w)=>n+w.workouts,0),2);
});
test('Calendar bodyweight weeks handle DST, unordered dates and duplicate daily entries',()=>{
 const {h}=fixture();const weeks=h.app.weeklyBodyweight([{date:'2026-03-30',weight:74},{date:'2026-03-23',weight:70},{date:'2026-03-29',weight:72},{date:'2026-03-23',weight:71}]);assert.deepEqual(weeks.map(w=>w.date),['2026-03-23','2026-03-30']);assert.equal(weeks[0].avg,71.5);assert.equal(weeks[0].count,2);assert.equal(weeks[1].avg,74);
});
test('Weekly bodyweight rate accounts for missing weeks without manufacturing weigh-ins',()=>{
 const {h}=fixture(),weeks=h.app.weeklyBodyweight([{date:'2026-10-05',weight:73},{date:'2026-10-19',weight:74}]);assert.equal(h.app.bodyweightWeeklyRate(weeks),.5);assert.equal(h.app.bodyweightWeeklyRate(weeks.slice(0,1)),null);assert.equal(weeks.length,2);
});
test('Filtering or deleting the selected programme exercise cannot crash Progress',()=>{
 const {h}=fixture();h.app.progressSelection='removed-id';assert.doesNotThrow(()=>h.app.renderProgress());h.app.progressSearch='not a real exercise';assert(h.app.renderProgress().includes('No exercises match'));h.app.data.sessions=[];h.app.data.program.forEach(d=>d.exercises=[]);h.app.progressSearch='';assert.doesNotThrow(()=>h.app.renderProgress());
});
test('Charts render empty, single-point and flat series without NaN and escape labels',()=>{
 const {h}=fixture();for(const rows of [[],[{date:'2026-10-19',value:0}],[{date:'2026-10-19',value:30},{date:'2026-10-20',value:30}]]){const html=h.app.renderSparkline(rows,{label:'"<bad>'});assert(!html.includes('NaN'));assert(!html.includes('aria-label=""<bad>'));}
});
test('Viewing analytics leaves saved history, active workout, programme and measurements byte-for-byte unchanged',()=>{
 const {h}=fixture();h.app.startSession(0);h.app.data.bodyweight=[{date:'2026-10-19',weight:73}];h.app.save();const raw=h.records.get('htData_v1'),before=JSON.stringify(h.app.data);h.app.renderProgress();h.app.progressRange='30';h.app.renderProgress();assert.equal(h.records.get('htData_v1'),raw);assert.equal(JSON.stringify(h.app.data),before);
});
test('History corrections and deletion/Undo immediately refresh exercise series and PRs',()=>{
 const {h,ex}=fixture(),original=h.app.data.sessions[1],draft=clone(original);draft.exercises[0].sets[0].weight=40;assert(h.app.saveHistoryEdit(original.id,draft,JSON.stringify(original)));assert.equal(h.app.exerciseProgress(ex.id,ex.name).at(-1).load,40);h.app.deleteWorkout(original.id);assert.equal(h.app.getPRFor(ex.id,ex.name).heaviest.weight,30);h.app.undoDeleteWorkout();assert.equal(h.app.getPRFor(ex.id,ex.name).heaviest.weight,40);
});
console.log(count+' Phase 4 progress checks passed');
