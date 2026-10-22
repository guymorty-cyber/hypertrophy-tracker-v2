function startRestTimer(sec){
  stopRestTimer(false);
  restTimerState.total = sec;
  restTimerState.remaining = sec;
  restTimerState.endAt = Date.now() + (sec * 1000);
  restTimerState.running = true;
  document.getElementById('resttimer').classList.add('show');
  DATA.restEndAt=restTimerState.endAt;
  save();
  updateRestDisplay();
  restTimerState.interval = setInterval(updateRestTimerFromClock, 250);
}
function updateRestTimerFromClock(){
  if(!restTimerState.running || !restTimerState.endAt) return;
  restTimerState.remaining = Math.max(0, Math.ceil((restTimerState.endAt - Date.now()) / 1000));
  updateRestDisplay();
  if(restTimerState.remaining <= 0){
    const wasRunning = restTimerState.running;
    stopRestTimer();
    if(wasRunning && navigator.vibrate) navigator.vibrate([200,100,200]);
  }
}
function stopRestTimer(persistTimer=true){
  if(restTimerState.interval) clearInterval(restTimerState.interval);
  restTimerState.interval = null;
  restTimerState.running = false;
  restTimerState.endAt = null;
  if(persistTimer && DATA.restEndAt){ DATA.restEndAt=null; save(); }
  document.getElementById('resttimer').classList.remove('show');
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
document.getElementById('rtAdd30').onclick = ()=>{ if(restTimerState.running){ restTimerState.endAt+=30000; DATA.restEndAt=restTimerState.endAt; save(); updateRestTimerFromClock(); } };
document.getElementById('rtSkip').onclick = ()=> stopRestTimer();
