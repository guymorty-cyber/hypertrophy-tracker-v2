/* Phase 4: analytics are derived from valid completed logs, never stored counters. */
let progressRange='all';
let progressMetric='load';
function utcDay(date){return Date.parse(date+'T00:00:00Z');}
function isoDay(ms){return new Date(ms).toISOString().slice(0,10);}
function mondayOf(date){const ms=utcDay(date),day=new Date(ms).getUTCDay();return isoDay(ms-((day+6)%7)*86400000);}
function progressCutoff(range=progressRange){return range==='all'?null:isoDay(utcDay(todayISO())-(Number(range)-1)*86400000);}
function inProgressRange(date,range=progressRange){const cutoff=progressCutoff(range);return (!cutoff || date>=cutoff) && date<=todayISO();}
function progressExercises(){
  const entries=new Map();
  const add=(id,name,dayName,definition,current)=>{
    const key=movementKey(name);
    if(!entries.has(key))entries.set(key,{key,id,name,dayName:'',days:[],slots:[],current:false,definition});
    const entry=entries.get(key);
    if(!entry.days.includes(dayName))entry.days.push(dayName);
    if(current){entry.current=true;entry.slots.push({id,name,dayName,definition});}
    entry.dayName=entry.days.join(' / ');
  };
  for(const day of DATA.program)for(const ex of day.exercises)add(ex.id,ex.currentDisplay||ex.name,day.name,ex,true);
  for(const session of DATA.sessions)for(const log of session.exercises)add(log.exerciseId,log.name,session.dayName,log.definition||null,false);
  return [...entries.values()];
}
function exerciseProgress(id,name,range=progressRange){
  const grouped=new Map();
  for(const set of allCompletedSetsFor(id,name)){
    if(!inProgressRange(set.date,range))continue;
    const key=String(set.sessionId);
    if(!grouped.has(key))grouped.set(key,{date:set.date,startedAt:set.startedAt,sessionId:set.sessionId,sets:[]});
    grouped.get(key).sets.push(set);
  }
  return [...grouped.values()].map(row=>{
    const best=row.sets.reduce((a,b)=>estOneRM(b.weight,b.reps)>estOneRM(a.weight,a.reps) ||
      (estOneRM(b.weight,b.reps)===estOneRM(a.weight,a.reps) && b.reps>a.reps)?b:a);
    return {...row,best,load:Math.max(...row.sets.map(s=>s.weight)),reps:Math.max(...row.sets.map(s=>s.reps)),
      totalReps:row.sets.reduce((n,s)=>n+s.reps,0),volume:row.sets.reduce((n,s)=>n+s.weight*s.reps,0),
      e1rm:best.weight>0?estOneRM(best.weight,best.reps):null};
  });
}
function weeklyTraining(range=progressRange){
  const buckets=new Map();
  for(const session of DATA.sessions){
    if(!inProgressRange(session.date,range))continue;
    const sets=session.exercises.flatMap(e=>e.sets).filter(usablePreviousSet);
    if(!sets.length)continue;
    const date=mondayOf(session.date);
    if(!buckets.has(date))buckets.set(date,{date,workouts:0,sets:0,reps:0,volume:0});
    const b=buckets.get(date);b.workouts++;b.sets+=sets.length;b.reps+=sets.reduce((n,s)=>n+s.reps,0);b.volume+=sets.reduce((n,s)=>n+s.weight*s.reps,0);
  }
  if(!buckets.size)return [];
  const start=mondayOf(progressCutoff(range)||[...buckets.keys()].sort()[0]),end=mondayOf(todayISO()),out=[];
  for(let ms=utcDay(start);ms<=utcDay(end);ms+=7*86400000){const date=isoDay(ms);out.push(buckets.get(date)||{date,workouts:0,sets:0,reps:0,volume:0});}
  return out;
}
function dailyBodyweight(rows=DATA.bodyweight){
  // One daily observation: duplicate imported dates use the final stored entry.
  const dates=new Map();
  for(const row of rows)if(Number.isFinite(row.weight) && row.weight>0)dates.set(row.date,row.weight);
  return [...dates].sort(([a],[b])=>a.localeCompare(b)).map(([date,weight])=>({date,weight}));
}
function weeklyBodyweight(rows=DATA.bodyweight){
  const buckets=new Map();
  for(const row of dailyBodyweight(rows)){
    const date=mondayOf(row.date);
    if(!buckets.has(date))buckets.set(date,[]);
    buckets.get(date).push(row.weight);
  }
  return [...buckets].map(([date,values])=>({date,avg:values.reduce((a,b)=>a+b,0)/values.length,count:values.length}));
}
function bodyweightWeeklyRate(weeks){
  if(weeks.length<2)return null;
  const a=weeks[weeks.length-2],b=weeks[weeks.length-1],gap=(utcDay(b.date)-utcDay(a.date))/(7*86400000);
  return gap>0?(b.avg-a.avg)/gap:null;
}
function progressNumber(value,digits=1){return Number.isFinite(value)?Number(value.toFixed(digits)).toLocaleString():'—';}
function performanceText(row){return row?`${row.best.weight} kg × ${row.best.reps}`:'—';}
function renderProgress(){
  const catalog=progressExercises(),query=exerciseFilterQuery.trim().toLowerCase();
  const filtered=catalog.filter(e=>[e.name,e.dayName].some(value=>value.toLowerCase().includes(query)));
  if(!filtered.some(e=>e.key===selectedProgressExId))selectedProgressExId=filtered[0]?.key || null;
  const selected=filtered.find(e=>e.key===selectedProgressExId);
  const metrics={load:{title:'Top load',unit:'kg'},reps:{title:'Best set reps',unit:'reps'},volume:{title:'Session volume',unit:'kg·reps'},e1rm:{title:'Estimated 1RM',unit:'kg'}};
  const metric=metrics[progressMetric];
  let detail='<div class="card"><div class="empty">No exercises match your search.</div></div>';
  if(selected){
    const rows=exerciseProgress(selected.id,selected.name),latest=rows.at(-1),previous=rows.at(-2);
    const pr=getPRFor(selected.id,selected.name);
    const targets=selected.slots.map(slot=>{
      const last=lastSessionFor(slot.id,slot.name),rec=computeRecommendation(slot.definition,last?.log);
      return `<div class="progress-target"><strong>${escapeHtml(slot.dayName)}</strong> · ${slot.definition.sets} × ${slot.definition.repMin}–${slot.definition.repMax}<br>${renderCoachingVerdict(rec)}<div class="progress-next-action">Next target: ${escapeHtml(coachingSummary(rec))}</div><details class="coach-explanation"><summary>Why this target? · ${escapeHtml(slot.dayName)}</summary><div class="coach-detail">${escapeHtml(rec.detail)}</div></details></div>`;
    }).join('');
    const series=rows.filter(row=>row[progressMetric]!==null).map(row=>({date:row.date,startedAt:row.startedAt,value:row[progressMetric]}));
    const delta=latest && previous && latest[progressMetric]!==null && previous[progressMetric]!==null?latest[progressMetric]-previous[progressMetric]:null;
    detail=`<div class="card" id="exerciseProgressDetail">
      <h3 class="progress-title">${escapeHtml(selected.name)}</h3><div class="progress-caption">${escapeHtml(selected.dayName)}${selected.current?' · Shared movement history':' · Historical variation / removed exercise'}</div>
      <label class="progress-caption" for="progressMetric">Chart measure</label><select id="progressMetric" class="searchbox">${Object.entries(metrics).map(([key,value])=>`<option value="${key}" ${key===progressMetric?'selected':''}>${value.title}</option>`).join('')}</select>
      <div class="svgwrap">${renderSparkline(series,{label:metric.title,unit:metric.unit})}</div>
      <div class="progress-caption">${progressMetric==='reps'?'Most reps in one completed set; compare loads in the table below.':progressMetric==='volume'?'Sum of recorded kg × reps; includes external load only.':progressMetric==='e1rm'?'Formula estimate from your best set, not a measured maximum. No external-load estimate for bodyweight-only sets.':'Heaviest completed load in each workout.'}</div>
      <div class="progress-change">${delta===null?'Log two workouts in this range to compare.':`${metric.title}: ${delta>0?'+':''}${progressNumber(delta)} ${metric.unit} vs previous workout`}</div>
      <div class="metric-grid">
        <div class="metric"><div class="label">Latest workout · best set</div><div class="value" id="progressLatest">${performanceText(latest)}</div><div class="progress-caption">${latest?fmtDateFull(latest.date):'No completed workout in range'}</div></div>
        <div class="metric"><div class="label">Previous workout · best set</div><div class="value" id="progressPrevious">${performanceText(previous)}</div><div class="progress-caption">${previous?fmtDateFull(previous.date):'Need another workout'}</div></div>
        <div class="metric"><div class="label">All-time heaviest</div><div class="value">${pr?`${pr.heaviest.weight} kg × ${pr.heaviest.reps}`:'—'}</div></div>
        <div class="metric"><div class="label">All-time estimated 1RM</div><div class="value">${pr && pr.bestE1RM.weight>0?progressNumber(estOneRM(pr.bestE1RM.weight,pr.bestE1RM.reps))+' kg':'—'}</div></div>
      </div>
      <div class="progress-caption">Best set is the highest estimated 1RM, or most reps at bodyweight. All-time records include dates outside the selected range.</div>
      <div class="progress-next">${targets||'Historical records stay available; targets follow the current programme.'}</div>
    </div>
    <h2 class="section">Recent workouts · selected range</h2><div class="card progress-table-wrap">${rows.length?`<table class="progress-table"><thead><tr><th>Date / workout</th><th>Completed sets</th><th>Volume</th></tr></thead><tbody>${rows.slice(-12).reverse().map(row=>`<tr><td>${fmtDate(row.date)}<br><span class="progress-caption">${escapeHtml(row.sets[0].dayName)}</span></td><td>${row.sets.map(s=>`${s.weight} kg × ${s.reps}`).join('<br>')}</td><td>${progressNumber(row.volume,0)} kg·reps</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No completed workouts in this range.</div>'}</div>`;
  }
  return `<h2 class="section" style="margin-top:0;">Progress</h2>
    <p class="progress-caption">Matching exercise names share charts and records across days. Each day keeps its own prescription and next target. Rename a genuinely different variation to keep it separate.</p>
    <label class="progress-caption" for="progressRange">Date range</label><select class="searchbox" id="progressRange">${[['all','All history'],['90','Last 90 days'],['30','Last 30 days']].map(([value,label])=>`<option value="${value}" ${progressRange===value?'selected':''}>${label}</option>`).join('')}</select>
    <input class="searchbox" id="exSearch" aria-label="Search progress exercises" placeholder="Search exercise or workout…" value="${escapeHtml(exerciseFilterQuery)}">
    <select class="searchbox" id="exSelect" aria-label="Choose progress exercise">${filtered.map(e=>`<option value="${escapeHtml(e.key)}" ${e.key===selectedProgressExId?'selected':''}>${escapeHtml(e.name)} · ${escapeHtml(e.dayName)}${e.current?'':' (history)'}</option>`).join('')}</select>
    ${detail}${renderTrainingProgress()}${renderBodyweightProgress()}
    <h2 class="section">Personal records · all history</h2>${renderPRList()}`;
}
function renderTrainingProgress(){
  const weeks=weeklyTraining(),totals=weeks.reduce((sum,w)=>({workouts:sum.workouts+w.workouts,sets:sum.sets+w.sets,volume:sum.volume+w.volume}),{workouts:0,sets:0,volume:0});
  return `<h2 class="section">Training overview · selected range</h2><div class="card" id="trainingProgress"><div class="metric-grid">
    <div class="metric"><div class="label">Completed workouts</div><div class="value">${totals.workouts}</div></div><div class="metric"><div class="label">Completed sets</div><div class="value">${totals.sets}</div></div></div>
    <div class="progress-caption">Weekly recorded volume · kg × reps</div>${renderSparkline(weeks.map(w=>({date:w.date,value:w.volume})),{label:'Weekly training volume',unit:'kg·reps'})}
    <div class="progress-caption">Monday–Sunday weeks. Rest days and unfinished workouts are excluded. Missing weeks show zero; the first/current week may be partial. Bodyweight is not added to volume.</div></div>`;
}
function renderBodyweightProgress(){
  const days=dailyBodyweight().filter(row=>inProgressRange(row.date)),weeks=weeklyBodyweight(days),rate=bodyweightWeeklyRate(weeks),latest=days.at(-1);
  return `<h2 class="section">Body progress · selected range</h2><div class="card" id="bodyweightProgress">${renderSparkline(days.map(row=>({date:row.date,value:row.weight})),{label:'Bodyweight',unit:'kg'})}
    <div class="metric-grid"><div class="metric"><div class="label">Latest weigh-in</div><div class="value">${latest?progressNumber(latest.weight,2)+' kg':'—'}</div><div class="progress-caption">${latest?fmtDateFull(latest.date):'Log bodyweight in More'}</div></div>
    <div class="metric"><div class="label">Latest week average</div><div class="value">${weeks.length?progressNumber(weeks.at(-1).avg,2)+' kg':'—'}</div><div class="progress-caption">${weeks.length?weeks.at(-1).count+' weigh-ins':'No weigh-ins in range'}</div></div></div>
    <div class="progress-caption">${rate===null?'Need weigh-ins in two calendar weeks to show a weekly rate.':`Change between the latest two measured week averages: ${rate>0?'+':''}${progressNumber(rate,2)} kg/week.`} Monday–Sunday averages use recorded days only; missing weigh-ins are not invented. Current weeks may be partial.</div></div>${renderBodyInsights()}`;
}
function renderSparkline(series,options={}){
  const rows=series.filter(row=>Number.isFinite(row.value) && Number.isFinite(utcDay(row.date)));
  if(!rows.length)return '<div class="empty">No data in this range</div>';
  const w=440,h=150,left=52,right=16,top=18,bottom=32;
  const values=rows.map(row=>row.value),min=Math.min(...values),max=Math.max(...values),spread=max-min || Math.max(Math.abs(max)*.05,1);
  const low=max===min?min-spread/2:min,high=max===min?max+spread/2:max;
  const times=rows.map(row=>utcDay(row.date)+(Number(row.startedAt)||0)%86400000),first=Math.min(...times),last=Math.max(...times);
  const points=rows.map((row,i)=>({x:first===last?(left+w-right)/2:left+(times[i]-first)/(last-first)*(w-left-right),y:top+(high-row.value)/(high-low)*(h-top-bottom),row}));
  const path=points.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' '),label=options.label||'Trend',unit=options.unit||'';
  return `<svg role="img" aria-label="${escapeHtml(label)}" viewBox="0 0 ${w} ${h}" width="100%" height="150"><title>${escapeHtml(label)} · ${rows.length} observations</title>
    <path d="M${left},${top}H${w-right} M${left},${h-bottom}H${w-right}" stroke="var(--line)" fill="none"/>
    <text x="${left-5}" y="${top+4}" text-anchor="end" class="chart-label">${progressNumber(max)}</text><text x="${left-5}" y="${h-bottom}" text-anchor="end" class="chart-label">${progressNumber(min)}</text>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>
    ${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--accent)"><title>${escapeHtml(p.row.date)}: ${progressNumber(p.row.value,2)} ${escapeHtml(unit)}</title></circle>`).join('')}
    <text x="${left}" y="${h-6}" class="chart-label">${escapeHtml(rows[0].date)}</text><text x="${w-right}" y="${h-6}" text-anchor="end" class="chart-label">${rows.length>1?escapeHtml(rows.at(-1).date):''}</text></svg>`;
}
function renderPRList(){
  const prs=allExercisePRs().sort((a,b)=>estOneRM(b.pr.bestE1RM.weight,b.pr.bestE1RM.reps)-estOneRM(a.pr.bestE1RM.weight,a.pr.bestE1RM.reps));
  if(!prs.length)return '<div class="card"><div class="empty">Log workouts to start tracking records.</div></div>';
  return `<div class="card card-tight">${prs.map(p=>`<div class="pr-item"><div><div class="exname">${escapeHtml(p.name)}</div><div class="prsub">${escapeHtml(p.dayName)}${p.current?'':' · history'}</div>
    <div class="prsub">${p.pr.bestE1RM.weight>0?'Estimated 1RM '+progressNumber(estOneRM(p.pr.bestE1RM.weight,p.pr.bestE1RM.reps))+' kg · '+fmtDate(p.pr.bestE1RM.date):'Bodyweight rep record'}</div></div>
    <div style="text-align:right;"><div class="prval">${p.pr.heaviest.weight} kg × ${p.pr.heaviest.reps}</div><div class="prsub">Heaviest load · best reps at that load</div></div></div>`).join('')}</div>`;
}
