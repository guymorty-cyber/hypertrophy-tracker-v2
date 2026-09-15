from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
old = '''function startRestTimer(sec){
  stopRestTimer();
  restTimerState.total = sec;
  restTimerState.remaining = sec;
  restTimerState.running = true;
  document.getElementById('resttimer').classList.add('show');
  updateRestDisplay();
  restTimerState.interval = setInterval(()=>{
    restTimerState.remaining--;
    if(restTimerState.remaining<=0){
      updateRestDisplay();
      stopRestTimer();
      if(navigator.vibrate) navigator.vibrate([200,100,200]);
      return;
    }
    updateRestDisplay();
  },1000);
}
function stopRestTimer(){
  if(restTimerState.interval) clearInterval(restTimerState.interval);
  restTimerState.interval = null;
  restTimerState.running = false;
  document.getElementById('resttimer').classList.remove('show');
}'''
new = '''function startRestTimer(sec){
  stopRestTimer();
  restTimerState.total = sec;
  restTimerState.remaining = sec;
  restTimerState.endAt = Date.now() + (sec * 1000);
  restTimerState.running = true;
  document.getElementById('resttimer').classList.add('show');
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
function stopRestTimer(){
  if(restTimerState.interval) clearInterval(restTimerState.interval);
  restTimerState.interval = null;
  restTimerState.running = false;
  restTimerState.endAt = null;
  document.getElementById('resttimer').classList.remove('show');
}

document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') updateRestTimerFromClock();
});
window.addEventListener('pageshow', updateRestTimerFromClock);
window.addEventListener('focus', updateRestTimerFromClock);'''
if old not in s:
    raise SystemExit('Original rest timer block not found')
s = s.replace(old, new, 1)
old_add = "document.getElementById('rtAdd30').onclick = ()=>{ restTimerState.remaining+=30; updateRestDisplay(); };"
new_add = "document.getElementById('rtAdd30').onclick = ()=>{ if(restTimerState.running){ restTimerState.endAt = (restTimerState.endAt || Date.now()) + 30000; updateRestTimerFromClock(); } };"
if old_add not in s:
    raise SystemExit('Add-30 handler not found')
s = s.replace(old_add, new_add, 1)
p.write_text(s, encoding='utf-8')
print('Background-safe rest timer applied')
