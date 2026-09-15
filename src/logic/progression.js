export function fmtWeight(v){const n=Number(v);return Number.isInteger(n)?String(n):n.toFixed(1).replace(/\.0$/,'')}
export function lastExercise(sessions,name){const matches=sessions.filter(s=>s.exercises?.some(e=>e.name===name)).sort((a,b)=>b.date.localeCompare(a.date));return matches[0]?.exercises?.find(e=>e.name===name)||null}
export function coach(ex,previous){
 if(!previous?.sets?.length)return{headline:'BASELINE: choose a controlled load',detail:`Aim for ${ex.min}–${ex.max} reps. Your first completed session establishes the load for future progression.`,tone:'maintain'};
 const sets=previous.sets.filter(x=>Number(x.weight)>0&&Number(x.reps)>0);if(!sets.length)return{headline:`TODAY: ${ex.min}–${ex.max} REPS`,detail:'No usable previous load was recorded.',tone:'maintain'};
 const weight=Number(sets[0].weight);const allTop=sets.length>=ex.sets&&sets.slice(0,ex.sets).every(x=>Number(x.reps)>=ex.max);const avg=sets.reduce((a,x)=>a+Number(x.reps),0)/sets.length;
 if(allTop){const next=weight+ex.increment;return{headline:`TODAY: ${fmtWeight(next)} KG × ${ex.min}–${ex.max} REPS`,detail:`LAST TIME: ${sets.map(x=>`${fmtWeight(x.weight)}kg × ${x.reps}`).join(' | ')}. Every prescribed set reached the top of the range, so increase the load.`,tone:'up',weight:next}}
 const target=Math.min(ex.max,Math.max(ex.min,Math.ceil(avg)+1));return{headline:`TODAY: ${fmtWeight(weight)} KG × ${target}+ REPS`,detail:`LAST TIME: ${sets.map(x=>`${fmtWeight(x.weight)}kg × ${x.reps}`).join(' | ')}. Keep the load and beat your previous reps before increasing weight.`,tone:'reps',weight}
}
