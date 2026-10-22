/* ============================= HELPERS ============================= */
function fmtDate(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
function fmtDateFull(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
}
function findExercise(exId){
  for(const day of DATA.program){
    for(const ex of day.exercises){ if(ex.id===exId) return ex; }
  }
  return null;
}
function findDayByIdx(idx){ return DATA.program[idx]; }
function getWeekNumber(){
  // Compare local calendar dates at UTC midnight so daylight-saving changes
  // cannot move an exact training week back by a day.
  const start = new Date(DATA.programStartDate+'T00:00:00Z');
  const now = new Date(todayISO()+'T00:00:00Z');
  const diffDays = Math.floor((now-start)/86400000);
  const wk = Math.floor(diffDays/7)+1;
  return Math.max(1, wk>8 ? ((wk-1)%8)+1 : wk); // cycle after week 8
}
function getPhase(weekNum){
  for(const p of PHASES){ if(weekNum>=p.weeks[0] && weekNum<=p.weeks[1]) return p; }
  return PHASES[0];
}
function getNextProgramIndex(){
  const completed=DATA.sessions.filter(s=>s.date<=todayISO());
  if(!completed.length){
    const first = DATA.program.findIndex(d=>d.type==='training');
    return first>=0 ? first : 0;
  }
  const sessions = completed.slice().sort((a,b)=>{
    const dc = String(a.date||'').localeCompare(String(b.date||''));
    if(dc!==0) return dc;
    return Number(a.startedAt||0)-Number(b.startedAt||0);
  });
  const last = sessions[sessions.length-1];
  const lastIdx = DATA.program.findIndex(d=>d.id===last.dayId);
  return lastIdx<0 ? 0 : (lastIdx+1)%DATA.program.length;
}
function getTodayProgramDay(){ return getNextProgramIndex(); }
function estOneRM(weight,reps){
  if(!weight||!reps) return 0;
  return weight*(1+reps/30);
}
// A programme slot owns its prescription; a movement name owns shared records.
// Exact normalised names only: never merge equipment or movement variants fuzzily.
function movementKey(name){return String(name).trim().replace(/\s+/g,' ').toLowerCase();}
function allCompletedSetsFor(exId,displayName=null){
  const out = [];
  for(const s of DATA.sessions){
    const logs=s.exercises.filter(e=>displayName===null?e.exerciseId===exId:movementKey(e.name)===movementKey(displayName));
    for(const exLog of logs)exLog.sets.forEach((st,i)=>{
      if(usablePreviousSet(st)){
        out.push({date:s.date,startedAt:s.startedAt,sessionId:s.id,dayName:s.dayName,exerciseId:exLog.exerciseId,weight:st.weight,reps:st.reps,setIndex:i});
      }
    });
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date) || a.startedAt-b.startedAt || String(a.sessionId).localeCompare(String(b.sessionId)) || a.setIndex-b.setIndex);
}
function getPRFor(exId,displayName=null){
  const sets = allCompletedSetsFor(exId,displayName);
  if(!sets.length) return null;
  let heaviest = sets[0], bestE1RM = sets[0];
  const byWeight = {};
  sets.forEach(s=>{
    if(s.weight>heaviest.weight || (s.weight===heaviest.weight && s.reps>heaviest.reps)) heaviest=s;
    const e = estOneRM(s.weight,s.reps);
    if(e>estOneRM(bestE1RM.weight,bestE1RM.reps) || (e===estOneRM(bestE1RM.weight,bestE1RM.reps) && s.reps>bestE1RM.reps)) bestE1RM=s;
    if(!byWeight[s.weight] || s.reps>byWeight[s.weight].reps) byWeight[s.weight]=s;
  });
  return {heaviest, bestE1RM, byWeight, all:sets};
}
function usablePreviousSet(set){
  return !!set && set.completed && Number.isFinite(set.weight) && set.weight>=0 &&
    Number.isInteger(set.reps) && set.reps>0;
}
function lastSessionFor(exId, displayName=null){
  // Date alone cannot distinguish two workouts logged on the same day.
  const sessions=DATA.sessions.filter(s=>s.date<=todayISO()).sort((a,b)=>
    a.date.localeCompare(b.date) || (a.startedAt||0)-(b.startedAt||0));
  for(let i=sessions.length-1;i>=0;i--){
    const session=sessions[i];
    const log=session.exercises.find(e=>e.exerciseId===exId &&
      (displayName===null || e.name===displayName));
    if(log && log.sets.some(usablePreviousSet)) return {session,log};
  }
  return null;
}
function exerciseIndexPath(exId){
  for(let di=0; di<DATA.program.length; di++){
    const ei = DATA.program[di].exercises.findIndex(e=>e.id===exId);
    if(ei>-1) return {di,ei};
  }
  return null;
}
