/* ---------- TRAIN ---------- */
function renderTrain(){
  if(DATA.activeSession){
    return renderActiveSession();
  }
  if(DATA.restDayOpen){
    return renderRestDayScreen();
  }
  const todayIdx = getNextProgramIndex();
  return `
    <h2 class="section" style="margin-top:0;">Start a workout</h2>
    <div class="card stack">
      <div class="field" style="margin-bottom:0;">
        <label>Choose workout</label>
        <select id="dayPicker" class="searchbox">
          ${DATA.program.map((d,i)=>`<option value="${i}" ${i===todayIdx?'selected':''}>${i+1}. ${escapeHtml(d.name)}${d.type==='rest'?' (Rest)':''}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" data-action="startPicked">${DATA.program[todayIdx] && DATA.program[todayIdx].type==='rest' ? 'Open Rest Day' : 'Start Workout'}</button>
    </div>
    <h2 class="section">Workout sequence</h2>
    <div class="card card-tight">
      ${DATA.program.map((d,i)=>`<div class="row" style="padding:8px 0;${i>0?'border-top:1px solid var(--line);':''}">
        <div style="font-size:13.5px;">${i+1}. ${escapeHtml(d.name)}</div>
        <div style="font-size:12px;color:var(--text-dim);">${d.type==='rest'?'Rest':d.exercises.length+' ex'}</div>
      </div>`).join('')}
    </div>
  `;
}

function renderActiveSession(){
  const sess = DATA.activeSession;
  const day = DATA.program.find(d=>d.id===sess.dayId);
  const wk = getWeekNumber(); const phase = getPhase(wk);
  let kneeBefore = '';
  if(day.isLower){
    kneeBefore = `<div class="card card-tight" style="border-color:var(--teal);">
      <div class="row">
        <div style="font-size:13px;font-weight:700;">Knee pain — before workout</div>
        <div class="pill ${sess.kneePain.before!==null? (evalKnee(sess.kneePain.before)||{cls:'pill-dim'}).cls : 'pill-dim'}">${sess.kneePain.before!==null? sess.kneePain.before+'/10':'Not logged'}</div>
      </div>
      <div class="painscale" style="margin-top:10px;">
        ${[0,1,2,3,4,5].map(v=>`<button data-action="setKnee" data-phase="before" data-val="${v}" class="${sess.kneePain.before===v?'sel':''}">${v}</button>`).join('')}
      </div>
    </div>`;
  }

  const exercisesHtml = day.exercises.map((ex,idx)=>{
    let log = sess.exercises.find(e=>e.exerciseId===ex.id);
    if(!log){
      log = {exerciseId:ex.id, name:ex.name, notes:'', sets:Array.from({length:ex.sets}, ()=>({weight:null,reps:null,completed:false}))};
      sess.exercises.push(log);
    }
    const lastLog = lastSessionFor(ex.id,log.name);
    const rec = computeRecommendation(ex, lastLog && lastLog.log);
    return renderExerciseBlock(ex, log, lastLog, rec);
  }).join('');

  let kneeAfter = '';
  if(day.isLower){
    kneeAfter = `<div class="card card-tight" style="border-color:var(--teal);">
      <div class="row">
        <div style="font-size:13px;font-weight:700;">Knee pain — immediately after</div>
        <div class="pill ${sess.kneePain.after!==null? (evalKnee(sess.kneePain.after)||{cls:'pill-dim'}).cls : 'pill-dim'}">${sess.kneePain.after!==null? sess.kneePain.after+'/10':'Not logged'}</div>
      </div>
      <div class="painscale" style="margin-top:10px;">
        ${[0,1,2,3,4,5].map(v=>`<button data-action="setKnee" data-phase="after" data-val="${v}" class="${sess.kneePain.after===v?'sel':''}">${v}</button>`).join('')}
      </div>
      ${sess.kneePain.after!==null ? kneeFlagHtml(sess.kneePain.after) : ''}
    </div>`;
  }

  const activeDayIdx = DATA.program.findIndex(d=>d.id===day.id);
  return `
    <div class="card card-tight" style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:11px;color:var(--text-dim);">Week ${wk} · ${phase.name}</div>
        <div style="font-size:16px;font-weight:800;">${activeDayIdx+1}. ${escapeHtml(day.name)}</div>
      </div>
      <button class="btn-ghost" data-action="cancelSession">Cancel</button>
    </div>
    <div class="workout-progress">${sess.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.completed).length,0)} / ${sess.exercises.reduce((n,e)=>n+e.sets.length,0)} sets complete · Your session saves as you train</div>
    ${kneeBefore}
    ${exercisesHtml}
    ${kneeAfter}
    <div class="card">
      <div class="field" style="margin-bottom:12px;">
        <label>Workout notes</label>
        <textarea id="workoutNotes" data-action="workoutNotes" placeholder="How did the session feel overall?">${escapeHtml(sess.notes||'')}</textarea>
      </div>
      <button class="btn btn-primary" data-action="finishWorkout">Finish Workout</button>
    </div>
  `;
}

function kneeFlagHtml(score){
  const ev = evalKnee(score);
  if(!ev) return '';
  const cls = ev.level==='green'?'pill-good':ev.level==='yellow'?'pill-warn':ev.level==='orange'?'pill-warn':'pill-danger';
  return `<div class="knee-flag ${cls}">${ev.label}</div>`;
}

function renderExerciseBlock(ex, log, lastLog, rec){
  let prevLine = '';
  if(lastLog && lastLog.log){
    const setsStr = lastLog.log.sets.filter(s=>s.completed).map(s=>`${s.weight}kg×${s.reps}`).join(', ');
    prevLine = `<div class="prev-line">Last time (${fmtDate(lastLog.session.date)}): ${setsStr||'—'}</div>`;
  }
  const altBtn = ex.alts && ex.alts.length ? `<button data-action="openAlts" data-exid="${ex.id}">Swap exercise</button>` : '';
  const canCopy = lastLog && log.sets.some((set,i)=>!set.completed &&
    (set.weight===null || set.reps===null) && lastLog.log.sets[i] && usablePreviousSet(lastLog.log.sets[i]));
  const setsRows = log.sets.map((s,i)=>{
    const prevSet = lastLog && lastLog.log && lastLog.log.sets[i] ? lastLog.log.sets[i] : null;
    return `<div class="setrow">
      <div class="setnum">${i+1}</div>
      <div>
        <input type="number" min="0" step="0.25" aria-label="Weight in kilograms" inputmode="decimal" placeholder="${prevSet?prevSet.weight:'kg'}" value="${s.weight??''}" data-action="setField" data-exid="${ex.id}" data-setidx="${i}" data-field="weight">
        ${prevSet?`<span class="prevmini">prev ${prevSet.weight}</span>`:''}
      </div>
      <div>
        <input type="number" min="1" step="1" aria-label="Repetitions" inputmode="numeric" placeholder="${prevSet?prevSet.reps:'reps'}" value="${s.reps||''}" data-action="setField" data-exid="${ex.id}" data-setidx="${i}" data-field="reps">
        ${prevSet?`<span class="prevmini">prev ${prevSet.reps}</span>`:''}
      </div>
      <div class="checkwrap"><input aria-label="Complete set" type="checkbox" ${s.completed?'checked':''} data-action="toggleComplete" data-exid="${ex.id}" data-setidx="${i}"></div>
    </div>`;
  }).join('');

  let recoHtml = '';
  if(rec){
    const cls = rec.type==='up'?'reco-up':(rec.type==='reps'?'reco-reps':(rec.type==='down'?'reco-maintain':'reco-reps'));
    const previous = lastLog && lastLog.log ? `Previous: ${lastLog.log.sets.filter(s=>s.completed && s.weight>0 && s.reps>0).map(s=>`${s.weight}kg × ${s.reps}`).join(' · ')}` : '';
    recoHtml = `<div class="reco reco-coach ${cls}"><div class="coach-title">Today's advice</div><div class="coach-main">${escapeHtml(rec.text)}</div><div class="coach-detail">${escapeHtml(rec.detail||'')} ${escapeHtml(previous)}</div></div>`;
  }

  return `<div class="ex-card">
    <div class="ex-head">
      <h3 class="ex-title">${exNumber(ex.id)}. ${escapeHtml(ex.name)}</h3>
      <div class="ex-target">${log.sets.length} sets today${log.sets.length!==ex.sets?' ('+ex.sets+' planned)':''} · ${ex.repMin}–${ex.repMax} reps${ex.perLeg?' each leg':''} · Rest ${Math.round(ex.restSec/60*10)/10>=1?Math.round(ex.restSec/60)+' min':ex.restSec+'s'}</div>
      ${ex.note?`<div class="ex-note">${escapeHtml(ex.note)}</div>`:''}
      ${ex.finalPartials?`<div class="ex-note">Final set: after technical failure, 4–8 controlled lengthened partials.</div>`:''}
      ${prevLine}
      <div class="ex-actions">
        <button data-action="startRest" data-sec="${ex.restSec}">Start rest timer</button>
        ${altBtn}
        <button data-action="editExFromWorkout" data-exid="${ex.id}">Edit exercise</button>
        ${lastLog?`<button data-action="useLastSession" data-exid="${ex.id}" ${canCopy?'':'disabled'} title="Fill empty fields from completed sets. Review before marking complete.">Use last session</button>`:''}
        <button data-action="addSet" data-exid="${ex.id}" ${log.sets.length>=100?'disabled':''}>+ Add set</button>
        <button data-action="removeSet" data-exid="${ex.id}" ${log.sets.length<=1 || log.sets[log.sets.length-1].completed?'disabled':''}>Remove last set</button>
      </div>
    </div>
    <div class="setlabels"><span>Set</span><span>kg</span><span>Reps</span><span>Done</span></div>
    ${setsRows}
    ${recoHtml}
    <div class="notesbox">
      <textarea placeholder="Exercise notes (form cues, equipment, pain, etc.)" data-action="exNotes" data-exid="${ex.id}">${escapeHtml(log.notes||'')}</textarea>
    </div>
  </div>`;
}
function exNumber(exId){
  const path = exerciseIndexPath(exId);
  return path ? path.ei+1 : '';
}
