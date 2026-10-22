/* Phase 1: deterministic double progression, phase targets and explainable prescriptions. */
function getCoachingPrescription(exDef, weekNumber=getWeekNumber()){
  const phase=getPhase(weekNumber);
  const planned=Math.max(1,Math.floor(Number(exDef.sets)||1));
  const isolation=exDef.cat==='isolation';
  const deload=phase.name==='Deload';
  let rirMin=1,rirMax=1;
  if(deload){rirMin=3;rirMax=4;}
  else if(phase.name==='Calibration'){rirMin=rirMax=isolation?1:2;}
  else if(!isolation && ['Overload','Intensification'].includes(phase.name)){rirMax=2;}
  const finalRir=isolation && phase.name==='Peak'?0:rirMin;
  const rir=rirMin===rirMax?String(rirMin):rirMin+'–'+rirMax;
  const rpe=rirMin===rirMax?String(10-rirMin):(10-rirMax)+'–'+(10-rirMin);
  return {phase:phase.name,plannedSets:planned,sets:deload?Math.max(1,Math.ceil(planned/2)):planned,
    deload,rirMin,rirMax,finalRir,effort:rir+' RIR · approx. RPE '+rpe+
      (finalRir===0?' · final isolation set may reach 0 RIR / RPE 10':''),
    partialsAllowed:!deload && isolation && phase.name==='Peak' && !!exDef.finalPartials};
}
function computeRecommendation(exDef, lastLog, options={}){
  const context=getCoachingPrescription(exDef,options?.weekNumber ?? getWeekNumber());
  const min=Math.max(1,Math.floor(Number(exDef.repMin)||1));
  const max=Math.max(min,Math.floor(Number(exDef.repMax)||min));
  const count=context.sets,range=min+'–'+max;
  const valid=set=>!!set && set.completed===true && Number.isFinite(set.weight) && set.weight>=0 && Number.isInteger(set.reps) && set.reps>0;
  const previousSets=Array.isArray(lastLog?.sets)?lastLog.sets:[];
  const all=previousSets.filter(valid);
  const required=previousSets.slice(0,count);
  const completed=required.filter(valid);
  const full=required.length===count && required.every(valid);
  const weights=completed.map(set=>set.weight);
  const uniform=weights.length>0 && weights.every(weight=>Math.abs(weight-weights[0])<0.000001);
  const weight=uniform?weights[0]:null;
  const reps=completed.map(set=>set.reps);
  const total=reps.reduce((sum,r)=>sum+r,0);
  const increment=Number.isFinite(Number(exDef.inc)) && Number(exDef.inc)>0?Number(exDef.inc):0;
  const stepped=(load,direction)=>Math.max(0,Number((load+direction*increment).toFixed(6)));
  let prescription=Array.from({length:count},(_,i)=>({weight:valid(required[i])?required[i].weight:weight,
    reps:valid(required[i])?Math.min(max,Math.max(min,required[i].reps)):min}));
  let type='first',reason='No completed previous working sets are available. Establish a baseline with controlled reps.';
  let nextWeight=weight;

  if(context.deload){
    type='maintain';
    prescription=prescription.map(set=>({...set,reps:min}));
    reason='Deload: use '+count+' working set'+(count===1?'':'s')+' instead of '+context.plannedSets+
      '. Do not chase rep or load records. Keep 3–4 reps in reserve; reduce the load if needed. No partials.';
  }else if(!all.length){
    prescription=prescription.map(set=>({weight:null,reps:min}));
  }else if(!uniform){
    type='maintain';nextWeight=null;
    reason='Previous sets used different loads. Keep the listed set loads and rebuild within '+range+
      ' reps; an average load would hide your top and back-off sets. No automatic load increase.';
  }else if(!full){
    type='maintain';
    reason='Only '+completed.length+' of '+count+' planned working sets were completed. Complete the full prescription before increasing the load.';
  }else{
    const sessions=DATA.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.startedAt||0)-(b.startedAt||0));
    const index=sessions.findIndex(session=>session.exercises.includes(lastLog));
    const source=sessions[index];
    let prior=null;
    for(let i=index-1;i>=0;i--){
      if(sessions[i].phase==='Deload') continue;
      const log=sessions[i].exercises.find(e=>e.exerciseId===exDef.id && e.name===lastLog.name);
      const sets=log?.sets?.slice(0,count);
      if(sets?.length===count && sets.every(set=>valid(set) && Math.abs(set.weight-weight)<0.000001)){
        prior=sets;break;
      }
    }
    const priorTotal=prior?.reduce((sum,set)=>sum+set.reps,0) || 0;
    const below=sets=>sets.filter(set=>set.reps<min).length>=Math.ceil(count*0.67);
    const repeatedLow=source?.phase!=='Deload' && prior && below(required) && below(prior);
    const drop=source?.phase!=='Deload' && prior && total<=priorTotal-Math.max(2,Math.ceil(priorTotal*0.12));
    if(repeatedLow && increment>0 && weight>0){
      type='down';nextWeight=stepped(weight,-1);
      prescription=prescription.map(()=>({weight:nextWeight,reps:min}));
      reason='Most prescribed sets fell below '+min+' reps in two comparable workouts. Reduce by the exercise’s '+increment+' kg increment and rebuild.';
    }else if(drop){
      type='maintain';
      reason='Performance was down versus the preceding comparable workout ('+priorTotal+' → '+total+
        ' total reps at the same load). Hold the load and rebuild; one difficult workout does not trigger a reduction.';
    }else if(reps.every(reps=>reps>=max) && increment>0 && weight>0){
      type='up';nextWeight=stepped(weight,1);
      prescription=prescription.map(()=>({weight:nextWeight,reps:min}));
      reason='Every planned set reached '+max+' reps at '+weight+' kg. Increase by this exercise’s '+increment+' kg increment and return to the lower rep target.';
    }else if(reps.some(reps=>reps<min)){
      type='maintain';
      reason='Rebuild into the '+range+' rep range at the listed load. One workout below the target does not trigger an automatic load reduction.';
    }else{
      type='reps';
      const target=prescription.find(set=>set.reps<max);
      if(target) target.reps++;
      reason=target?'Keep the load and aim for one more total rep across the planned sets before adding weight.':
        (weight===0?'Bodyweight sets: maintain the rep standard. No external load is inferred from a 0 kg entry.':
        'The rep target is met, but this exercise has no positive load increment. Keep the load until you set an equipment-appropriate increment.');
    }
  }
  const lastPerformance=all.map(set=>set.weight+'kg × '+set.reps).join(' | ');
  const targetTotal=prescription.reduce((sum,set)=>sum+set.reps,0);
  const loadText=nextWeight===null?(all.length?'Use listed set loads':'Choose a weight'):nextWeight+' KG';
  const targets=prescription.map(set=>set.reps).join(' / ');
  const action={up:'INCREASE LOAD',down:'REDUCE LOAD',maintain:'HOLD / REBUILD',reps:'BUILD REPS',first:'SET BASELINE'}[type];
  return {type,nextWeight,targetReps:range,targetTotal,sets:count,prescription,context,
    text:loadText+' · '+(all.length?targets+' REPS':count+' SETS × '+range+' REPS')+' · '+action,
    detail:(lastPerformance?'LAST TIME: '+lastPerformance+'. ':'')+reason+
      ' Target: '+targetTotal+' total reps across '+count+' planned sets. '+
      'RIR means reps you could still perform with good technique; RPE is the approximate effort equivalent.'};
}
/* knee pain evaluation */
function evalKnee(score){
  if(score===null||score===undefined) return null;
  if(score<=1) return {level:'green',label:'Continue normally',cls:'pill-good'};
  if(score===2) return {level:'yellow',label:'Maintain load — do not progress',cls:'pill-warn'};
  if(score===3) return {level:'orange',label:'Stop this movement — substitute a hip-dominant/stable alternative',cls:'pill-warn'};
  return {level:'red',label:'Stop lower-body loading — seek clinical assessment',cls:'pill-danger'};
}
