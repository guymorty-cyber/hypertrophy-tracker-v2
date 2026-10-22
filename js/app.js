/* App startup: loaded after all feature files. */
document.getElementById('retrySave').onclick=()=>save();
document.getElementById('exportRecovery').onclick=exportRecovery;
document.getElementById('undoDelete').onclick=undoDeleteWorkout;
window.addEventListener('beforeunload',event=>{
  if(!unsavedChanges) return;
  event.preventDefault(); event.returnValue='';
});
window.addEventListener('storage',event=>{
  if(event.key===STORAGE_KEY || event.key===null){
    updateSaveStatus('Data changed in another tab. Export your current data in More, then reload before continuing.',true);
  }
});
updateSaveStatus(saveMessage || (DATA.activeSession?'Session recovered — continue in Train':'Saved on this device'),storageBlocked);
setTab(DATA.activeSession?'train':'home');
if(DATA.activeSession && typeof DATA.restEndAt==='number' && DATA.restEndAt>Date.now()){
  restTimerState.endAt=DATA.restEndAt;
  restTimerState.running=true;
  document.getElementById('resttimer').classList.add('show');
  updateRestTimerFromClock();
  restTimerState.interval=setInterval(updateRestTimerFromClock,250);
}

setupPWA();
