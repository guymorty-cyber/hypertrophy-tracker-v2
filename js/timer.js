function activateRestTimer(deadline,sec){
  stopRestTimer(false);
  restTimerState.total=sec;
  restTimerState.remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));
  restTimerState.endAt=deadline;
  restTimerState.running=true;
  document.getElementById('resttimer').classList.add('show');
  updateRestDisplay();
  restTimerState.interval=setInterval(updateRestTimerFromClock,250);
}
function startRestTimer(sec){
  if(!Number.isFinite(sec) || sec<0)return false;
  const deadline=Date.now()+sec*1000;
  if(!Number.isFinite(deadline) || !commitData({...DATA,restEndAt:deadline}))return false;
  activateRestTimer(deadline,sec);return true;
}
function extendRestTimer(){
  if(!restTimerState.running)return false;
  const deadline=restTimerState.endAt+30000;
  if(!commitData({...DATA,restEndAt:deadline}))return false;
  restTimerState.endAt=deadline;updateRestTimerFromClock();return true;
}
function updateRestTimerFromClock(){
  if(!restTimerState.running || !restTimerState.endAt) return;
  restTimerState.remaining = Math.max(0, Math.ceil((restTimerState.endAt - Date.now()) / 1000));
  updateRestDisplay();
  if(restTimerState.remaining <= 0){
    const wasRunning = restTimerState.running;
    // An expired deadline cannot restart on reopening, even if cleanup cannot save.
    if(!stopRestTimer())stopRestTimer(false);
    if(wasRunning && navigator.vibrate) navigator.vibrate([200,100,200]);
  }
}
function stopRestTimer(persistTimer=true){
  if(persistTimer && DATA.restEndAt && !commitData({...DATA,restEndAt:null}))return false;
  if(restTimerState.interval) clearInterval(restTimerState.interval);
  restTimerState.interval = null;
  restTimerState.running = false;
  restTimerState.endAt = null;
  document.getElementById('resttimer').classList.remove('show');
  return true;
}

document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') updateRestTimerFromClock();
});
window.addEventListener('pageshow', updateRestTimerFromClock);
window.addEventListener('focus', updateRestTimerFromClock);
function updateRestDisplay(){
  const m = Math.floor(Math.max(0,restTimerState.remaining)/60);
  const s = Math.max(0,restTimerState.remaining)%60;
  document.getElementById('rtTime').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
document.getElementById('rtAdd30').onclick=extendRestTimer;
document.getElementById('rtSkip').onclick = ()=> stopRestTimer();
