const BACKUP_KEY = STORAGE_KEY + '_backup';
let lastStoredRaw = null;
let storageBlocked = false;
let unsavedChanges = false;
let saveMessage = '';
let recoveryRaw = null;
let deletedWorkouts = [];

function validateData(value){
  const fail = ()=>{ throw new Error('This file is not a valid Hypertrophy Tracker backup.'); };
  const object = v=>v && typeof v==='object' && !Array.isArray(v);
  const text = v=>typeof v==='string';
  const id = v=>(text(v) && v.length>0) || (typeof v==='number' && Number.isFinite(v));
  const number = v=>typeof v==='number' && Number.isFinite(v) && v>=0;
  const date = v=>text(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T00:00:00')) && new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const unique = rows=>new Set(rows.map(r=>String(r.id))).size===rows.length;
  if(!object(value) || !Array.isArray(value.program) || !value.program.length ||
     !Array.isArray(value.sessions) || !Array.isArray(value.bodyweight) ||
     !Array.isArray(value.nutrition) || !date(value.programStartDate)) fail();
  if(!unique(value.program) || !unique(value.sessions)) fail();
  const validateExercise = ex=>{
    if(!object(ex) || !id(ex.id) || !/^[\w-]+$/.test(String(ex.id)) || !text(ex.name) || !Number.isInteger(ex.sets) ||
         ex.sets<1 || ex.sets>100 || !number(ex.repMin) || !number(ex.repMax) ||
         ex.repMin>ex.repMax || !number(ex.restSec) || !number(ex.inc)) fail();
    if(ex.alts!==undefined && (!Array.isArray(ex.alts) || ex.alts.some(v=>!text(v)))) fail();
  };
  for(const day of value.program){
    if(!object(day) || !id(day.id) || !text(day.name) ||
       !['training','rest'].includes(day.type) || !Array.isArray(day.exercises)) fail();
    if(!unique(day.exercises) || !/^[\w-]+$/.test(String(day.id))) fail();
    for(const ex of day.exercises){
      validateExercise(ex);
    }
  }
  const normalizeSession = s=>{
    if(!object(s) || !id(s.id) || !id(s.dayId) || !text(s.dayName) ||
       !date(s.date) || !number(s.startedAt) || !Array.isArray(s.exercises)) fail();
    for(const e of s.exercises){
      if(!object(e) || !id(e.exerciseId) || !text(e.name) || !Array.isArray(e.sets)) fail();
      if(e.definition!==undefined){
        validateExercise(e.definition);
        if(e.definition.id!==e.exerciseId) fail();
      }
      for(const st of e.sets){
        if(!object(st) || (st.weight!==null && !number(st.weight)) ||
           (st.reps!==null && (!number(st.reps) || !Number.isInteger(st.reps))) ||
           typeof st.completed!=='boolean') fail();
      }
    }
    const pain = {before:null,after:null,nextMorning:null,...(s.kneePain||{})};
    if(Object.values(pain).some(v=>v!==null && (!number(v) || v>10))) fail();
    return {...s,kneePain:pain,notes:text(s.notes)?s.notes:''};
  };
  const sessions = value.sessions.map(normalizeSession);
  const activeSession = value.activeSession ? normalizeSession(value.activeSession) : null;
  if(activeSession && (!value.program.some(d=>d.id===activeSession.dayId) ||
      sessions.some(s=>String(s.id)===String(activeSession.id)))) fail();
  if(activeSession){
    const day=value.program.find(d=>d.id===activeSession.dayId);
    activeSession.isLower=activeSession.isLower ?? !!day.isLower;
    activeSession.exercises=activeSession.exercises.map(e=>{
      const definition=e.definition || day.exercises.find(ex=>ex.id===e.exerciseId);
      return definition?{...e,definition:JSON.parse(JSON.stringify(definition))}:e;
    });
  }
  if(value.bodyweight.some(b=>!object(b)||!date(b.date)||!number(b.weight)||b.weight<=0) ||
     value.nutrition.some(n=>!object(n)||!date(n.date)||!number(n.calories)||!number(n.protein))) fail();
  const pending = value.pendingNextMorning;
  return {...defaultData(),...value,sessions,activeSession,
    pendingNextMorning:pending && sessions.some(s=>String(s.id)===String(pending.sessionId))?pending:null};
}

function updateSaveStatus(message, error=false){
  saveMessage = message;
  const el = document.getElementById('saveStatus');
  if(el){ el.textContent=message; el.classList.toggle('save-error',error); }
  const recovery = document.getElementById('exportRecovery');
  if(recovery) recovery.hidden = !storageBlocked;
  const retry = document.getElementById('retrySave');
  if(retry) retry.hidden = !unsavedChanges || storageBlocked;
}
function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    lastStoredRaw = raw;
    if(!raw) return defaultData();
    recoveryRaw = raw;
    return validateData(JSON.parse(raw));
  }catch(e){
    storageBlocked = true;
    saveMessage = 'Saved data could not be read. Export recovery data, then restore or import a valid backup in More.';
    return defaultData();
  }
}
function persist(candidate, replaceDamaged=false){
  unsavedChanges = true;
  try{
    if(storageBlocked && !replaceDamaged) throw new Error(saveMessage || 'Restore your saved data in More before saving.');
    const current = localStorage.getItem(STORAGE_KEY);
    if(current!==lastStoredRaw) throw new Error('Data changed in another tab. Export your current data in More, then reload before continuing.');
    const serialized = JSON.stringify(validateData(candidate));
    // Preserve the previous valid snapshot. A full store must not prevent saving.
    if(current){
      try{ validateData(JSON.parse(current)); localStorage.setItem(BACKUP_KEY,current); }catch(e){}
    }
    localStorage.setItem(STORAGE_KEY,serialized);
    lastStoredRaw = serialized;
    recoveryRaw = serialized;
    storageBlocked = false;
    unsavedChanges = false;
    updateSaveStatus('Saved on this device');
    return true;
  }catch(e){
    updateSaveStatus(e.name==='QuotaExceededError' ? 'Storage is full. Export your data in More before closing.' :
      e.message || 'Could not save. Keep this page open and export your data in More.',true);
    return false;
  }
}
function save(){ return persist(DATA); }
function commitData(candidate, replaceDamaged=false){
  if(!persist(candidate,replaceDamaged)) return false;
  DATA = candidate;
  return true;
}
function restoreBackup(){
  try{
    const raw=localStorage.getItem(BACKUP_KEY);
    if(!raw) return alert('No previous saved snapshot is available on this device.');
    const restored=validateData(JSON.parse(raw));
    restored.restEndAt=null;
    if(!confirm('Restore the previous saved snapshot? Export your current data first if you need to keep it.')) return;
    if(!commitData(restored,true)) return;
    deletedWorkouts=[];
    document.getElementById('undoPanel').hidden=true;
    DATA.restEndAt=null;
    stopRestTimer(false); closeModal(); renderTab();
  }catch(e){ alert('The saved snapshot could not be restored: '+e.message); }
}
function exportRecovery(){
  downloadJSON(recoveryRaw || lastStoredRaw || '{}','hypertrophy-recovery-'+todayISO()+'.json');
}

let DATA = load();
