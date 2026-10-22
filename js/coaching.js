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
  const customRir=Number.isInteger(exDef.rirTarget) && exDef.rirTarget>=0 && exDef.rirTarget<=5;
  if(customRir && !deload)rirMin=rirMax=exDef.rirTarget;
  const finalRir=!customRir && isolation && phase.name==='Peak'?0:rirMin;
  const rir=rirMin===rirMax?String(rirMin):rirMin+'–'+rirMax;
  const rpe=rirMin===rirMax?String(10-rirMin):(10-rirMax)+'–'+(10-rirMin);
  return {phase:phase.name,plannedSets:planned,sets:deload?Math.max(1,Math.ceil(planned/2)):planned,
    deload,rirMin,rirMax,finalRir,effort:rir+' RIR · approx. RPE '+rpe+
      (!customRir && finalRir===0?' · final isolation set may reach 0 RIR / RPE 10':''),
    partialsAllowed:!deload && finalRir===0 && isolation && phase.name==='Peak' && !!exDef.finalPartials};
}
function computeBaseRecommendation(exDef, lastLog, options={}){
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
    const evidence=coachingEvidence(exDef,lastLog,context);
    const source=evidence.source;
    const prior=evidence.rows[1]?.sets || null;
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
      else type='maintain';
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
/* Phase 6 rules are explicit app heuristics, not a measurement of recovery. */
function coachingPlanKey(ex){
  return JSON.stringify([ex.sets,ex.repMin,ex.repMax,ex.cat||'moderate',ex.rirTarget??null,ex.restSec,ex.tempo||'',!!ex.perLeg]);
}
function coachingEvidence(ex,lastLog,context){
  const sessions=DATA.sessions.slice().sort((a,b)=>a.date.localeCompare(b.date) || a.startedAt-b.startedAt || String(a.id).localeCompare(String(b.id)));
  const index=sessions.findIndex(s=>s.exercises.includes(lastLog)),source=sessions[index],rows=[];
  let reset='Not enough comparable history.';
  if(!source)return {source:null,rows,reset,planChanged:false,stale:false};
  const definition=lastLog.definition;
  const planChanged=!!definition && coachingPlanKey(definition)!==coachingPlanKey(ex);
  const stale=(Date.parse(todayISO()+'T00:00:00Z')-Date.parse(source.date+'T00:00:00Z'))/86400000>28;
  if(planChanged || stale)return {source,rows,planChanged,stale,reset:planChanged?'The exercise prescription changed.':'The last matching workout is over 28 days old.'};
  let load=null,lastDate=source.date;
  for(let i=index;i>=0 && rows.length<3;i--){
    const session=sessions[i],log=session.exercises.find(e=>e.exerciseId===ex.id && e.name===lastLog.name);
    if(!log)continue;
    const def=log.definition||ex,effort=getCoachingPrescription(def,session.weekNumber||1),sets=log.sets?.slice(0,context.sets);
    const gap=(Date.parse(lastDate+'T00:00:00Z')-Date.parse(session.date+'T00:00:00Z'))/86400000;
    if(session.phase==='Deload' || effort.deload || session.readiness==='low' || coachingPlanKey(def)!==coachingPlanKey(ex) || effort.finalRir!==getCoachingPrescription(lastLog.definition||ex,source.weekNumber||1).finalRir || gap>28){reset='A deload, readiness report, prescription change or gap resets the comparison.';break;}
    if(sets?.length!==context.sets || !sets.every(usablePreviousSet) || !sets.every(s=>Math.abs(s.weight-sets[0].weight)<.000001)){reset='Incomplete or mixed-load working sets reset the comparison.';break;}
    if(load!==null && Math.abs(sets[0].weight-load)>.000001){reset='A load change resets the comparison.';break;}
    load=sets[0].weight;lastDate=session.date;
    rows.push({session,log,sets,total:sets.reduce((n,s)=>n+s.reps,0),targetRir:effort.finalRir,
      hard:Number.isInteger(log.effortRir) && log.effortRir>=0 && log.effortRir<effort.finalRir});
  }
  return {source,rows,reset,planChanged,stale};
}
function computeRecommendation(ex,lastLog,options={}){
  const base=computeBaseRecommendation(ex,lastLog,options),result={...base,context:{...base.context},prescription:base.prescription.map(s=>({...s}))};
  if(base.context.deload)return {...result,insight:{pattern:'deload',count:0,totals:[],sourceDate:null,message:'Scheduled deload: trend-based progression is paused.'}};
  const evidence=coachingEvidence(ex,lastLog,base.context),latest=evidence.rows[0],prior=evidence.rows[1];
  const totals=evidence.rows.slice().reverse().map(row=>row.total);
  let pattern='insufficient';
  if(totals.length===3){
    if(totals[2]>totals[1] && totals[1]>=totals[0])pattern='improving';
    else if(totals[2]<totals[1] && totals[1]<totals[0] && totals[0]-totals[2]>=Math.max(2,Math.ceil(totals[0]*.12)))pattern='declining';
    else if(totals[2]<=totals[1] && totals[1]<=totals[0])pattern='stall';
    else pattern='variable';
  }
  if(latest?.sets.every(set=>set.reps>=Math.max(1,Number(ex.repMax)||1)))pattern='target-met';
  const notes=[];
  const min=Math.max(1,Math.floor(Number(ex.repMin)||1)),max=Math.max(min,Math.floor(Number(ex.repMax)||min));
  const repeat=()=>{
    result.type='maintain';
    const previous=Array.isArray(lastLog?.sets)?lastLog.sets:[];
    result.prescription=result.prescription.map((set,i)=>usablePreviousSet(previous[i])?{weight:previous[i].weight,reps:Math.max(min,Math.min(max,previous[i].reps))}:set);
    const weights=result.prescription.map(s=>s.weight);
    result.nextWeight=weights.length && weights.every(w=>w===weights[0])?weights[0]:null;
  };
  if(!base.context.deload){
    if(evidence.planChanged || evidence.stale){
      repeat();notes.push(evidence.reset+' Hold progression and establish a fresh baseline at the current rep/effort target.');
    }else if(latest?.hard && prior?.hard && latest.total<=prior.total && ex.inc>0 && latest.sets[0].weight>0){
      const weight=Math.max(0,Number((latest.sets[0].weight-ex.inc).toFixed(6)));
      result.type='down';result.nextWeight=weight;result.prescription=result.prescription.map(()=>({weight,reps:min}));
      notes.push('Final-set RIR was below its prescribed target in two comparable workouts, without rep progress. Reduce by one programmed '+ex.inc+' kg increment and rebuild at the target effort.');
    }else if(latest?.hard && result.type!=='down'){
      repeat();notes.push('Reported final-set RIR '+latest.log.effortRir+' was harder than its '+latest.targetRir+' RIR target. Repeat the load and reps at the intended effort before progressing.');
    }else if(['stall','declining'].includes(pattern) && result.type!=='down'){
      repeat();notes.push(pattern==='stall'?'No increase in total working reps across three comparable workouts. Hold and review rest, technique and effort; a stall alone does not trigger a load reduction.':'Total working reps declined across three comparable workouts. Hold and rebuild; no automatic load reduction from this trend alone.');
    }
    if(options.readiness==='low'){
      if(result.type!=='down')repeat();
      const rir=Math.max(2,result.context.rirMin);
      result.context={...result.context,rirMin:rir,rirMax:Math.max(rir,result.context.rirMax),finalRir:Math.max(2,result.context.finalRir),partialsAllowed:false,
        effort:'Lower readiness: leave at least '+rir+' RIR · approx. RPE '+(10-rir)+' or easier · no failure-based partials'};
      notes.push('You marked readiness lower than usual for today. Progression is paused for this workout; this report does not carry into the next workout or diagnose recovery.');
    }
  }
  const trend=totals.length===3?'Three comparable workouts: '+totals.join(' → ')+' total working reps at '+latest.sets[0].weight+' kg.':evidence.rows.length+' comparable workout'+(evidence.rows.length===1?'':'s')+'; three are needed for a trend. '+evidence.reset;
  result.insight={pattern,count:totals.length,totals,sourceDate:evidence.source?.date||null,message:trend};
  if(notes.length){
    // Rebuild the action text and explanation after an override; never leave an old "increase" reason visible.
    result.targetTotal=result.prescription.reduce((n,s)=>n+s.reps,0);
    const load=result.nextWeight===null?(result.prescription.some(s=>s.weight!==null)?'Use listed set loads':'Choose a weight'):result.nextWeight+' KG';
    result.text=load+' · '+result.prescription.map(s=>s.reps).join(' / ')+' REPS · '+(result.type==='down'?'REDUCE LOAD':'HOLD / REBUILD');
    const performance=Array.isArray(lastLog?.sets)?lastLog.sets.filter(usablePreviousSet).map(s=>s.weight+'kg × '+s.reps).join(' | '):'';
    result.detail=(performance?'LAST TIME: '+performance+'. ':'')+notes.join(' ')+' Target: '+result.targetTotal+' total reps across '+result.sets+' planned sets.';
  }
  result.detail+=' '+trend;
  return result;
}
function rirOptions(value){return '<option value="">Not logged</option>'+[0,1,2,3,4,5].map(n=>`<option value="${n}" ${value===n?'selected':''}>${n}${n===5?'+':''} RIR</option>`).join('');}
function readinessOptions(value){return [['','Not logged'],['usual','Usual'],['low','Lower than usual']].map(([key,label])=>`<option value="${key}" ${value===key || (!value && key==='')?'selected':''}>${label}</option>`).join('');}
/* knee pain evaluation */
function evalKnee(score){
  if(score===null||score===undefined) return null;
  if(score<=1) return {level:'green',label:'Continue normally',cls:'pill-good'};
  if(score===2) return {level:'yellow',label:'Maintain load — do not progress',cls:'pill-warn'};
  if(score===3) return {level:'orange',label:'Stop this movement — substitute a hip-dominant/stable alternative',cls:'pill-warn'};
  return {level:'red',label:'Stop lower-body loading — seek clinical assessment',cls:'pill-danger'};
}
