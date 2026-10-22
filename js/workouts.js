/* ---------- session logic ---------- */
function startRestDay(dayIdx=null){
  const restIdx = dayIdx!==null && DATA.program[dayIdx]?.type==='rest'?dayIdx:DATA.program.findIndex(d=>d.type==='rest');
  if(restIdx<0) return;
  if(DATA.activeSession){ setTab('train'); return; }
  if(!commitData({...DATA,restDayOpen:true,restDayId:DATA.program[restIdx].id})) return;
  setTab('train');
}

function renderRestDayScreen(){
  const day=DATA.program.find(d=>d.id===DATA.restDayId && d.type==='rest') || DATA.program.find(d=>d.type==='rest');
  return `
    <div class="card" style="text-align:center;padding:30px 20px;background:linear-gradient(155deg,#202a2a,#1a2023);">
      <div style="font-size:54px;line-height:1;margin-bottom:14px;">😴</div>
      <div style="font-size:12px;color:var(--teal);font-weight:900;letter-spacing:.7px;">RECOVERY</div>
      <h2 style="font-size:28px;margin:5px 0 8px;">${escapeHtml(day?.name||'Rest day')}</h2>
      <p style="color:var(--text-dim);font-size:14px;line-height:1.5;margin:0 auto 20px;max-width:330px;">No sets. No reps. No workout. Recover, eat well, sleep and come back stronger.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;">
        <span class="pill pill-dim">Recovery</span><span class="pill pill-dim">Muscle growth</span><span class="pill pill-dim">No training</span>
      </div>
      <button class="btn btn-primary" data-action="logRestDay">Log Rest Day</button>
    </div>
    <div class="card card-tight">
      <div class="row"><strong>Optional recovery</strong><span class="pill pill-teal">Easy</span></div>
      <div style="color:var(--text-dim);font-size:13px;line-height:1.5;margin-top:8px;">Light walking, mobility or easy cardio is fine. Nothing needs to be logged as a set.</div>
    </div>`;
}

function logRestDay(){
  const restDay = DATA.program.find(d=>d.id===DATA.restDayId && d.type==='rest') || DATA.program.find(d=>d.type==='rest');
  if(!restDay) return;
  const session={
    id:newSessionId(),
    date:todayISO(),
    startedAt:Date.now(),
    finishedAt:Date.now(),
    dayId:restDay.id,
    dayName:restDay.name,
    weekNumber:getWeekNumber(),
    phase:getPhase(getWeekNumber()).name,
    exercises:[],
    kneePain:{before:null,after:null,nextMorning:null},
    notes:'Rest day', totalSets:0, totalReps:0, totalVolume:0
  };
  if(!commitData({...DATA,sessions:[...DATA.sessions,session],restDayOpen:false})) return;
  setTab('home');
}

function startSession(dayIdx){
  if(DATA.activeSession){ setTab('train'); return; }
  const day = DATA.program[dayIdx];
  if(!day) return;
  if(day.type==='rest'){ startRestDay(dayIdx); return; }
  if(!day.exercises.length){alert('Add exercises to this day in More → Programme Builder before starting.');return;}
  const sess = {
    id: newSessionId(),
    date: todayISO(),
    startedAt: Date.now(),
    dayId: day.id,
    dayName: day.name,
    isLower: !!day.isLower,
    weekNumber: getWeekNumber(),
    phase: getPhase(getWeekNumber()).name,
    exercises: day.exercises.map(ex=>({
      exerciseId: ex.id,
      definition: JSON.parse(JSON.stringify(ex)),
      name: ex.currentDisplay || ex.name,
      notes: '',
      sets: Array.from({length:getCoachingPrescription(ex).sets}, ()=>({weight:null,reps:null,completed:false}))
    })),
    kneePain: {before:null, after:null, nextMorning:null},
    notes: ''
  };
  if(!commitData({...DATA,activeSession:sess,restDayOpen:false})) return;
  setTab('train');
}
function newSessionId(){ return 'sess_'+(typeof crypto!=='undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()+'_'+Math.random().toString(36).slice(2)); }
function getActiveExLog(exId){
  return DATA.activeSession && DATA.activeSession.exercises.find(e=>e.exerciseId===exId);
}
function workoutExercise(log){
  return log.definition || findExercise(log.exerciseId) || {
    id:log.exerciseId,name:log.name,sets:Math.max(1,log.sets.length),
    repMin:8,repMax:12,inc:0,restSec:90,cat:'moderate'
  };
}
function swapWorkoutExercise(exId, chosen){
  const log=getActiveExLog(exId);
  if(!log) return false;
  const ex=workoutExercise(log);
  if(![ex.name,...(ex.alts||[])].includes(chosen)) return false;
  if(chosen===log.name) return true;
  if(log.sets.some(s=>s.completed || s.weight!==null || s.reps!==null)){
    alert('This exercise already has entered sets. Keep its name to preserve your log. Clear the values and uncheck the sets before swapping.');
    return false;
  }
  const activeSession=JSON.parse(JSON.stringify(DATA.activeSession));
  activeSession.exercises.find(e=>e.exerciseId===exId).name=chosen;
  delete activeSession.exercises.find(e=>e.exerciseId===exId).effortRir;
  const program=DATA.program.map(d=>({...d,exercises:d.exercises.map(e=>e.id===exId?{...e,currentDisplay:chosen}:e)}));
  return commitData({...DATA,activeSession,program});
}
function editWorkoutSets(exId, edit){
  if(!DATA.activeSession) return false;
  const activeSession=JSON.parse(JSON.stringify(DATA.activeSession));
  const log=activeSession.exercises.find(e=>e.exerciseId===exId);
  if(!log || !edit(log) || !commitData({...DATA,activeSession})) return false;
  renderTab();
  return true;
}
function addWorkoutSet(exId){
  return editWorkoutSets(exId,log=>{
    if(log.sets.length>=100) return false;
    log.sets.push({weight:null,reps:null,completed:false});
    return true;
  });
}
function removeWorkoutSet(exId){
  return editWorkoutSets(exId,log=>{
    if(log.sets.length<=1) return false;
    const last=log.sets[log.sets.length-1];
    if(last.completed) return false;
    if((last.weight!==null || last.reps!==null) && !confirm('Remove the last set and its entered weight and reps?')) return false;
    log.sets.pop();
    return true;
  });
}
function useLastSession(exId){
  return editWorkoutSets(exId,log=>{
    const previous=lastSessionFor(exId,log.name);
    if(!previous) return false;
    let changed=false;
    log.sets.forEach((set,i)=>{
      const source=previous.log.sets[i];
      if(set.completed || !source || !usablePreviousSet(source)) return;
      for(const field of ['weight','reps']){
        if(set[field]===null){set[field]=source[field];changed=true;}
      }
    });
    return changed;
  });
}
function updateSetField(exId, setIdx, field, value){
  if(!DATA.activeSession || !['weight','reps'].includes(field)) return;
  const log=getActiveExLog(exId);
  if(!log || !log.sets[setIdx]) return;
  const num=value===''?null:Number(value);
  if(num!==null && (!Number.isFinite(num) || num<0 || (field==='reps' && !Number.isInteger(num)))){
    log.sets[setIdx][field]=null;
    log.sets[setIdx].completed=false;
    if(save()) updateSaveStatus('Use a non-negative weight and whole-number reps.',true);
    return;
  }
  log.sets[setIdx][field]=num;
  if(log.sets[setIdx].completed && (num===null || (field==='reps' && num===0))) log.sets[setIdx].completed=false;
  save();
}
function toggleSetComplete(exId, setIdx, checked){
  if(!DATA.activeSession) return;
  const log=getActiveExLog(exId), ex=log && workoutExercise(log);
  if(!log || !log.sets[setIdx]) return;
  const set=log.sets[setIdx];
  if(checked && (!Number.isFinite(set.weight) || set.weight<0 || !Number.isInteger(set.reps) || set.reps<=0)){
    alert('Enter the weight (0 for bodyweight) and reps before completing this set.');
    renderTab(); return;
  }
  set.completed=checked;
  const saved=save();
  if(checked && saved && ex) startRestTimer(ex.restSec);
  renderTab();
}
function setWorkoutReadiness(value){
  const readiness=value===''?null:value;
  if(!DATA.activeSession || ![null,'usual','low'].includes(readiness))return false;
  if(!commitData({...DATA,activeSession:{...DATA.activeSession,readiness}}))return false;
  renderTab();return true;
}
function setExerciseEffort(exId,value){
  const effortRir=value===''?null:Number(value),log=getActiveExLog(exId);
  if(!log || (effortRir!==null && (!Number.isInteger(effortRir) || effortRir<0 || effortRir>5)))return false;
  const count=getCoachingPrescription(workoutExercise(log),DATA.activeSession.weekNumber).sets;
  if(effortRir!==null && (log.sets.length<count || !log.sets.slice(0,count).every(usablePreviousSet)))return false;
  return editWorkoutSets(exId,edited=>{edited.effortRir=effortRir;return true;});
}
function setExerciseNotes(exId, val){
  const log = getActiveExLog(exId);
  log.notes = val;
  save();
}
function setKneePain(phase, val){
  DATA.activeSession.kneePain[phase] = val;
  save();
  renderTab();
}

function openAltsModal(exId){
  const log=getActiveExLog(exId);
  const ex=log && workoutExercise(log);
  if(!ex || !ex.alts) return;
  const options = [ex.name, ...ex.alts];
  showModal(`
    <h2>Swap exercise</h2>
    <div class="sub">Choose a substitute. Your history stays intact under the original name.</div>
    <div class="altlist">
      ${options.map(o=>`<button data-alt="${escapeHtml(o)}" class="${o===log.name?'current':''}">${escapeHtml(o)}</button>`).join('')}
    </div>
    <button class="btn btn-ghost" data-action="closeModal">Cancel</button>
  `);
  document.querySelectorAll('[data-alt]').forEach(b=>{
    b.onclick = ()=>{
      const chosen = b.dataset.alt;
      if(!swapWorkoutExercise(exId,chosen)) return;
      closeModal();
      renderTab();
    };
  });
}
function finishWorkoutFlow(){
  if(!DATA.activeSession) return;
  const sess = JSON.parse(JSON.stringify(DATA.activeSession));
  const day = DATA.program.find(d=>d.id===sess.dayId);
  const isLower=sess.isLower ?? !!(day && day.isLower);
  const completed = sess.exercises.flatMap(e=>e.sets).filter(s=>s.completed);
  if(!completed.length) return alert('Complete at least one set before finishing.');
  if(completed.some(s=>!Number.isFinite(s.weight) || s.weight<0 || !Number.isInteger(s.reps) || s.reps<=0)){
    return alert('Check completed sets: enter a weight (0 for bodyweight) and a positive whole number of reps.');
  }
  const remaining=sess.exercises.flatMap(e=>e.sets).filter(s=>!s.completed).length;
  if(remaining && !confirm(`${remaining} sets are unfinished. Finish with ${completed.length} completed sets? Only completed sets count in your totals.`)) return;
  if(isLower && sess.kneePain.after===null &&
     !confirm('Knee pain after workout not logged. Finish anyway?')) return;
  const notes = document.getElementById('workoutNotes');
  sess.notes = notes ? notes.value : sess.notes;
  sess.finishedAt = Date.now();
  sess.durationSec = Math.max(0,Math.round((sess.finishedAt-sess.startedAt)/1000));
  sess.totalSets=completed.length;
  sess.totalReps=completed.reduce((n,s)=>n+s.reps,0);
  sess.totalVolume=completed.reduce((n,s)=>n+s.weight*s.reps,0);
  const sessions=rebuildHistory([...DATA.sessions,sess]);
  const candidate={...DATA,sessions,activeSession:null,restEndAt:null};
  if(isLower) candidate.pendingNextMorning={sessionId:sess.id,dayName:sess.dayName,date:sess.date};
  if(!commitData(candidate)) return;
  stopRestTimer(false);
  showSummaryModal(sessions.find(s=>s.id===sess.id));
}

function showSummaryModal(sess){
  const mins = Math.floor(sess.durationSec/60);
  showModal(`
    <h2>Workout complete</h2>
    <div class="sub">${escapeHtml(sess.dayName)} · ${fmtDate(sess.date)}</div>
    ${sess.newPRs && sess.newPRs.length ? sess.newPRs.map(n=>`<div class="newpr-badge">🏆 New PR: ${escapeHtml(n)}</div>`).join('') : ''}
    <div class="summary-grid">
      <div class="summary-box"><div class="big">${mins||0}min</div><div class="lbl">Duration</div></div>
      <div class="summary-box"><div class="big">${sess.totalSets}</div><div class="lbl">Total sets</div></div>
      <div class="summary-box"><div class="big">${sess.totalReps}</div><div class="lbl">Total reps</div></div>
      <div class="summary-box"><div class="big">${Math.round(sess.totalVolume)}kg</div><div class="lbl">Total volume</div></div>
    </div>
    ${sess.kneePain.after!==null ? `<div class="knee-flag pill-dim">Knee pain after: ${sess.kneePain.after}/10</div>` : ''}
    <button class="btn btn-primary" data-action="closeModalHome">Done</button>
  `);
  const btn = document.querySelector('[data-action="closeModalHome"]');
  if(btn) btn.onclick = ()=>{ closeModal(); setTab('home'); };
}

function openNextMorningModal(){
  const info = DATA.pendingNextMorning;
  showModal(`
    <h2>Next-morning knee check</h2>
    <div class="sub">Following ${escapeHtml(info.dayName)} on ${fmtDate(info.date)}</div>
    <div class="painscale" id="nmScale">
      ${[0,1,2,3,4,5].map(v=>`<button data-val="${v}">${v}</button>`).join('')}
    </div>
    <div id="nmFlag" style="margin-top:12px;"></div>
    <button class="btn btn-primary" style="margin-top:14px;" id="nmSave" disabled>Save</button>
  `);
  let picked=null;
  document.querySelectorAll('#nmScale button').forEach(b=>{
    b.onclick = ()=>{
      picked=parseInt(b.dataset.val);
      document.querySelectorAll('#nmScale button').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      document.getElementById('nmFlag').innerHTML = kneeFlagHtml(picked);
      document.getElementById('nmSave').disabled=false;
      const sess = DATA.sessions.find(s=>s.id===info.sessionId);
      if(sess && sess.kneePain.before!==null && (picked - sess.kneePain.before)>=2){
        document.getElementById('nmFlag').innerHTML += `<div class="knee-flag pill-warn">Next-morning pain is meaningfully worse than baseline. Reduce knee-demanding volume by 30–50% next lower-body session.</div>`;
      }
    };
  });
  document.getElementById('nmSave').onclick = ()=>{
    const sessions=DATA.sessions.map(s=>s.id===info.sessionId?{...s,kneePain:{...s.kneePain,nextMorning:picked}}:s);
    if(!commitData({...DATA,sessions,pendingNextMorning:null})) return;
    closeModal();
    renderTab();
  };
}

function openSessionDetail(sid){
  const s = rebuildHistory(DATA.sessions).find(x=>String(x.id)===String(sid));
  if(!s) return;
  const exHtml = s.exercises.map(e=>{
    const rows = e.sets.map((st,i)=>st.completed?`<div class="hist-row-mini"><span>Set ${i+1}</span><span class="sets">${st.weight}kg × ${st.reps}</span></div>`:'').join('');
    return `<div style="margin-bottom:12px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:2px;">${escapeHtml(e.name)}</div>
      ${rows || '<div class="empty" style="padding:6px 0;">No completed sets</div>'}
      ${e.effortRir!=null?`<div class="ex-note">Reported final-set RIR: ${e.effortRir}${e.effortRir===5?'+':''}</div>`:''}
      ${e.notes ? `<div class="ex-note">${escapeHtml(e.notes)}</div>` : ''}
    </div>`;
  }).join('');
  const sDayIdx = DATA.program.findIndex(d=>d.id===s.dayId);
  showModal(`
    <h2>${sDayIdx>-1?'Day '+(sDayIdx+1)+' — ':''}${escapeHtml(s.dayName)}</h2>
    <div class="sub">${fmtDateFull(s.date)} · Week ${escapeHtml(s.weekNumber??'—')} · ${escapeHtml(s.phase)}</div>
    <div class="summary-grid">
      <div class="summary-box"><div class="big">${s.durationSec?Math.floor(s.durationSec/60):'—'}min</div><div class="lbl">Duration</div></div>
      <div class="summary-box"><div class="big">${s.totalSets}</div><div class="lbl">Sets</div></div>
      <div class="summary-box"><div class="big">${s.totalReps}</div><div class="lbl">Reps</div></div>
      <div class="summary-box"><div class="big">${Math.round(s.totalVolume||0)}kg</div><div class="lbl">Volume</div></div>
    </div>
    ${(s.kneePain && (s.kneePain.before!==null||s.kneePain.after!==null||s.kneePain.nextMorning!==null)) ? `
      <div class="divider"></div>
      <div style="font-size:12.5px;color:var(--text-dim);">Knee pain — before ${s.kneePain.before ?? '—'} · after ${s.kneePain.after ?? '—'} · next morning ${s.kneePain.nextMorning ?? '—'}</div>
    ` : ''}
    <div class="divider"></div>
    ${exHtml}
    ${s.readiness?`<div class="ex-note">Readiness: ${s.readiness==='low'?'Lower than usual':'Usual'}</div>`:''}
    ${s.notes ? `<div class="divider"></div><div style="font-size:13px;color:var(--text-dim);"><strong>Notes:</strong> ${escapeHtml(s.notes)}</div>` : ''}
    <div class="history-edit-actions"><button class="btn btn-outline" id="detailEdit">Edit workout</button><button class="btn btn-danger-outline" id="detailDelete">Delete workout</button></div>
    <button class="btn btn-ghost" data-action="closeModal" style="margin-top:10px;">Close</button>
  `);
  document.getElementById('detailEdit').onclick=()=>openHistoryEditor(s.id);
  document.getElementById('detailDelete').onclick=()=>{if(deleteWorkout(s.id)) closeModal();};
}
