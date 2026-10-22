'use strict';
const assert=require('node:assert/strict');
const {boot,script}=require('./regression.cjs');
let count=0;
const clone=x=>JSON.parse(JSON.stringify(x));
function test(name,fn){fn();count++;console.log('PASS '+name);}
function setup(){
 const h=boot(script),slots=h.app.data.program.flatMap(day=>day.exercises.filter(e=>e.name==='Dumbbell Shoulder Press').map(ex=>({day,ex})));
 const make=(id,slot,weight,reps,date='2026-10-19')=>({id,date,startedAt:Number(id),dayId:slot.day.id,dayName:slot.day.name,weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:slot.ex.id,name:slot.ex.name,definition:clone(slot.ex),notes:'',sets:[{weight,reps,completed:true}]}]});
 h.app.data.sessions=[make('1',slots[0],20,8),make('2',slots[1],22,10)];h.app.save();return {h,slots,make};
}
const prefs={name:'Guy',weeklyGoal:5,showBodyweight:true,showNutrition:true,showCoaching:true};
test('Same movement across days shares one chart/record while targets and saved slot IDs remain separate',()=>{
 const {h,slots}=setup(),before=JSON.stringify(h.app.data),raw=h.records.get('htData_v1');
 const group=h.app.progressExercises().filter(e=>e.name==='Dumbbell Shoulder Press');assert.equal(group.length,1);assert.equal(group[0].slots.length,2);
 const rows=h.app.exerciseProgress(slots[0].ex.id,slots[0].ex.name);assert.equal(rows.length,2);assert.equal(rows[1].load,22);assert.equal(h.app.getPRFor(slots[0].ex.id,slots[0].ex.name).heaviest.weight,22);
 h.app.progressSelection=group[0].key;const html=h.app.renderProgress();assert(html.includes('3 × 6–10'));assert(html.includes('3 × 8–12'));assert(html.includes(slots[0].day.name));assert(html.includes(slots[1].day.name.replace(/&/g,'&amp;')));
 assert.equal(h.app.lastSessionFor(slots[0].ex.id,slots[0].ex.name).log.sets[0].weight,20);assert.equal(JSON.stringify(h.app.data),before);assert.equal(h.records.get('htData_v1'),raw);
});
test('Case and spacing match without merging genuine equipment/variation names',()=>{
 const {h,slots,make}=setup();h.app.data.sessions.push(make('3',slots[0],24,8));h.app.data.sessions.at(-1).exercises[0].name='  DUMBBELL   shoulder press  ';
 assert.equal(h.app.exerciseProgress(slots[0].ex.id,slots[0].ex.name).length,3);
 h.app.data.sessions.push(make('4',slots[0],99,8));h.app.data.sessions.at(-1).exercises[0].name='Machine Shoulder Press';assert.equal(h.app.exerciseProgress(slots[0].ex.id,slots[0].ex.name).length,3);assert.equal(h.app.getPRFor(slots[0].ex.id,slots[0].ex.name).heaviest.weight,24);
});
test('Multiple matching entries in one session count once as a workout and retain all valid sets',()=>{
 const {h,slots}=setup();h.app.data.sessions[0].exercises.push({...clone(h.app.data.sessions[1].exercises[0]),sets:[{weight:25,reps:8,completed:true},{weight:999,reps:99,completed:false}]});
 const rows=h.app.exerciseProgress(slots[0].ex.id,slots[0].ex.name);assert.equal(rows.length,2);assert.equal(rows[0].sets.length,2);assert.equal(rows[0].volume,360);
});
test('Shared History PRs, corrections, deletion and Undo agree across slot IDs',()=>{
 const {h,slots}=setup();h.app.data.sessions[1].exercises[0].sets[0]={weight:18,reps:8,completed:true};assert.deepEqual(h.app.rebuildHistory(h.app.data.sessions).map(s=>s.newPRs.length),[1,0]);
 const source=h.app.data.sessions[1],draft=clone(source);draft.exercises[0].sets[0].weight=30;assert(h.app.saveHistoryEdit(source.id,draft,JSON.stringify(source)));assert.equal(h.app.getPRFor(slots[0].ex.id,slots[0].ex.name).heaviest.weight,30);
 h.app.deleteWorkout(source.id);assert.equal(h.app.exerciseProgress(slots[0].ex.id,slots[0].ex.name).length,1);h.app.undoDeleteWorkout();assert.equal(h.app.getPRFor(slots[0].ex.id,slots[0].ex.name).heaviest.weight,30);
});
test('Weekly summary excludes rest, active, future and incomplete sets and ignores saved counters',()=>{
 const {h,slots,make}=setup();h.app.data.sessions[0].totalSets=999;h.app.data.sessions.push({...make('3',slots[0],99,99),exercises:[]},make('4',slots[0],99,99,'2026-10-21'));h.app.startSession(0);
 assert.deepEqual(h.app.dashboardSummary(),{date:'2026-10-19',workouts:2,sets:2,reps:18,volume:380});
});
test('Home prioritises recovered active workout and rendering never writes state',()=>{
 const {h}=setup();h.app.startSession(0);const raw=h.records.get('htData_v1');const html=h.app.renderHome(1,{name:'Calibration'});assert(html.includes('Continue workout'));assert(!html.includes('>Start Workout<'));assert.equal(h.records.get('htData_v1'),raw);
});
test('Personalisation roundtrips independently of history, active workout, programme and measurements',()=>{
 const {h}=setup();h.app.startSession(0);const before=clone(h.app.data);assert(h.app.saveDashboardPreferences(prefs));const recovered=boot(script,{'htData_v1':h.records.get('htData_v1')});assert.deepEqual(recovered.app.dashboardPreferences(),prefs);
 for(const key of ['sessions','activeSession','program','nutrition','bodyweight'])assert.deepEqual(h.app.data[key],before[key]);assert(h.app.renderHome(1,{name:'Calibration'}).includes('Welcome, Guy'));
});
test('Blank preferences and older backups load without a migration write',()=>{
 const {h}=setup();delete h.app.data.dashboard;h.app.save();const raw=h.records.get('htData_v1'),recovered=boot(script,{'htData_v1':raw});assert.equal(recovered.records.get('htData_v1'),raw);assert.equal(recovered.app.dashboardPreferences().weeklyGoal,null);assert.equal(recovered.app.dashboardPreferences().showNutrition,true);
});
test('Invalid preferences and malformed imports cannot alter saved data',()=>{
 const {h}=setup(),raw=h.records.get('htData_v1');for(const bad of [{weeklyGoal:1.5},{weeklyGoal:0},{weeklyGoal:15},{name:'x'.repeat(61)},{showNutrition:'yes'}]){assert.equal(h.app.saveDashboardPreferences({...prefs,...bad}),false);assert.throws(()=>h.app.validateData({...h.app.data,dashboard:{...prefs,...bad}}));}assert.equal(h.records.get('htData_v1'),raw);
});
test('Quota failures and stale tabs retain previous preferences and data',()=>{
 const {h}=setup();assert(h.app.saveDashboardPreferences(prefs));const raw=h.records.get('htData_v1');h.state.writeFailure=true;assert.equal(h.app.saveDashboardPreferences({...prefs,name:'Changed'}),false);assert.equal(h.app.data.dashboard.name,'Guy');assert.equal(h.records.get('htData_v1'),raw);
 h.state.writeFailure=false;h.records.set('htData_v1',raw+' ');assert.equal(h.app.saveDashboardPreferences({...prefs,name:'Changed'}),false);assert.equal(h.app.data.dashboard.name,'Guy');
});
test('Hidden summaries and escaped names render safely; only real coaching evidence surfaces',()=>{
 const {h}=setup();assert(h.app.saveDashboardPreferences({...prefs,name:'<img src=x>',showBodyweight:false,showNutrition:false,showCoaching:false}));const html=h.app.renderHome(1,{name:'Calibration'});assert(html.includes('&lt;img src=x&gt;'));assert(!html.includes("Today's Nutrition"));assert(!html.includes('<div class="label">Bodyweight</div>'));assert(!html.includes('homeCoaching'));
 h.app.startSession(0);h.app.setWorkoutReadiness('low');assert(h.app.renderDashboardCoaching(h.app.data.program[0],1).includes('Lower readiness today'));
});
test('Knee reminders wait until the following day and refer to the actual workout date',()=>{
 const {h}=setup();h.app.data.pendingNextMorning={sessionId:'1',dayName:'Lower A',date:'2026-10-20'};assert(!h.app.renderHome(1,{name:'Calibration'}).includes('Knee check-in needed'));h.app.data.pendingNextMorning.date='2026-10-18';const html=h.app.renderHome(1,{name:'Calibration'});assert(html.includes('Knee check-in needed'));assert(!html.includes('yesterday'));
});
test('Measurement save failures preserve data and inputs for retry',()=>{
 const {h}=setup();h.element('bwInput').value='74.2';h.element('calInput').value='2500';h.element('proInput').value='160';const raw=h.records.get('htData_v1');h.state.writeFailure=true;h.app.logBodyweight();h.app.logNutrition();assert.equal(h.app.data.bodyweight.length,0);assert.equal(h.app.data.nutrition.length,0);assert.equal(h.records.get('htData_v1'),raw);assert.equal(h.element('bwInput').value,'74.2');h.state.writeFailure=false;h.app.logBodyweight();h.app.logNutrition();assert.equal(h.app.data.bodyweight[0].weight,74.2);assert.equal(h.app.data.nutrition[0].protein,160);
});
console.log(count+' Phase 7 dashboard/shared movement checks passed');
