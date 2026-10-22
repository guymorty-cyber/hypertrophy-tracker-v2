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
  const start = new Date(DATA.programStartDate+'T00:00:00');
  const now = new Date(todayISO()+'T00:00:00');
  const diffDays = Math.floor((now-start)/86400000);
  const wk = Math.floor(diffDays/7)+1;
  return Math.max(1, wk>8 ? ((wk-1)%8)+1 : wk); // cycle after week 8
}
function getPhase(weekNum){
  for(const p of PHASES){ if(weekNum>=p.weeks[0] && weekNum<=p.weeks[1]) return p; }
  return PHASES[0];
}
function getNextProgramIndex(){
  if(!DATA.sessions.length){
    const first = DATA.program.findIndex(d=>d.type==='training');
    return first>=0 ? first : 0;
  }
  const sessions = DATA.sessions.slice().sort((a,b)=>{
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
function allCompletedSetsFor(exId){
  const out = [];
  for(const s of DATA.sessions){
    const exLog = s.exercises.find(e=>e.exerciseId===exId);
    if(!exLog) continue;
    exLog.sets.forEach((st,i)=>{
      if(st.completed && st.weight>0 && st.reps>0){
        out.push({date:s.date,sessionId:s.id,weight:st.weight,reps:st.reps,setIndex:i});
      }
    });
  }
  return out.sort((a,b)=> a.date<b.date?-1:1);
}
function getPRFor(exId){
  const sets = allCompletedSetsFor(exId);
  if(!sets.length) return null;
  let heaviest = sets[0], bestE1RM = sets[0];
  const byWeight = {};
  sets.forEach(s=>{
    if(s.weight>heaviest.weight) heaviest=s;
    const e = estOneRM(s.weight,s.reps);
    if(e> estOneRM(bestE1RM.weight,bestE1RM.reps)) bestE1RM=s;
    if(!byWeight[s.weight] || s.reps>byWeight[s.weight].reps) byWeight[s.weight]=s;
  });
  return {heaviest, bestE1RM, byWeight, all:sets};
}
function usablePreviousSet(set){
  return set.completed && Number.isFinite(set.weight) && set.weight>=0 &&
    Number.isInteger(set.reps) && set.reps>0;
}
function lastSessionFor(exId, displayName=null){
  // Date alone cannot distinguish two workouts logged on the same day.
  const sessions=DATA.sessions.slice().sort((a,b)=>
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
