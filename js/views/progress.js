/* ---------- PROGRESS ---------- */
function renderProgress(){
  const allExercises = [];
  DATA.program.forEach(d=>d.exercises.forEach(e=>allExercises.push(e)));
  const filtered = exerciseFilterQuery ? allExercises.filter(e=>e.name.toLowerCase().includes(exerciseFilterQuery.toLowerCase())) : allExercises;
  if(!selectedProgressExId && allExercises.length) selectedProgressExId = allExercises[0].id;

  let detailHtml = '';
  if(selectedProgressExId){
    const ex = findExercise(selectedProgressExId);
    const sets = allCompletedSetsFor(selectedProgressExId);
    const pr = getPRFor(selectedProgressExId);
    const lastLog = lastSessionFor(selectedProgressExId);
    const rec = lastLog ? computeRecommendation(ex, lastLog.log) : null;

    // group by session date for history display, most recent first, max 6
    const bySession = {};
    sets.forEach(s=>{
      if(!bySession[s.sessionId]) bySession[s.sessionId]={date:s.date, weights:{}};
      const key = s.weight;
      if(!bySession[s.sessionId].weights[key]) bySession[s.sessionId].weights[key]=[];
      bySession[s.sessionId].weights[key].push(s.reps);
    });
    const sessionsArr = Object.values(bySession).sort((a,b)=>a.date<b.date?1:-1).slice(0,6);

    const graphPoints = sets.map(s=>({x:s.date, y: Math.max(s.weight, estOneRM(s.weight,s.reps)*0+s.weight)}));
    const topSetPerSession = {};
    sets.forEach(s=>{
      if(!topSetPerSession[s.sessionId] || s.weight>topSetPerSession[s.sessionId]) topSetPerSession[s.sessionId]=s.weight;
    });
    const seriesForGraph = Object.keys(topSetPerSession).sort().map(sid=>{
      const s = sets.find(x=>x.sessionId===sid);
      return {date:s.date, value:topSetPerSession[sid]};
    });

    detailHtml = `
      <div class="card">
        <div style="font-size:17px;font-weight:800;margin-bottom:2px;">${escapeHtml(ex.name)}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">${ex.sets} sets · ${ex.repMin}–${ex.repMax} reps</div>
        <div class="svgwrap">${renderSparkline(seriesForGraph)}</div>
        <div class="metric-grid">
          <div class="metric"><div class="label">Current</div><div class="value">${sets.length?sets[sets.length-1].weight+'kg × '+sets[sets.length-1].reps:'—'}</div></div>
          <div class="metric"><div class="label">Previous</div><div class="value">${sets.length>1?sets[sets.length-2].weight+'kg × '+sets[sets.length-2].reps:'—'}</div></div>
          <div class="metric"><div class="label">PR (est. 1RM)</div><div class="value">${pr?pr.bestE1RM.weight+'kg × '+pr.bestE1RM.reps:'—'}</div></div>
          <div class="metric"><div class="label">Next target</div><div class="value" style="font-size:13px;">${rec?rec.text.split('—')[0].trim():'Log a session first'}</div></div>
        </div>
      </div>
      <h2 class="section">Recent history</h2>
      <div class="card card-tight">
        ${sessionsArr.length ? sessionsArr.map(s=>{
          const line = Object.keys(s.weights).sort((a,b)=>b-a).map(w=>`${w}kg — ${s.weights[w].join(', ')}`).join(' / ');
          return `<div class="hist-row-mini"><span>${fmtDate(s.date)}</span><span class="sets">${line}</span></div>`;
        }).join('') : `<div class="empty">No sets logged yet for this exercise.</div>`}
      </div>
    `;
  }

  return `
    <h2 class="section" style="margin-top:0;">Progression</h2>
    <input class="searchbox" id="exSearch" placeholder="Search exercise…" value="${escapeHtml(exerciseFilterQuery)}">
    <select class="searchbox" id="exSelect">
      ${filtered.map(e=>`<option value="${e.id}" ${e.id===selectedProgressExId?'selected':''}>${escapeHtml(e.name)}</option>`).join('')}
    </select>
    ${detailHtml}
    <h2 class="section">Personal Records</h2>
    ${renderPRList()}
  `;
}
function renderSparkline(series){
  if(!series.length) return `<div class="empty">No data yet</div>`;
  const w=440,h=110,pad=16;
  const values = series.map(s=>s.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max-min)||1;
  const stepX = series.length>1 ? (w-2*pad)/(series.length-1) : 0;
  const pts = series.map((s,i)=>{
    const x = pad + i*stepX;
    const y = h-pad - ((s.value-min)/range)*(h-2*pad);
    return [x,y];
  });
  const pathD = pts.map((p,i)=> (i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const dots = pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#ff7a3d"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
    <path d="${pathD}" fill="none" stroke="#ff7a3d" stroke-width="2.5"/>
    ${dots}
  </svg>`;
}
function renderPRList(){
  const prs = allExercisePRs();
  if(!prs.length) return `<div class="card"><div class="empty">Log workouts to start tracking PRs.</div></div>`;
  prs.sort((a,b)=> b.pr.bestE1RM.weight - a.pr.bestE1RM.weight);
  return `<div class="card card-tight">
    ${prs.map(p=>`<div class="pr-item">
      <div>
        <div class="exname">${escapeHtml(p.name)}</div>
        <div class="prsub">Best reps @ heaviest: ${p.pr.heaviest.reps} reps · e1RM ${Math.round(estOneRM(p.pr.bestE1RM.weight,p.pr.bestE1RM.reps))}kg</div>
      </div>
      <div style="text-align:right;">
        <div class="prval">${p.pr.heaviest.weight}kg</div>
        <div class="prsub">${fmtDate(p.pr.bestE1RM.date)}</div>
      </div>
    </div>`).join('')}
  </div>`;
}
