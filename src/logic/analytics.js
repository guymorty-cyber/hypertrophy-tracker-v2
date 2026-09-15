export function flattenSets(sessions){
  return sessions.flatMap(s=>s.exercises?.flatMap(e=>e.sets?.map(x=>({...x,exercise:e.name,date:s.date,sessionId:s.id}))||[])||[]);
}

export function exerciseHistory(sessions,name){
  return sessions.filter(s=>s.exercises?.some(e=>e.name===name)).sort((a,b)=>b.date.localeCompare(a.date));
}

export function exercisePRs(sessions,name){
  const rows=[];
  for(const s of sessions.slice().sort((a,b)=>a.date.localeCompare(b.date))){
    const e=s.exercises?.find(x=>x.name===name); if(!e) continue;
    for(const set of e.sets||[]){
      const weight=Number(set.weight), reps=Number(set.reps); if(!weight||!reps) continue;
      const estimated=weight*(1+reps/30);
      rows.push({date:s.date,weight,reps,estimated,sessionId:s.id});
    }
  }
  let bestWeight=0,bestEstimated=0;
  return rows.map(r=>{const prWeight=r.weight>bestWeight;const prStrength=r.estimated>bestEstimated;if(prWeight)bestWeight=r.weight;if(prStrength)bestEstimated=r.estimated;return {...r,prWeight,prStrength};});
}

export function workoutStats(sessions){
  const volume=sessions.reduce((a,s)=>a+Number(s.volume||0),0);
  const sets=sessions.reduce((a,s)=>a+Number(s.sets||0),0);
  const reps=sessions.reduce((a,s)=>a+(s.exercises||[]).reduce((b,e)=>b+(e.sets||[]).reduce((c,x)=>c+Number(x.reps||0),0),0),0);
  return {workouts:sessions.length,volume,sets,reps};
}
