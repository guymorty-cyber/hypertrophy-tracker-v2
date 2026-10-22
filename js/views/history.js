/* ---------- HISTORY ---------- */
let historyFilterQuery = '';
function renderHistory(){
  const sessions = DATA.sessions.slice().sort((a,b)=>a.date<b.date?1:-1);
  const filtered = historyFilterQuery ? sessions.filter(s=>{
    if(s.dayName.toLowerCase().includes(historyFilterQuery.toLowerCase())) return true;
    return s.exercises.some(e=>e.name.toLowerCase().includes(historyFilterQuery.toLowerCase()));
  }) : sessions;

  return `
    <h2 class="section" style="margin-top:0;">Workout History</h2>
    <input class="searchbox" id="histSearch" placeholder="Search by workout or exercise…" value="${escapeHtml(historyFilterQuery)}">
    ${filtered.length ? filtered.map(s=>renderHistItem(s)).join('') : `<div class="card"><div class="empty">No workouts match.</div></div>`}
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
    <button type="button" class="history-delete-btn" data-action="deleteWorkout" data-sid="${escapeHtml(s.id)}">Delete workout</button>
  </div>`;
}
