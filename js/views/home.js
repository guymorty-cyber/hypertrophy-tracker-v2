/* ---------- HOME ---------- */
function renderHome(wk,phase){
  const todayIdx = getNextProgramIndex();
  const day = DATA.program[todayIdx];
  const bw = DATA.bodyweight.slice().sort((a,b)=>a.date<b.date?-1:1);
  const lastBW = bw[bw.length-1];
  const weekAvg = computeWeeklyAvg();
  const trend = bodyweightWeeklyRate(weekAvg);
  const lastSession = DATA.sessions.slice().sort((a,b)=>b.date.localeCompare(a.date) || b.startedAt-a.startedAt)[0];
  const prList = allExercisePRs().sort((a,b)=>b.pr.bestE1RM.date.localeCompare(a.pr.bestE1RM.date) || b.pr.bestE1RM.startedAt-a.pr.bestE1RM.startedAt);
  const recentPR = prList.length ? prList[0] : null;

  let pendingBlock = '';
  if(DATA.pendingNextMorning){
    pendingBlock = `<div class="card" style="border-color:var(--teal);">
      <div class="pill pill-teal" style="margin-bottom:8px;">Knee check-in needed</div>
      <div style="font-size:14px;margin-bottom:12px;">Log this morning's knee pain following yesterday's ${escapeHtml(DATA.pendingNextMorning.dayName)}.</div>
      <button class="btn btn-primary" data-action="logNextMorning">Log next-morning pain</button>
    </div>`;
  }

  const exCount = day.exercises.length;
  const estMin = day.exercises.reduce((sum,e)=> sum + e.sets*(2 + e.restSec/60), 0);

  let dashCard;
  if(day.type==='rest'){
    dashCard = `<div class="card next-card">
      <div class="eyebrow">${todayIdx+1}. REST DAY</div>
      <h3>Rest Day</h3>
      <div class="meta">No lifting scheduled. Optional: 20–30 min low/moderate cardio.</div>
      <button class="btn btn-secondary" data-action="startRestDay">Log Rest Day</button>
    </div>`;
  }else{
    dashCard = `<div class="card next-card">
      <div class="eyebrow">NEXT WORKOUT · ${todayIdx+1}</div>
      <h3>${escapeHtml(day.name)}</h3>
      <div class="meta">${exCount} exercises · ~${Math.round(estMin)} min</div>
      <button class="btn btn-primary" data-action="startToday">Start Workout</button>
    </div>`;
  }

  return `
    ${pendingBlock}
    ${dashCard}
    <div class="stat-grid">
      <div class="stat-box">
        <div class="label">Bodyweight</div>
        <div class="value">${lastBW ? lastBW.weight+' kg' : '—'}</div>
        <div class="sub ${trend===null?'trend-flat':(trend>0?'trend-up':(trend<0?'trend-down':'trend-flat'))}">
          ${trend===null?'Log more to see trend':(trend>0?'↑ +'+trend.toFixed(2)+'kg/wk':(trend<0?'↓ '+trend.toFixed(2)+'kg/wk':'Flat'))}
        </div>
      </div>
      <div class="stat-box">
        <div class="label">Recent PR</div>
        <div class="value" style="font-size:14px;">${recentPR ? escapeHtml(recentPR.name) : '—'}</div>
        <div class="sub">${recentPR ? recentPR.pr.bestE1RM.weight+'kg × '+recentPR.pr.bestE1RM.reps : 'No PRs yet'}</div>
      </div>
      <div class="stat-box">
        <div class="label">Programme</div>
        <div class="value">Week ${wk}</div>
        <div class="sub">${phase.name}</div>
      </div>
      <div class="stat-box">
        <div class="label">Last Workout</div>
        <div class="value" style="font-size:14px;">${lastSession ? escapeHtml(lastSession.dayName) : '—'}</div>
        <div class="sub">${lastSession ? fmtDate(lastSession.date) : 'None logged'}</div>
      </div>
    </div>
    <h2 class="section">Today's Nutrition</h2>
    ${renderNutritionMini()}
  `;
}
function renderNutritionMini(){
  const today = DATA.nutrition.find(n=>n.date===todayISO());
  return `<div class="card card-tight">
    <div class="row">
      <div>
        <div style="font-size:13px;color:var(--text-dim);">Calories</div>
        <div style="font-size:17px;font-weight:800;">${today?today.calories:0} <span style="font-size:12px;color:var(--text-faint);font-weight:600;">/ ${NUTRITION_TARGET.calories}</span></div>
      </div>
      <div>
        <div style="font-size:13px;color:var(--text-dim);">Protein</div>
        <div style="font-size:17px;font-weight:800;">${today?today.protein:0}g <span style="font-size:12px;color:var(--text-faint);font-weight:600;">/ ${NUTRITION_TARGET.protein}g</span></div>
      </div>
      <button class="btn btn-sm btn-outline" data-action="logNutritionToday">Log</button>
    </div>
  </div>`;
}
function computeWeeklyAvg(){
  return weeklyBodyweight(DATA.bodyweight).map((row,i)=>({week:i,date:row.date,avg:row.avg,count:row.count}));
}
function allExercisePRs(){
  return progressExercises().map(ex=>({...ex,exId:ex.id,pr:getPRFor(ex.id,ex.name)})).filter(ex=>ex.pr);
}
