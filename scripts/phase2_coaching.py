from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

start = s.find('/* recommendation engine — pure double progression on reps */')
end = s.find('/* knee pain evaluation */', start)
if start == -1 or end == -1:
    raise SystemExit('Phase 2 patch anchors not found')

new_engine = r'''/* recommendation engine — Phase 2 hypertrophy-specific progression */
function computeRecommendation(exDef, lastLog){
  const range = `${exDef.repMin}–${exDef.repMax}`;
  const roundWeight = (w) => Math.round(w * 4) / 4;
  const nextLoad = (w, direction=1) => roundWeight(Math.max(0, w + direction * (Number(exDef.inc) || 1)));

  if(!lastLog || !lastLog.sets || !lastLog.sets.length){
    return {
      type:'first', nextWeight:null, targetReps:range,
      text:`Start at a load you can perform for ${range} clean reps.`,
      detail:'No previous performance yet. Establish a strong baseline — controlled reps and consistent technique matter more than forcing load.'
    };
  }

  const completed = lastLog.sets.filter(s => s.completed && Number(s.weight)>0 && Number(s.reps)>0);
  if(!completed.length){
    return {
      type:'first', nextWeight:null, targetReps:range,
      text:`Choose a load for ${range} clean reps.`,
      detail:'The previous session has no completed working sets, so this session resets the baseline.'
    };
  }

  const reps = completed.map(s=>Number(s.reps));
  const weights = completed.map(s=>Number(s.weight));
  const sortedWeights = weights.slice().sort((a,b)=>a-b);
  const workingWeight = sortedWeights[Math.floor(sortedWeights.length/2)];
  const totalReps = reps.reduce((a,b)=>a+b,0);
  const avgReps = totalReps / reps.length;
  const minReps = Math.min(...reps);
  const maxReps = Math.max(...reps);
  const prescribedSets = Number(exDef.sets) || completed.length;
  const completeSetCount = completed.length;
  const enoughSets = completeSetCount >= prescribedSets;
  const allAtTop = enoughSets && reps.slice(0,prescribedSets).every(r=>r >= exDef.repMax);
  const allAtLeastMin = reps.every(r=>r >= exDef.repMin);
  const belowMinCount = reps.filter(r=>r < exDef.repMin).length;
  const materiallyBelow = belowMinCount >= Math.ceil(reps.length * 0.67);

  // Compare the most recent session with the preceding comparable session when available.
  let priorComparable = null;
  const sessions = (DATA.sessions || []).slice().sort((a,b)=>a.date<b.date?-1:1);
  for(let i=sessions.length-1;i>=0;i--){
    const exLog = sessions[i].exercises && sessions[i].exercises.find(e=>e.exerciseId===exDef.id);
    if(!exLog || sessions[i].id===lastLog.session.id) continue;
    const sets = (exLog.sets||[]).filter(st=>st.completed && Number(st.weight)>0 && Number(st.reps)>0);
    if(sets.length){ priorComparable = {sets, session:sessions[i]}; break; }
  }

  const priorReps = priorComparable ? priorComparable.sets.map(s=>Number(s.reps)) : [];
  const priorTotal = priorReps.reduce((a,b)=>a+b,0);
  const priorWeight = priorComparable && priorComparable.sets.length ? priorComparable.sets.map(s=>Number(s.weight)).sort((a,b)=>a-b)[Math.floor(priorComparable.sets.length/2)] : null;
  const sameLoadAsPrior = priorWeight !== null && Math.abs(priorWeight-workingWeight) < 0.001;
  const meaningfulDrop = priorComparable && sameLoadAsPrior && enoughSets && priorReps.length >= Math.min(prescribedSets, 2) && totalReps <= priorTotal - Math.max(2, Math.ceil(priorTotal*0.12));

  // Do not chase load when performance is down. One bad set is not a reason to deload.
  if(meaningfulDrop){
    return {
      type:'maintain', nextWeight:workingWeight, targetReps:range,
      text:`STAY AT ${workingWeight} KG — rebuild your reps.`,
      detail:`Performance was down versus the previous comparable session (${priorTotal} → ${totalReps} total reps at the same load). Keep the load stable and aim to recover performance before progressing.`
    };
  }

  // Only add load after a genuinely complete performance at the top of the range.
  if(allAtTop){
    const next = nextLoad(workingWeight, 1);
    return {
      type:'up', nextWeight:next, targetReps:range,
      text:`INCREASE TO ${next} KG — aim for ${exDef.repMin}–${exDef.repMax}.`,
      detail:`You hit ${exDef.repMax} reps on every prescribed set at ${workingWeight}kg. Increase by the exercise's programmed increment and rebuild from the lower end of the range.`
    };
  }

  // If most sets are below the minimum, the load is currently too high for productive work.
  // Otherwise hold the load and improve reps — this avoids unnecessary weight changes on normal fatigue days.
  if(materiallyBelow && !allAtLeastMin){
    const next = nextLoad(workingWeight, -1);
    return {
      type:'down', nextWeight:next, targetReps:range,
      text:`REDUCE TO ${next} KG — rebuild ${range} reps.`,
      detail:`${belowMinCount} of ${reps.length} completed sets fell below ${exDef.repMin} reps. Use the smaller load only when this is a repeated/clear performance issue; quality reps come first.`
    };
  }

  const targetTotal = Math.min(exDef.repMax * prescribedSets, totalReps + 1);
  const targetAvg = Math.min(exDef.repMax, Math.max(exDef.repMin, Math.ceil(targetTotal / prescribedSets)));
  const missingSets = Math.max(0, prescribedSets - completeSetCount);
  const setNote = missingSets ? ` Complete all ${prescribedSets} working sets before judging progression.` : '';
  const qualityNote = maxReps >= exDef.repMax ? ` You have reached the top on some sets; bring the remaining sets up before adding load.` : '';

  return {
    type:'reps', nextWeight:workingWeight, targetReps:`${targetAvg}+`,
    text:`STAY AT ${workingWeight} KG — beat ${totalReps} total reps.`,
    detail:`Last time: ${reps.join(' / ')} reps (${totalReps} total). Aim for at least ${targetTotal} total reps next time before increasing the load.${setNote}${qualityNote}`
  };
}

'''

s = s[:start] + new_engine + s[end:]

css = r'''
/* PHASE 2 HYPERTROPHY COACHING */
.reco-coach .coach-main{text-transform:none}
.reco-coach .coach-detail strong{color:var(--text)}
'''
if '/* PHASE 2 HYPERTROPHY COACHING */' not in s:
    s = s.replace('</style>', css + '\n</style>', 1)

p.write_text(s, encoding='utf-8')
