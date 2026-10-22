function renderDayEditor(dayIdx){
  const day = DATA.program[dayIdx];
  const el = document.getElementById('dayEditorList');
  if(!el) return;
  const listHtml = day.exercises.length ? day.exercises.map((ex,i)=>`
    <div class="day-editor-row">
      <div class="exname">${i+1}. ${escapeHtml(ex.name)}<br><span style="color:var(--text-faint);font-size:11px;">${ex.sets} sets · ${ex.repMin}–${ex.repMax} reps</span></div>
      <div class="arrows">
        <button data-move="up" data-day="${dayIdx}" data-i="${i}" ${i===0?'disabled':''}>↑</button>
        <button data-move="down" data-day="${dayIdx}" data-i="${i}" ${i===day.exercises.length-1?'disabled':''}>↓</button>
        <button data-editex="${ex.id}" data-day="${dayIdx}">✎</button>
        <button data-delex="${ex.id}" data-day="${dayIdx}">✕</button>
      </div>
    </div>
  `).join('') : `<div class="empty">${day.type==='rest'?'Rest day — no exercises.':'No exercises yet.'}</div>`;

  el.innerHTML = listHtml + `<button class="btn btn-outline btn-sm" style="width:100%;margin-top:12px;" data-addex="${dayIdx}">+ Add exercise</button>`;

  el.querySelectorAll('[data-move]').forEach(b=>{
    b.onclick = ()=>{
      const di = parseInt(b.dataset.day), i = parseInt(b.dataset.i);
      const arr = DATA.program[di].exercises;
      const j = b.dataset.move==='up'? i-1 : i+1;
      if(j<0||j>=arr.length) return;
      [arr[i],arr[j]] = [arr[j],arr[i]];
      save();
      renderDayEditor(di);
    };
  });
  el.querySelectorAll('[data-editex]').forEach(b=>{
    b.onclick = ()=> openExerciseEditModal(parseInt(b.dataset.day), b.dataset.editex);
  });
  el.querySelectorAll('[data-delex]').forEach(b=>{
    b.onclick = ()=>{
      const di = parseInt(b.dataset.day);
      const ex = findExercise(b.dataset.delex);
      if(!confirm(`Remove "${ex?ex.name:'this exercise'}" from this day? Past history stays saved, but it'll no longer appear in your programme or Progress list.`)) return;
      DATA.program[di].exercises = DATA.program[di].exercises.filter(e=>e.id!==b.dataset.delex);
      save();
      renderDayEditor(di);
    };
  });
  el.querySelectorAll('[data-addex]').forEach(b=>{
    b.onclick = ()=> openExerciseEditModal(parseInt(b.dataset.addex), null);
  });
}

function openExerciseEditModal(dayIdx, exId){
  const isNew = !exId;
  const ex = isNew ? {name:'',sets:3,repMin:8,repMax:12,restSec:90,inc:2.5,note:''} : findExercise(exId);
  showModal(`
    <h2>${isNew?'Add exercise':'Edit exercise'}</h2>
    <div class="sub">${isNew?'Add a custom exercise to this day.':'Changes apply to future sessions. Past history is unaffected.'}</div>
    <div class="field"><label>Exercise name</label><input id="fEditName" value="${escapeHtml(ex.name)}" placeholder="e.g. Seated Cable Row"></div>
    <div class="field"><label>Sets</label><input id="fEditSets" type="number" inputmode="numeric" value="${ex.sets}"></div>
    <div class="row" style="gap:10px;">
      <div class="field" style="flex:1;"><label>Rep min</label><input id="fEditRepMin" type="number" inputmode="numeric" value="${ex.repMin}"></div>
      <div class="field" style="flex:1;"><label>Rep max</label><input id="fEditRepMax" type="number" inputmode="numeric" value="${ex.repMax}"></div>
    </div>
    <div class="row" style="gap:10px;">
      <div class="field" style="flex:1;"><label>Rest (seconds)</label><input id="fEditRest" type="number" inputmode="numeric" value="${ex.restSec}"></div>
      <div class="field" style="flex:1;"><label>Weight step (kg)</label><input id="fEditInc" type="number" step="0.5" inputmode="decimal" value="${ex.inc}"></div>
    </div>
    <div class="field"><label>Notes (optional)</label><textarea id="fEditNote" placeholder="Form cues, ROM notes, etc.">${escapeHtml(ex.note||'')}</textarea></div>
    <button class="btn btn-primary" id="fEditSave">${isNew?'Add exercise':'Save changes'}</button>
    <button class="btn btn-ghost" data-action="closeModal" style="width:100%;margin-top:6px;">Cancel</button>
  `);
  document.getElementById('fEditSave').onclick = ()=>{
    const name = document.getElementById('fEditName').value.trim();
    const sets = parseInt(document.getElementById('fEditSets').value)||1;
    const repMin = parseInt(document.getElementById('fEditRepMin').value)||1;
    const repMax = parseInt(document.getElementById('fEditRepMax').value)||repMin;
    const restSec = parseInt(document.getElementById('fEditRest').value)||60;
    const inc = parseFloat(document.getElementById('fEditInc').value)||2.5;
    const note = document.getElementById('fEditNote').value.trim();
    if(!name){ alert('Please enter an exercise name.'); return; }
    if(sets<1 || sets>100 || repMin<1 || repMax<repMin || restSec<0 || inc<0){ alert('Check sets, rep range, rest time and weight step.'); return; }
    if(isNew){
      const newEx = {id:'custom_'+Date.now(), name, sets, repMin, repMax, restSec, inc, cat:'moderate'};
      if(note) newEx.note = note;
      DATA.program[dayIdx].exercises.push(newEx);
    }else{
      ex.name=name; ex.sets=sets; ex.repMin=repMin; ex.repMax=repMax; ex.restSec=restSec; ex.inc=inc;
      if(note) ex.note=note; else delete ex.note;
      if(DATA.activeSession){
        const log = DATA.activeSession.exercises.find(e=>e.exerciseId===ex.id);
        if(log){
          log.name = name;
          while(log.sets.length<sets) log.sets.push({weight:null,reps:null,completed:false});
          if(log.sets.length>sets) log.sets = log.sets.slice(0,sets);
        }
      }
    }
    save();
    closeModal();
    renderTab();
  };
}
