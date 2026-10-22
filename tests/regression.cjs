'use strict';
const fs=require('node:fs');
const path=require('node:path');

function boot(script, initial={}){
  const elements=new Map(),records=new Map(Object.entries(initial)),listeners={};
  const state={writeFailure:false,readFailure:false,confirm:true,alerts:[],clock:Date.parse('2026-10-20T12:00:00Z')};
  let uuid=0;
  function element(id){
    if(!elements.has(id)) elements.set(id,{id,value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},
      classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){this[type]=fn;},
      appendChild(){},remove(){},click(){},querySelectorAll(){return [];}});
    return elements.get(id);
  }
  const document={actions:[],querySelector(){return null;},getElementById:id=>['exSearch','exSelect','histSearch','editDaySelect','importFile','restoreBackupBtn','calInput','proInput','bwInput','workoutNotes','dayEditorList'].includes(id)?elements.get(id)||null:element(id),querySelectorAll(q){return q==='[data-action]'?this.actions:[];},
    createElement:()=>element('created-'+(++uuid)),head:element('head'),body:element('body'),
    addEventListener(type,fn){listeners[type]=fn;},visibilityState:'visible'};
  const window={scrollTo(){},addEventListener(type,fn){listeners[type]=fn;}};
  const localStorage={getItem(k){if(state.readFailure)throw Error('Storage unavailable');return records.get(k)??null;},
    setItem(k,v){if(state.writeFailure){const e=Error('full');e.name='QuotaExceededError';throw e;}records.set(k,String(v));},
    removeItem(k){records.delete(k);}};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[state.clock]));} static now(){return state.clock;}}
  class Reader{readAsText(file){this.onload({target:{result:file.content}});}}
  const prefix="Object.defineProperty(window,'computeRecommendation',{get:()=>computeRecommendation,set:v=>computeRecommendation=v});\n";
  const suffix="\nreturn {get data(){return DATA;},set data(v){DATA=v;},get blocked(){return storageBlocked;},get unsaved(){return unsavedChanges;},get timer(){return restTimerState;},get tab(){return currentTab;},defaultData,validateData,save,commitData,load,restoreBackup,deleteWorkout,undoDeleteWorkout,startSession,startRestDay,logRestDay,updateSetField,toggleSetComplete,finishWorkoutFlow,startRestTimer,updateRestTimerFromClock,stopRestTimer,attachTabEvents,importData,renderHistory,renderActiveSession,computeRecommendation,getCoachingPrescription,getWeekNumber,lastSessionFor,addWorkoutSet,removeWorkoutSet,useLastSession,swapWorkoutExercise,openExerciseEditModal,rebuildHistory,saveHistoryEdit,openHistoryEditor,openSessionDetail,set historyQuery(value){historyFilterQuery=value;},progressExercises,exerciseProgress,weeklyTraining,dailyBodyweight,weeklyBodyweight,bodyweightWeeklyRate,progressCutoff,renderProgress,renderSparkline,getPRFor,allExercisePRs,set progressRange(value){progressRange=value;},set progressSelection(value){selectedProgressExId=value;},set progressSearch(value){exerciseFilterQuery=value;},moveProgrammeDay,duplicateProgrammeDay,deleteProgrammeDay,saveProgrammeDay,moveProgrammeExercise,deleteProgrammeExercise,duplicateProgrammeExercise,saveProgrammeExercise,openProgrammeDayModal,renderDayEditor,setWorkoutReadiness,setExerciseEffort,coachingEvidence};";
  const app=new Function('document','window','localStorage','alert','confirm','navigator','setInterval','clearInterval',
    'setTimeout','Date','crypto','FileReader','Blob','URL',prefix+script+suffix)(
    document,window,localStorage,m=>state.alerts.push(m),()=>state.confirm,{vibrate(){}},()=>1,()=>{},()=>1,Clock,
    {randomUUID:()=>String(++uuid)},Reader,globalThis.Blob||function(){},{createObjectURL:()=>'',revokeObjectURL(){}});
  return {app,state,records,document,elements,listeners,element};
}

function regressionTests(script){
  const results=[];
  const assert=(condition,message)=>{if(!condition) throw Error(message);};
  const test=(name,run)=>{try{run();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}};
  const key='htData_v1';
  const completed=(app,id='done')=>({
    id,date:'2026-10-19',startedAt:1,dayId:app.data.program[0].id,dayName:app.data.program[0].name,
    weekNumber:1,phase:'Calibration',exercises:[{exerciseId:app.data.program[0].exercises[0].id,
      name:'Incline Dumbbell Press',notes:'',sets:[{weight:30,reps:10,completed:true}]}],
    kneePain:{before:null,after:null,nextMorning:null},notes:'',totalSets:1,totalReps:10,totalVolume:300
  });
  test('Fresh data validates and saves',()=>{
    const h=boot(script);assert(h.app.save(),'save failed');assert(JSON.parse(h.records.get(key)).program.length>0,'programme missing');
  });
  test('Corrupt primary data is preserved and writes are blocked',()=>{
    const h=boot(script,{[key]:'{broken'});assert(h.app.blocked,'not blocked');assert(!h.app.save(),'write allowed');
    assert(h.records.get(key)==='{broken','corrupt data overwritten');
  });
  test('Invalid backup structure is rejected',()=>{
    const h=boot(script);for(const value of [{},null,{...h.app.data,sessions:{}},{...h.app.data,program:[]}]){
      let rejected=false;try{h.app.validateData(value);}catch(e){rejected=true;}assert(rejected,'invalid backup accepted');
    }
  });
  test('Legacy rest sessions normalize',()=>{
    const h=boot(script);const d=h.app.defaultData();d.sessions=[{...completed(h.app),exercises:[]}];delete d.sessions[0].kneePain;
    assert(h.app.validateData(d).sessions[0].kneePain.after===null,'legacy knee data missing');
  });
  test('Deletion uses ID, clears reminder, persists and supports Undo',()=>{
    const h=boot(script);h.app.data.sessions=[completed(h.app,'a'),completed(h.app,'b')];
    h.app.data.pendingNextMorning={sessionId:'a',dayName:'Upper A',date:'2026-10-19'};assert(h.app.save(),'setup');
    h.app.deleteWorkout('a');assert(h.app.data.sessions.length===1&&h.app.data.sessions[0].id==='b','wrong deletion');
    assert(h.app.data.pendingNextMorning===null,'dangling reminder');h.app.undoDeleteWorkout();
    assert(h.app.data.sessions.map(s=>s.id).join(',')==='a,b','undo order');
    assert(h.app.data.pendingNextMorning.sessionId==='a','undo reminder');
    assert(JSON.parse(h.records.get(key)).sessions.length===2,'undo not durable');
  });
  test('Cancelled deletion changes nothing',()=>{
    const h=boot(script);h.app.data.sessions=[completed(h.app)];h.app.save();h.state.confirm=false;h.app.deleteWorkout('done');
    assert(h.app.data.sessions.length===1,'cancel ignored');
  });
  test('Failed deletion retains workout and reports unsaved data',()=>{
    const h=boot(script);h.app.data.sessions=[completed(h.app)];h.app.save();h.state.writeFailure=true;h.app.deleteWorkout('done');
    assert(h.app.data.sessions.length===1,'session lost');assert(h.app.unsaved,'no warning');
    assert(h.element('saveStatus').textContent.includes('full'),'storage failure hidden');
  });
  test('Stale tab cannot overwrite newer storage',()=>{
    const h=boot(script);h.app.save();const newer={...h.app.data,sessions:[completed(h.app)]};h.records.set(key,JSON.stringify(newer));
    assert(!h.app.save(),'stale write accepted');assert(JSON.parse(h.records.get(key)).sessions.length===1,'new data overwritten');
  });
  test('Read errors do not overwrite data',()=>{
    const h=boot(script);h.app.save();const raw=h.records.get(key);h.state.readFailure=true;
    assert(!h.app.save(),'read failure accepted');assert(h.records.get(key)===raw,'data changed');
  });
  test('Workout notes save immediately and recover',()=>{
    const h=boot(script);h.app.startSession(0);const node={dataset:{action:'workoutNotes'},value:'Felt strong'};
    h.document.actions=[node];h.app.attachTabEvents();node.oninput();
    const recovered=boot(script,{[key]:h.records.get(key)});
    assert(recovered.app.data.activeSession.notes==='Felt strong','notes lost');assert(recovered.app.tab==='train','did not resume');
  });
  test('Invalid completed sets are refused',()=>{
    const h=boot(script);h.app.startSession(0);const id=h.app.data.activeSession.exercises[0].exerciseId;
    h.app.toggleSetComplete(id,0,true);assert(!h.app.data.activeSession.exercises[0].sets[0].completed,'empty completed');
    h.app.updateSetField(id,0,'weight',30);h.app.updateSetField(id,0,'reps',1.5);
    assert(h.app.data.activeSession.exercises[0].sets[0].reps===null,'fractional reps allowed');
  });
  test('Valid completion starts rest and bodyweight zero is retained',()=>{
    const h=boot(script);h.app.startSession(0);const id=h.app.data.activeSession.exercises[0].exerciseId;
    h.app.updateSetField(id,0,'weight',0);h.app.updateSetField(id,0,'reps',10);h.app.toggleSetComplete(id,0,true);
    assert(h.app.timer.running,'rest not started');assert(h.app.renderActiveSession().includes('value="0"'),'zero hidden');
  });
  test('Finish failure preserves active session, then retry finishes exactly once',()=>{
    const h=boot(script);h.app.startSession(0);const id=h.app.data.activeSession.exercises[0].exerciseId;
    h.app.updateSetField(id,0,'weight',30);h.app.updateSetField(id,0,'reps',10);h.app.toggleSetComplete(id,0,true);
    h.state.writeFailure=true;h.app.finishWorkoutFlow();assert(h.app.data.activeSession,'active cleared on failure');
    assert(h.app.data.sessions.length===0,'failed finish committed');h.state.writeFailure=false;h.app.finishWorkoutFlow();
    h.app.finishWorkoutFlow();assert(!h.app.data.activeSession&&h.app.data.sessions.length===1,'finish duplicated');
    assert(h.app.data.sessions[0].totalVolume===300,'wrong volume');
  });
  test('Rest timer uses clock after suspension and survives reload',()=>{
    const h=boot(script);h.app.startSession(0);h.app.startRestTimer(120);h.state.clock+=90000;h.app.updateRestTimerFromClock();
    assert(h.app.timer.remaining===30,'timer drift');
    const r=boot(script,{[key]:h.records.get(key)});assert(r.app.timer.running,'timer not restored');
    h.state.clock+=31000;h.app.updateRestTimerFromClock();assert(!h.app.timer.running,'timer did not finish');
  });
  test('Starting another day preserves unfinished workout',()=>{
    const h=boot(script);h.app.startSession(0);const id=h.app.data.activeSession.id;h.app.startSession(1);h.app.startRestDay();
    assert(h.app.data.activeSession.id===id,'active overwritten');
  });
  test('Rest day has zero summaries and persists',()=>{
    const h=boot(script);h.app.logRestDay();assert(h.app.data.sessions[0].totalSets===0,'undefined rest sets');
    assert(h.app.validateData(JSON.parse(h.records.get(key))).sessions.length===1,'rest not saved');
  });
  test('Invalid import does not replace existing data',()=>{
    const h=boot(script);h.app.startSession(0);const id=h.app.data.activeSession.id;
    h.app.importData({target:{files:[{content:'{"sessions":[]}'}],value:'x'}});
    assert(h.app.data.activeSession.id===id,'invalid import changed data');
  });
  test('Valid import repairs corrupt storage explicitly',()=>{
    const good=boot(script).app.defaultData();const h=boot(script,{[key]:'broken'});
    h.app.importData({target:{files:[{content:JSON.stringify(good)}],value:'x'}});
    assert(!h.app.blocked,'repair blocked');assert(JSON.parse(h.records.get(key)).program.length===good.program.length,'repair not saved');
  });
  test('Previous snapshot can be restored',()=>{
    const h=boot(script);h.app.save();h.app.startSession(0);
    assert(h.records.has(key+'_backup'),'no snapshot');h.app.restoreBackup();
    assert(h.app.data.activeSession===null,'restore did not use previous snapshot');
  });
  test('Native history escapes imported session IDs',()=>{
    const h=boot(script);h.app.data.sessions=[completed(h.app,'a" onclick="bad')];
    const html=h.app.renderHistory();assert(!html.includes('data-sid="a" onclick='),'ID injection');
    assert(html.includes('data-action="deleteWorkout"'),'native delete missing');
  });
  test('Coaching retains exact previous performance',()=>{
    const h=boot(script);const ex=h.app.data.program[0].exercises[0];
    const rec=h.app.computeRecommendation(ex,{sets:[{weight:30,reps:8,completed:true}]});
    assert(rec.detail.includes('30kg × 8'),'last performance missing');
  });
  test('Adding sets changes this workout only and survives reopening',()=>{
    const h=boot(script);h.app.startSession(0);
    const id=h.app.data.activeSession.exercises[0].exerciseId;
    const planned=h.app.data.program[0].exercises[0].sets;
    assert(h.app.addWorkoutSet(id),'add failed');
    assert(h.app.data.activeSession.exercises[0].sets.length===planned+1,'set not added');
    assert(h.app.data.program[0].exercises[0].sets===planned,'programme changed');
    const r=boot(script,{[key]:h.records.get(key)});
    assert(r.app.data.activeSession.exercises[0].sets.length===planned+1,'added set not recovered');
  });
  test('Removal preserves completed sets, requires confirmation for entered values and keeps one set',()=>{
    const h=boot(script);h.app.startSession(0);
    const log=h.app.data.activeSession.exercises[0],id=log.exerciseId;
    log.sets[log.sets.length-1]={weight:30,reps:8,completed:true};h.app.save();
    assert(!h.app.removeWorkoutSet(id),'completed set removed');
    h.app.data.activeSession.exercises[0].sets.at(-1).completed=false;h.app.save();h.state.confirm=false;
    assert(!h.app.removeWorkoutSet(id),'entered values removed without confirmation');
    h.state.confirm=true;assert(h.app.removeWorkoutSet(id),'confirmed removal failed');
    while(h.app.data.activeSession.exercises[0].sets.length>1) h.app.removeWorkoutSet(id);
    assert(!h.app.removeWorkoutSet(id),'last set removed');
  });
  test('Set changes roll back when storage is full',()=>{
    const h=boot(script);h.app.startSession(0);
    const log=h.app.data.activeSession.exercises[0],id=log.exerciseId,count=log.sets.length;
    h.state.writeFailure=true;
    assert(!h.app.addWorkoutSet(id),'failed add succeeded');
    assert(!h.app.removeWorkoutSet(id),'failed remove succeeded');
    assert(h.app.data.activeSession.exercises[0].sets.length===count,'failed edit changed sets');
  });
  test('Use last session fills only empty fields and never marks sets complete',()=>{
    const h=boot(script);h.app.startSession(0);
    const log=h.app.data.activeSession.exercises[0],id=log.exerciseId;
    const previous=completed(h.app);previous.exercises[0].sets=[
      {weight:0,reps:12,completed:true}, {weight:32.5,reps:9,completed:true}, {weight:50,reps:5,completed:false}];
    h.app.data.sessions=[previous];log.sets[1].weight=35;log.sets[2]={weight:25,reps:10,completed:true};h.app.save();
    assert(h.app.useLastSession(id),'copy failed');
    const sets=h.app.data.activeSession.exercises[0].sets;
    assert(sets[0].weight===0 && sets[0].reps===12 && !sets[0].completed,'zero weight lost or set completed');
    assert(sets[1].weight===35 && sets[1].reps===9,'entered weight overwritten');
    assert(sets[2].weight===25 && sets[2].reps===10 && sets[2].completed,'completed set changed');
    assert(!h.app.useLastSession(id),'copy repeated filled fields');
  });
  test('Copying previous performance skips incomplete historical sets and rolls back failed saves',()=>{
    const h=boot(script);h.app.startSession(0);
    const id=h.app.data.activeSession.exercises[0].exerciseId;
    const previous=completed(h.app);previous.exercises[0].sets.push({weight:50,reps:3,completed:false});
    h.app.data.sessions=[previous];h.app.save();h.state.writeFailure=true;
    assert(!h.app.useLastSession(id),'copy succeeded without saving');
    assert(h.app.data.activeSession.exercises[0].sets[0].weight===null,'failed copy changed data');
    h.state.writeFailure=false;assert(h.app.useLastSession(id),'retry failed');
    assert(h.app.data.activeSession.exercises[0].sets[1].weight===null,'unfinished historical set copied');
  });
  test('Previous workout lookup orders same-day sessions by start time and respects exercise variants',()=>{
    const h=boot(script),older=completed(h.app,'old'),newer=completed(h.app,'new');
    older.startedAt=100;newer.startedAt=200;newer.exercises[0].sets[0].weight=35;
    h.app.data.sessions=[newer,older];const id=older.exercises[0].exerciseId;
    assert(h.app.lastSessionFor(id).session.id==='new','same-day ordering incorrect');
    newer.exercises[0].name='Different exercise';
    assert(h.app.lastSessionFor(id,older.exercises[0].name).session.id==='old','different variation selected');
    assert(h.app.lastSessionFor(id,'Never logged')===null,'missing variation matched');
  });
  test('Coaching compares the preceding workout without treating an exercise log as a session wrapper',()=>{
    const h=boot(script),before=completed(h.app,'before'),latest=completed(h.app,'latest');
    before.startedAt=100;latest.startedAt=200;
    before.exercises[0].sets=Array.from({length:3},()=>({weight:30,reps:10,completed:true}));
    latest.exercises[0].sets=Array.from({length:3},()=>({weight:30,reps:7,completed:true}));
    h.app.data.sessions=[latest,before];
    const ex=h.app.data.program[0].exercises[0];
    const rec=h.app.computeRecommendation(ex,latest.exercises[0]);
    assert(rec.type==='maintain','preceding performance ignored');
    assert(rec.detail.includes('30 → 21'),'comparison used wrong workout');
    h.app.startSession(0);
    assert(h.app.renderActiveSession().includes('Use last session'),'repeat-session renderer failed');
  });
  return results;
}

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script defer src="\.\/([^"]+)"/g)].map(match=>match[1]);
if(!scripts.length) throw new Error('No app scripts found');
const script=scripts.map(file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8')).join('\n');
module.exports={boot,script};
if(require.main===module){
  const results=regressionTests(script);
  for(const r of results) console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.error?': '+r.error:''));
  if(results.some(r=>!r.pass)) process.exitCode=1;
}


