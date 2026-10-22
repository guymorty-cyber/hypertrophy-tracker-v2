/* recommendation engine — Phase 2 hypertrophy-specific progression */
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
  const sessions = DATA.sessions.slice().sort((a,b)=>
    a.date.localeCompare(b.date) || (a.startedAt||0)-(b.startedAt||0));
  // lastLog is an exercise log, not the {session, log} lookup wrapper.
  const lastIndex=sessions.findIndex(s=>s.exercises.includes(lastLog));
  for(let i=lastIndex-1;i>=0;i--){
    const exLog = sessions[i].exercises.find(e=>e.exerciseId===exDef.id && e.name===lastLog.name);
    if(!exLog) continue;
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

/* knee pain evaluation */
function evalKnee(score){
  if(score===null||score===undefined) return null;
  if(score<=1) return {level:'green',label:'Continue normally',cls:'pill-good'};
  if(score===2) return {level:'yellow',label:'Maintain load — do not progress',cls:'pill-warn'};
  if(score===3) return {level:'orange',label:'Stop this movement — substitute a hip-dominant/stable alternative',cls:'pill-warn'};
  return {level:'red',label:'Stop lower-body loading — seek clinical assessment',cls:'pill-danger'};
}

/* EXPLICIT WEIGHT COACHING FIX */
(function(){
  const originalComputeRecommendation = window.computeRecommendation || computeRecommendation;
  window.computeRecommendation = function(exDef, lastLog){
    const rec = originalComputeRecommendation(exDef, lastLog);
    if(!rec) return rec;

    // The coach must always answer the two progressive-overload questions:
    // 1) What did I do last time?
    // 2) What exactly should I do today?
    const completed = lastLog && lastLog.sets ? lastLog.sets.filter(s =>
      s.completed && Number(s.weight) > 0 && Number(s.reps) > 0
    ) : [];

    if(completed.length){
      const lastPerformance = completed.map(s => `${Number(s.weight)}kg × ${Number(s.reps)}`).join('  |  ');
      const lastWeight = Number(completed[0].weight);
      const lastReps = completed.map(s => Number(s.reps));
      const lastTotal = lastReps.reduce((a,b)=>a+b,0);
      const recommendedWeight = rec.nextWeight !== null && rec.nextWeight !== undefined
        ? Number(rec.nextWeight)
        : lastWeight;
      const targetReps = rec.targetReps || `${exDef.repMin}–${exDef.repMax}`;

      if(rec.nextWeight !== null && rec.nextWeight !== undefined && Number(rec.nextWeight) > 0){
        if(rec.type === 'maintain'){
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — HOLD WEIGHT`;
        }else if(rec.type === 'up'){
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — INCREASE LOAD`;
        }else if(rec.type === 'down'){
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — REDUCE LOAD`;
        }else{
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — BEAT LAST TIME`;
        }
      }else{
        rec.text = `TODAY: ${lastWeight} KG × ${targetReps} REPS — BEAT LAST TIME`;
      }

      rec.detail = `LAST TIME: ${lastPerformance} (${lastTotal} total reps).  TODAY: ${recommendedWeight} KG × ${targetReps} REPS. ${rec.detail || ''}`.trim();
    }else{
      rec.text = `TODAY: CHOOSE A WEIGHT × ${rec.targetReps || `${exDef.repMin}–${exDef.repMax}`} REPS`;
      rec.detail = `No completed previous working sets are available. Choose a load that allows the target reps with good technique. ${rec.detail || ''}`.trim();
    }
    return rec;
  };

})();
