/* ============================= EVENTS ============================= */
function attachTabEvents(){
  document.querySelectorAll('[data-action]').forEach(el=>{
    const action = el.dataset.action;
    if(el._bound) return; // avoid dup (elements are recreated each render so fine, but guard anyway)
    if(action==='installApp'){
      el.onclick = ()=>installApp();
    }else if(action==='startToday'){
      el.onclick = ()=>{ startSession(getTodayProgramDay()); };
    }else if(action==='startRestDay'){
      el.onclick = ()=> startRestDay();
    }else if(action==='logRestDay'){
      el.onclick = ()=> logRestDay();
    }else if(action==='gotoTrain'){
      el.onclick = ()=> setTab('train');
    }else if(action==='startPicked'){
      el.onclick = ()=>{
        const idx = parseInt(document.getElementById('dayPicker').value);
        const day = DATA.program[idx];
        if(day && day.type==='rest') startRestDay();
        else startSession(idx);
      };
    }else if(action==='cancelSession'){
      el.onclick = ()=>{ if(confirm('Discard this workout?')){ if(commitData({...DATA,activeSession:null,restEndAt:null})){ stopRestTimer(false); renderTab(); } } };
    }else if(action==='setField'){
      el.oninput = ()=>{ updateSetField(el.dataset.exid, parseInt(el.dataset.setidx), el.dataset.field, el.value); };
    }else if(action==='toggleComplete'){
      el.onchange = ()=>{ toggleSetComplete(el.dataset.exid, parseInt(el.dataset.setidx), el.checked); };
    }else if(action==='useLastSession'){
      el.onclick = ()=> useLastSession(el.dataset.exid);
    }else if(action==='addSet'){
      el.onclick = ()=> addWorkoutSet(el.dataset.exid);
    }else if(action==='removeSet'){
      el.onclick = ()=> removeWorkoutSet(el.dataset.exid);
    }else if(action==='workoutNotes'){
      el.oninput = ()=>{ if(DATA.activeSession){ DATA.activeSession.notes=el.value; save(); } };
    }else if(action==='exNotes'){
      el.oninput = ()=>{ setExerciseNotes(el.dataset.exid, el.value); };
    }else if(action==='startRest'){
      el.onclick = ()=> startRestTimer(parseInt(el.dataset.sec));
    }else if(action==='openAlts'){
      el.onclick = ()=> openAltsModal(el.dataset.exid);
    }else if(action==='editExFromWorkout'){
      el.onclick = ()=>{
        const path = exerciseIndexPath(el.dataset.exid);
        if(path) openExerciseEditModal(path.di, el.dataset.exid);
      };
    }else if(action==='setKnee'){
      el.onclick = ()=> setKneePain(el.dataset.phase, parseInt(el.dataset.val));
    }else if(action==='finishWorkout'){
      el.onclick = ()=> finishWorkoutFlow();
    }else if(action==='logNextMorning'){
      el.onclick = ()=> openNextMorningModal();
    }else if(action==='logNutritionToday' || action==='logNutrition'){
      el.onclick = ()=> logNutrition();
    }else if(action==='logBodyweight'){
      el.onclick = ()=> logBodyweight();
    }else if(action==='exportData'){
      el.onclick = ()=> exportData();
    }else if(action==='resetData'){
      el.onclick = ()=>{ if(confirm('This will erase ALL data permanently. Continue?')){ if(confirm('Are you absolutely sure?')){ if(commitData(defaultData(),true)){ deletedWorkout=null; document.getElementById('undoPanel').hidden=true; stopRestTimer(false); closeModal(); renderTab(); } } } };
    }else if(action==='deleteWorkout'){
      el.onclick = event=>{ event.stopPropagation(); deleteWorkout(el.dataset.sid); };
    }else if(action==='viewSession'){
      el.onclick = ()=> openSessionDetail(el.dataset.sid);
    }
  });

  const exSearch = document.getElementById('exSearch');
  if(exSearch) exSearch.oninput = ()=>{ exerciseFilterQuery = exSearch.value; renderTab(); setTimeout(()=>{ const s=document.getElementById('exSearch'); if(s){s.focus(); s.setSelectionRange(s.value.length,s.value.length);} },0); };
  const exSelect = document.getElementById('exSelect');
  if(exSelect) exSelect.onchange = ()=>{ selectedProgressExId = exSelect.value; renderTab(); };
  const histSearch = document.getElementById('histSearch');
  if(histSearch) histSearch.oninput = ()=>{ historyFilterQuery = histSearch.value; renderTab(); setTimeout(()=>{ const s=document.getElementById('histSearch'); if(s){s.focus(); s.setSelectionRange(s.value.length,s.value.length);} },0); };
  const editDaySelect = document.getElementById('editDaySelect');
  if(editDaySelect){ editDaySelect.onchange = ()=> renderDayEditor(parseInt(editDaySelect.value)); renderDayEditor(parseInt(editDaySelect.value)); }
  const restore=document.getElementById('restoreBackupBtn');
  if(restore) restore.onclick=restoreBackup;
  const importFile = document.getElementById('importFile');
  if(importFile) importFile.onchange = (e)=> importData(e);
}
