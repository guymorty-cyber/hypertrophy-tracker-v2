/* ---------- HOME ---------- */
function renderHome(wk,phase){
  const prefs=dashboardPreferences(),summary=dashboardSummary();
  const todayIdx = getNextProgramIndex();
  const day = DATA.program[todayIdx];
  const bw = DATA.bodyweight.slice().sort((a,b)=>a.date<b.date?-1:1);
  const lastBW = bw[bw.length-1];
  const weekAvg = computeWeeklyAvg();
  const trend = bodyweightWeeklyRate(weekAvg);
  const lastSession = DATA.sessions.filter(s=>s.exercises.some(e=>e.sets.some(usablePreviousSet))).sort((a,b)=>b.date.localeCompare(a.date) || b.startedAt-a.startedAt)[0];
  const prList = allExercisePRs().sort((a,b)=>b.pr.bestE1RM.date.localeCompare(a.pr.bestE1RM.date) || b.pr.bestE1RM.startedAt-a.pr.bestE1RM.startedAt);
  const recentPR = prList.length ? prList[0] : null;

  let pendingBlock = '';
  if(DATA.pendingNextMorning && DATA.pendingNextMorning.date<todayISO()){
    pendingBlock = `<div class="card" style="border-color:var(--teal);">
      <div class="pill pill-teal" style="margin-bottom:8px;">Knee check-in needed</div>
      <div style="font-size:14px;margin-bottom:12px;">Log your next-morning knee check for ${escapeHtml(DATA.pendingNextMorning.dayName)} on ${fmtDateFull(DATA.pendingNextMorning.date)}.</div>
      <button class="btn btn-primary" data-action="logNextMorning">Log next-morning pain</button>
    </div>`;
  }

  const exCount = day.exercises.length;
  const estMin = day.exercises.reduce((sum,e)=> sum + getCoachingPrescription(e,wk).sets*(2 + e.restSec/60), 0);

  let dashCard;
  if(DATA.activeSession){
    const active=DATA.activeSession,sets=active.exercises.flatMap(e=>e.sets);
    dashCard=`<div class="card next-card" id="homeActive"><div class="eyebrow">WORKOUT IN PROGRESS</div><h3>${escapeHtml(active.dayName)}</h3><div class="meta">${sets.filter(usablePreviousSet).length} of ${sets.length} sets completed · started ${fmtDateFull(active.date)}</div><button class="btn btn-primary" data-action="gotoTrain">Continue workout</button></div>`;
  }else if(day.type==='rest'){
    dashCard = `<div class="card next-card">
      <div class="eyebrow">${todayIdx+1}. REST DAY</div>
      <h3>${escapeHtml(day.name)}</h3>
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
    <div class="home-heading"><h2>${prefs.name?`Welcome, ${escapeHtml(prefs.name)}`:'Your training'}</h2><button class="btn btn-sm btn-outline" data-action="personaliseDashboard">Personalise</button></div>
    ${pendingBlock}
    ${dashCard}
    <div class="card" id="homeWeek"><div class="eyebrow">THIS WEEK · MONDAY–SUNDAY</div><div class="home-week-value">${summary.workouts}${prefs.weeklyGoal?' / '+prefs.weeklyGoal:''} workouts</div><div class="progress-caption">${summary.sets} completed sets · ${progressNumber(summary.volume,0)} kg·reps recorded${prefs.weeklyGoal?' · your weekly goal':''}</div>${prefs.showCoaching?renderWeeklyReview(wk):''}</div>
    <div class="home-actions" aria-label="Quick actions"><button class="btn btn-secondary" data-action="homeNavigate" data-tab="progress">View progress</button><button class="btn btn-secondary" data-action="homeNavigate" data-tab="history">Workout history</button><button class="btn btn-secondary" data-action="homeTrack" data-input="bwInput">Log bodyweight</button><button class="btn btn-secondary" data-action="homeTrack" data-input="calInput">Log nutrition</button></div>
    ${prefs.showCoaching?renderDashboardCoaching(day,wk):''}
    <div class="stat-grid">
      ${prefs.showBodyweight?`<div class="stat-box">
        <div class="label">Bodyweight</div>
        <div class="value">${lastBW ? lastBW.weight+' kg' : '—'}</div>
        <div class="sub ${trend===null?'trend-flat':(trend>0?'trend-up':(trend<0?'trend-down':'trend-flat'))}">
          ${trend===null?'Log more to see trend':(trend>0?'↑ +'+trend.toFixed(2)+'kg/wk':(trend<0?'↓ '+trend.toFixed(2)+'kg/wk':'Flat'))}
        </div>
      </div>`:''}
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
    ${prefs.showNutrition?`<h2 class="section">Today's Nutrition</h2>${renderNutritionMini()}`:''}
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

/* Phase 7: optional presentation preferences, independent of training data. */
function dashboardPreferences(){
  return {name:'',weeklyGoal:null,showBodyweight:true,showNutrition:true,showCoaching:true,...DATA.dashboard};
}
function dashboardSummary(){
  return weeklyTraining('30').find(row=>row.date===mondayOf(todayISO()))||{workouts:0,sets:0,volume:0};
}
function renderDashboardCoaching(day,wk){
  const active=DATA.activeSession;
  const slots=active?active.exercises.map(log=>({ex:log.definition,log})):day.exercises.map(ex=>({ex,log:null}));
  const alerts=[];
  for(const {ex,log} of slots){
    if(!ex)continue;
    const name=log?.name||ex.currentDisplay||ex.name,last=lastSessionFor(ex.id,name);
    if(!last)continue;
    const rec=computeRecommendation(ex,last.log,{weekNumber:active?.weekNumber||wk,readiness:active?.readiness});
    if(['stall','declining'].includes(rec.insight?.pattern) || rec.type==='down')alerts.push({name,text:coachingVerdict(rec).reason+' '+coachingSummary(rec)});
  }
  if(active?.readiness==='low')alerts.unshift({name:'Lower readiness today',text:'Load increases are paused today. Follow the effort targets in your current workout.'});
  if(!alerts.length)return '';
  return `<h2 class="section">Training priorities</h2><div class="card" id="homeCoaching"><div class="progress-caption">For ${escapeHtml(active?.dayName||day.name)} · based on logged performance and feedback</div>${alerts.slice(0,3).map(a=>`<div class="home-priority"><strong>${escapeHtml(a.name)}</strong><p>${escapeHtml(a.text)}</p></div>`).join('')}<button class="btn btn-sm btn-outline" data-action="gotoTrain">Review in Train</button></div>`;
}
function saveDashboardPreferences(prefs){
  const valid=typeof prefs.name==='string' && prefs.name.trim().length<=60 &&
    [prefs.showBodyweight,prefs.showNutrition,prefs.showCoaching].every(v=>typeof v==='boolean') &&
    (prefs.weeklyGoal===null || (Number.isInteger(prefs.weeklyGoal) && prefs.weeklyGoal>=1 && prefs.weeklyGoal<=14));
  if(!valid){document.getElementById('dashboardError').textContent='Use a name up to 60 characters and a whole-number weekly goal from 1–14, or leave the goal blank.';return false;}
  const saved=commitData({...DATA,dashboard:{...prefs,name:prefs.name.trim()}});
  if(!saved)document.getElementById('dashboardError').textContent=saveMessage;
  return saved;
}
function openDashboardPreferences(){
  const prefs=dashboardPreferences();
  showModal(`<h3>Personalise Home</h3><div class="field"><label for="dashboardName">Name (optional)</label><input id="dashboardName" maxlength="60" value="${escapeHtml(prefs.name)}"></div><div class="field"><label for="dashboardGoal">Weekly workout goal (optional)</label><input id="dashboardGoal" type="number" min="1" max="14" step="1" inputmode="numeric" value="${prefs.weeklyGoal??''}"></div><p class="progress-caption">Your goal is a display preference; it does not change your programme.</p>${[['showBodyweight','Bodyweight summary'],['showNutrition','Nutrition summary'],['showCoaching','Coaching and weekly review']].map(([key,label])=>`<label class="home-setting"><input type="checkbox" id="dashboard_${key}" ${prefs[key]?'checked':''}> ${label}</label>`).join('')}<p id="dashboardError" role="alert"></p><button class="btn btn-primary" id="dashboardSave">Save preferences</button><button class="btn btn-outline" data-action="closeModal">Cancel</button>`);
  document.getElementById('dashboardSave').onclick=()=>{
    const goal=document.getElementById('dashboardGoal').value.trim();
    const next={name:document.getElementById('dashboardName').value,weeklyGoal:goal===''?null:Number(goal)};
    for(const key of ['showBodyweight','showNutrition','showCoaching'])next[key]=document.getElementById('dashboard_'+key).checked;
    if(saveDashboardPreferences(next)){closeModal();renderTab();}

  };
}

/* Monday through today, derived on each render so History corrections/Undo stay authoritative. */
function weeklyCoachingReview(wk=getWeekNumber()){
  const start=mondayOf(todayISO()),trained=new Map(),groups=new Map();
  for(const session of DATA.sessions){
    if(session.date<start || session.date>todayISO())continue;
    for(const log of session.exercises)if(log.sets.some(usablePreviousSet))trained.set(movementKey(log.name),log.name);
  }
  for(const day of DATA.program)for(const ex of day.exercises){
    const name=ex.currentDisplay||ex.name,key=movementKey(name);
    if(!trained.has(key))continue;
    const last=lastSessionFor(ex.id,name);
    if(!last || last.session.date<start)continue;
    const rec=computeRecommendation(ex,last.log,{weekNumber:wk}),verdict=coachingVerdict(rec);
    if(!groups.has(key))groups.set(key,{name,slots:[]});
    groups.get(key).slots.push({dayName:day.name,rec,verdict});
  }
  const priority={attention:5,improving:4,holding:3,deload:2,baseline:1};
  const movements=[...trained].map(([key,name])=>{
    const group=groups.get(key)||{name,slots:[]};
    const keyStatus=group.slots.reduce((best,slot)=>priority[slot.verdict.key]>priority[best]?slot.verdict.key:best,'baseline');
    return {...group,key:keyStatus};
  });
  const counts={improving:0,holding:0,attention:0,baseline:0,deload:0};
  for(const movement of movements)counts[movement.key]++;
  let focus='Log your planned working sets to build a useful comparison.';
  const attention=movements.find(m=>m.key==='attention');
  if(getPhase(wk).name==='Deload')focus='Follow the reduced set count and 3–4 RIR target this week; records can wait.';
  else if(DATA.activeSession?.readiness==='low')focus='Follow today’s easier effort targets; progression is paused for this workout.';
  else if(attention){
    const slot=attention.slots.find(s=>s.verdict.key==='attention');
    focus=attention.name+' ('+slot.dayName+'): '+(slot.rec.type==='down'?coachingSummary(slot.rec):'Keep the load steady and use the planned rest and technique before chasing more reps.');
  }else if(counts.improving)focus='Keep following the set targets. Add load only when the planned rep and effort targets are met.';
  return {start,movements,counts,focus};
}
function renderWeeklyReview(wk){
  const review=weeklyCoachingReview(wk),c=review.counts;
  return `<div class="weekly-review" id="weeklyReview"><div class="weekly-verdicts">${review.movements.length?`${c.improving} improving · ${c.holding} holding · ${c.attention} need attention`:'Your weekly review starts with your first completed workout.'}</div>
    ${c.baseline||c.deload?`<div class="progress-caption">${c.baseline?c.baseline+' building a baseline':''}${c.baseline&&c.deload?' · ':''}${c.deload?c.deload+' in deload':''}</div>`:''}
    <div class="weekly-focus"><strong>One focus:</strong> ${escapeHtml(review.focus)}</div>
    <details class="coach-explanation"><summary>Review this week</summary><p class="progress-caption">Monday through today. Each movement counts once; its day prescriptions are assessed separately. Needs attention takes priority when days differ. Trends require three comparable workouts, which may include earlier weeks.</p>
    ${review.movements.length?review.movements.map(m=>`<div class="weekly-movement"><strong>${escapeHtml(m.name)}</strong>${m.slots.length?m.slots.map(slot=>`<div class="weekly-slot"><span>${escapeHtml(slot.dayName)}</span>${renderCoachingVerdict(slot.rec)}</div>`).join(''):'<div class="progress-caption">Building a baseline · no matching current prescription.</div>'}</div>`).join(''):'<p class="progress-caption">Finished workouts appear here. Rest days and your unfinished workout are excluded.</p>'}</details></div>`;
}
