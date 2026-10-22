function deleteWorkout(sid){
  const index=DATA.sessions.findIndex(s=>String(s.id)===String(sid));
  if(index<0) return;
  const session=DATA.sessions[index];
  if(!confirm('Delete '+session.dayName+' — '+fmtDate(session.date)+'? You can undo this deletion until you reload.')) return;
  const pending=DATA.pendingNextMorning && String(DATA.pendingNextMorning.sessionId)===String(sid)?DATA.pendingNextMorning:null;
  const candidate={...DATA,sessions:DATA.sessions.filter((s,i)=>i!==index),
    pendingNextMorning:pending?null:DATA.pendingNextMorning};
  if(!commitData(candidate)) return;
  deletedWorkout={session,index,pending};
  document.getElementById('undoPanel').hidden=false;
  renderTab();
}
function undoDeleteWorkout(){
  if(!deletedWorkout) return;
  const {session,index,pending}=deletedWorkout;
  if(DATA.sessions.some(s=>String(s.id)===String(session.id))) return;
  const sessions=DATA.sessions.slice();
  sessions.splice(Math.min(index,sessions.length),0,session);
  const candidate={...DATA,sessions,pendingNextMorning:DATA.pendingNextMorning||pending};
  if(!commitData(candidate)) return;
  deletedWorkout=null;
  document.getElementById('undoPanel').hidden=true;
  renderTab();
}
