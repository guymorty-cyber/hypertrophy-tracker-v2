/* ---------- HISTORY ---------- */
let historyFilterQuery = '';
function renderHistory(){
  const sessions = rebuildHistory(DATA.sessions).sort((a,b)=>b.date.localeCompare(a.date) || b.startedAt-a.startedAt || String(b.id).localeCompare(String(a.id)));
  const query=historyFilterQuery.trim().toLowerCase();
  const filtered=query?sessions.filter(s=>[s.dayName,s.date,fmtDateFull(s.date),s.notes||'',...s.exercises.flatMap(e=>[e.name,e.notes||''])].some(value=>String(value).toLowerCase().includes(query))):sessions;

  return `
    <h2 class="section" style="margin-top:0;">Workout History</h2>
    <input class="searchbox" id="histSearch" aria-label="Search workout history" placeholder="Search workout, exercise, date or notes…" value="${escapeHtml(historyFilterQuery)}">
    <div class="history-count">${filtered.length} of ${sessions.length} workouts</div>
    ${filtered.length ? filtered.map(s=>renderHistItem(s)).join('') : `<div class="card"><div class="empty">${sessions.length?'No workouts match your search.':'No workouts yet. Finish a workout to see it here.'}</div></div>`}
  `;
}
function renderHistItem(s){
  return `<div class="hist-item" data-action="viewSession" data-sid="${escapeHtml(s.id)}">
    <div class="row">
      <div class="dname">${escapeHtml(s.dayName)}</div>
      <div class="ddate">${fmtDate(s.date)}</div>
    </div>
    <div class="hist-meta">
      <span>${s.totalSets||0} sets</span>
      <span>${s.totalReps||0} reps</span>
      <span>${Math.round(s.totalVolume||0)} kg vol</span>
      ${s.newPRs && s.newPRs.length ? `<span class="pill pill-accent" style="padding:2px 8px;">${s.newPRs.length} PR${s.newPRs.length>1?'s':''}</span>`:''}
    </div>
    <button type="button" class="history-edit-btn" data-action="editHistory" data-sid="${escapeHtml(s.id)}">Edit workout</button>
    <button type="button" class="history-delete-btn" data-action="deleteWorkout" data-sid="${escapeHtml(s.id)}">Delete workout</button>
  </div>`;
}
