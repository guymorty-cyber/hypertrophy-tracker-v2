// Recompute derived values without changing the original exercise logs or order.
function rebuildHistory(sessions){
  const best=new Map(),derived=new Map();
  const ordered=sessions.slice().sort((a,b)=>a.date.localeCompare(b.date) || a.startedAt-b.startedAt || String(a.id).localeCompare(String(b.id)));
  for(const session of ordered){
    const sets=session.exercises.flatMap(e=>e.sets).filter(usablePreviousSet);
    const newPRs=[];
    for(const ex of session.exercises){
      const key=JSON.stringify([ex.exerciseId,ex.name]);
      const score=Math.max(0,...ex.sets.filter(usablePreviousSet).map(s=>estOneRM(s.weight,s.reps)));
      if(score>0 && score>(best.get(key)||0)){newPRs.push(ex.name);best.set(key,score);}
    }
    derived.set(String(session.id),{...session,totalSets:sets.length,totalReps:sets.reduce((n,s)=>n+s.reps,0),
      totalVolume:sets.reduce((n,s)=>n+s.weight*s.reps,0),newPRs:[...new Set(newPRs)]});
  }
  return sessions.map(s=>derived.get(String(s.id)));
}
function updateUndoPanel(){
  document.getElementById('undoPanel').hidden=!deletedWorkouts.length;
  document.getElementById('undoDelete').textContent=deletedWorkouts.length>1?`Undo latest (${deletedWorkouts.length})`:'Undo';
}
function deleteWorkout(sid){
  const index=DATA.sessions.findIndex(s=>String(s.id)===String(sid));
  if(index<0) return false;
  const session=DATA.sessions[index];
  if(!confirm('Delete '+session.dayName+' — '+fmtDate(session.date)+'? You can undo deletions until you reload.')) return false;
  const pending=DATA.pendingNextMorning && String(DATA.pendingNextMorning.sessionId)===String(sid)?DATA.pendingNextMorning:null;
  const candidate={...DATA,sessions:rebuildHistory(DATA.sessions.filter((s,i)=>i!==index)),
    pendingNextMorning:pending?null:DATA.pendingNextMorning};
  if(!commitData(candidate)) return false;
  deletedWorkouts.push({session,index,pending});
  updateUndoPanel();
  renderTab();
  return true;
}
function undoDeleteWorkout(){
  if(!deletedWorkouts.length) return false;
  const {session,index,pending}=deletedWorkouts[deletedWorkouts.length-1];
  if(DATA.sessions.some(s=>String(s.id)===String(session.id))) return false;
  const sessions=DATA.sessions.slice();
  sessions.splice(Math.min(index,sessions.length),0,session);
  const candidate={...DATA,sessions:rebuildHistory(sessions),pendingNextMorning:DATA.pendingNextMorning||pending};
  if(!commitData(candidate)) return false;
  deletedWorkouts.pop();
  updateUndoPanel();
  renderTab();
  return true;
}
function saveHistoryEdit(sid,draft,expectedRaw){
  document.getElementById('historyEditError').textContent='';
  const fail=message=>{document.getElementById('historyEditError').textContent=message;return false;};
  const original=DATA.sessions.find(s=>String(s.id)===String(sid));
  if(!original || JSON.stringify(original)!==expectedRaw) return fail('This workout changed. Close the editor and reopen it before saving.');
  if(!draft || typeof draft!=='object') return fail('The workout could not be saved. Reopen the editor.');
  const validDate=typeof draft.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
    !Number.isNaN(Date.parse(draft.date+'T00:00:00Z')) && new Date(draft.date+'T00:00:00Z').toISOString().slice(0,10)===draft.date;
  if(!validDate) return fail('Choose a valid workout date.');
  if(typeof draft.notes!=='string' || !Array.isArray(draft.exercises) || draft.exercises.length!==original.exercises.length) return fail('The workout could not be saved. Reopen the editor.');
  const exercises=[];
  for(let ei=0;ei<original.exercises.length;ei++){
    const source=original.exercises[ei],edited=draft.exercises[ei];
    if(!edited || typeof edited.notes!=='string' || !Array.isArray(edited.sets) || edited.sets.length!==source.sets.length) return fail('The set list changed. Reopen the editor.');
    const sets=[];
    for(let si=0;si<source.sets.length;si++){
      const set=edited.sets[si];
      if(!set || typeof set.completed!=='boolean' ||
         (set.weight!==null && (!Number.isFinite(set.weight) || set.weight<0)) ||
         (set.reps!==null && (!Number.isInteger(set.reps) || set.reps<0)) ||
         (set.completed && !usablePreviousSet(set))) return fail(`Check ${source.name}, set ${si+1}: completed sets need a non-negative weight and positive whole-number reps.`);
      sets.push({...source.sets[si],weight:set.weight,reps:set.reps,completed:set.completed});
    }
    exercises.push({...source,notes:edited.notes,sets});
  }
  if(exercises.length && !exercises.some(e=>e.sets.some(usablePreviousSet))) return fail('Keep at least one completed set, or delete this workout from History.');
  const updated={...original,date:draft.date,notes:draft.notes,exercises};
  const sessions=rebuildHistory(DATA.sessions.map(s=>String(s.id)===String(sid)?updated:s));
  const pending=DATA.pendingNextMorning;
  const pendingNextMorning=pending && String(pending.sessionId)===String(sid)?{...pending,date:draft.date}:pending;
  return commitData({...DATA,sessions,pendingNextMorning});
}
function openHistoryEditor(sid){
  const original=DATA.sessions.find(s=>String(s.id)===String(sid));
  if(!original) return;
  const expectedRaw=JSON.stringify(original);
  showModal(`
    <h2>Edit saved workout</h2>
    <div class="sub">${escapeHtml(original.dayName)} · Changes save only when you tap Save changes.</div>
    <div class="field"><label for="historyEditDate">Workout date</label><input id="historyEditDate" type="date" value="${escapeHtml(original.date)}"></div>
    ${original.exercises.map((ex,ei)=>`<div class="history-edit-ex"><h3>${escapeHtml(ex.name)}</h3>
      <div class="setlabels"><span>Set</span><span>kg</span><span>Reps</span><span>Done</span></div>
      ${ex.sets.map((s,si)=>`<div class="setrow">
        <div class="setnum">${si+1}</div>
        <input aria-label="Weight in kilograms" id="historyWeight_${ei}_${si}" type="number" inputmode="decimal" min="0" step="any" value="${s.weight??''}">
        <input aria-label="Repetitions" id="historyReps_${ei}_${si}" type="number" inputmode="numeric" min="1" step="1" value="${s.reps??''}">
        <div class="checkwrap"><input aria-label="Complete set" id="historyDone_${ei}_${si}" type="checkbox" ${s.completed?'checked':''}></div>
      </div>`).join('')}
      <div class="field"><label for="historyExNotes_${ei}">Exercise notes</label><textarea id="historyExNotes_${ei}">${escapeHtml(ex.notes||'')}</textarea></div>
    </div>`).join('')}
    <div class="field"><label for="historyEditNotes">Workout notes</label><textarea id="historyEditNotes">${escapeHtml(original.notes||'')}</textarea></div>
    <div id="historyEditError" class="save-error" role="alert"></div>
    <div class="history-edit-actions"><button class="btn btn-primary" id="historyEditSave">Save changes</button><button class="btn btn-ghost" data-action="closeModal">Cancel</button></div>
  `);
  document.getElementById('historyEditSave').onclick=()=>{
    const readNumber=id=>{
      const input=document.getElementById(id);
      return input.validity && input.validity.badInput?NaN:input.value===''?null:Number(input.value);
    };
    const draft={date:document.getElementById('historyEditDate').value,notes:document.getElementById('historyEditNotes').value,
      exercises:original.exercises.map((ex,ei)=>({notes:document.getElementById('historyExNotes_'+ei).value,
        sets:ex.sets.map((s,si)=>({weight:readNumber(`historyWeight_${ei}_${si}`),reps:readNumber(`historyReps_${ei}_${si}`),completed:document.getElementById(`historyDone_${ei}_${si}`).checked}))}))};
    if(!saveHistoryEdit(sid,draft,expectedRaw)){
      if(!document.getElementById('historyEditError').textContent) document.getElementById('historyEditError').textContent='Your edits have not saved. Keep this editor open and try Save changes again. '+saveMessage;
      return;
    }
    renderTab();openSessionDetail(sid);
  };
}
