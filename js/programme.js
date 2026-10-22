let selectedEditorDayId=null;
function programmeId(prefix){
  const used=new Set(DATA.program.flatMap(d=>[String(d.id),...d.exercises.map(e=>String(e.id))]));
  for(const s of [...DATA.sessions,...(DATA.activeSession?[DATA.activeSession]:[])]){used.add(String(s.dayId));s.exercises.forEach(e=>used.add(String(e.exerciseId)));}
  let id;
  do{id=prefix+'_'+(typeof crypto!=='undefined' && crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2));}while(used.has(id));
  return id;
}
function changeProgramme(edit){
  const program=JSON.parse(JSON.stringify(DATA.program));
  if(edit(program)===false)return false;
  const resetRest=DATA.restDayId && !program.some(d=>d.id===DATA.restDayId && d.type==='rest');
  return commitData({...DATA,program,...(resetRest?{restDayId:null,restDayOpen:false}:{})});
}
function moveProgrammeDay(dayId,direction){
  return changeProgramme(program=>{
    const i=program.findIndex(d=>d.id===dayId),j=i+direction;
    if(i<0 || ![-1,1].includes(direction) || j<0 || j>=program.length)return false;
    [program[i],program[j]]=[program[j],program[i]];
  });
}
function duplicateProgrammeDay(dayId){
  const source=DATA.program.find(d=>d.id===dayId);if(!source)return false;
  const day=JSON.parse(JSON.stringify(source));day.id=programmeId('day');day.name+=' copy';day.short=day.name;
  day.exercises.forEach(ex=>ex.id=programmeId('ex'));
  if(!changeProgramme(program=>program.splice(program.findIndex(d=>d.id===dayId)+1,0,day)))return false;
  selectedEditorDayId=day.id;return true;
}
function deleteProgrammeDay(dayId){
  const day=DATA.program.find(d=>d.id===dayId);if(!day)return false;
  if(DATA.program.length<=1){alert('Keep at least one programme day.');return false;}
  if(DATA.activeSession && DATA.activeSession.dayId===dayId){alert('Finish or discard the active workout before deleting its programme day.');return false;}
  if(!confirm(`Remove "${day.name}" and its programme exercises? Saved workouts and Progress records stay available.`))return false;
  if(!changeProgramme(program=>{program.splice(program.findIndex(d=>d.id===dayId),1);}))return false;
  selectedEditorDayId=DATA.program[0].id;return true;
}
function saveProgrammeDay(dayId,fields,expectedRaw=null){
  const current=dayId?DATA.program.find(d=>d.id===dayId):null;
  if(dayId && (!current || (expectedRaw!==null && JSON.stringify(current)!==expectedRaw))){alert('This day changed. Reopen its settings before saving.');return false;}
  const name=String(fields.name||'').trim();
  if(!name || !['training','rest'].includes(fields.type)){alert('Enter a day name and choose Training or Rest.');return false;}
  if(fields.type==='rest' && current?.exercises.length){alert('A rest day must have no exercises. Remove its exercises first, or add a new rest day.');return false;}
  const day={...(current||{id:programmeId('day'),exercises:[]}),name,short:name,type:fields.type,isLower:fields.type==='training' && !!fields.isLower};
  if(!changeProgramme(program=>{if(current)program[program.findIndex(d=>d.id===dayId)]=day;else program.push(day);}))return false;
  selectedEditorDayId=day.id;return true;
}
function openProgrammeDayModal(dayId=null){
  const day=dayId?DATA.program.find(d=>d.id===dayId):null;
  if(dayId && !day)return;
  const expectedRaw=day?JSON.stringify(day):null;
  showModal(`<h2>${day?'Edit day':'Add day'}</h2><div class="sub">Programme changes apply to future workouts. Your current workout and History stay intact.</div>
    <div class="field"><label for="dayEditName">Day name</label><input id="dayEditName" value="${escapeHtml(day?.name||'')}" placeholder="e.g. Lower B — Quads"></div>
    <div class="field"><label for="dayEditType">Day type</label><select id="dayEditType"><option value="training" ${day?.type!=='rest'?'selected':''}>Training</option><option value="rest" ${day?.type==='rest'?'selected':''}>Rest</option></select></div>
    <label class="programme-check"><input type="checkbox" id="dayEditLower" ${day?.isLower?'checked':''}> Lower-body day · show knee check-ins</label>
    <button class="btn btn-primary" id="dayEditSave">${day?'Save changes':'Add day'}</button><button class="btn btn-ghost" data-action="closeModal">Cancel</button>`);
  document.getElementById('dayEditSave').onclick=()=>{
    if(!saveProgrammeDay(dayId,{name:document.getElementById('dayEditName').value,type:document.getElementById('dayEditType').value,isLower:document.getElementById('dayEditLower').checked},expectedRaw))return;
    closeModal();renderTab();
  };
}
function moveProgrammeExercise(dayId,exId,direction){
  return changeProgramme(program=>{
    const day=program.find(d=>d.id===dayId);if(!day)return false;
    const i=day.exercises.findIndex(e=>e.id===exId),j=i+direction;
    if(i<0 || ![-1,1].includes(direction) || j<0 || j>=day.exercises.length)return false;
    [day.exercises[i],day.exercises[j]]=[day.exercises[j],day.exercises[i]];
  });
}
function deleteProgrammeExercise(dayId,exId){
  const day=DATA.program.find(d=>d.id===dayId),ex=day?.exercises.find(e=>e.id===exId);if(!ex)return false;
  if(!confirm(`Remove "${ex.name}" from future workouts? Your active workout, History and Progress records stay available.`))return false;
  return changeProgramme(program=>{const d=program.find(d=>d.id===dayId);d.exercises=d.exercises.filter(e=>e.id!==exId);});
}
function duplicateProgrammeExercise(dayId,exId){
  return changeProgramme(program=>{
    const day=program.find(d=>d.id===dayId),i=day?.exercises.findIndex(e=>e.id===exId);if(i===undefined || i<0)return false;
    const copy=JSON.parse(JSON.stringify(day.exercises[i]));copy.id=programmeId('ex');day.exercises.splice(i+1,0,copy);
  });
}
function renderDayEditor(dayIdx){
  const day=DATA.program[dayIdx],el=document.getElementById('dayEditorList');if(!day || !el)return;
  selectedEditorDayId=day.id;
  el.innerHTML=`<div class="programme-actions">
    <button id="programmeDaySettings">Day settings</button><button id="programmeDayCopy">Copy day</button>
    <button id="programmeDayUp" ${dayIdx===0?'disabled':''}>Move day up</button><button id="programmeDayDown" ${dayIdx===DATA.program.length-1?'disabled':''}>Move day down</button>
    <button id="programmeDayDelete" ${DATA.program.length<=1?'disabled':''}>Remove day</button></div>
    <div class="progress-caption">${day.type==='rest'?'Rest day':day.isLower?'Training · lower body · knee check-ins':'Training'} · ${day.exercises.reduce((n,e)=>n+e.sets,0)} programmed sets. Changes apply to future workouts.</div>
    ${day.exercises.map((ex,i)=>`<div class="day-editor-row"><div class="exname">${i+1}. ${escapeHtml(ex.currentDisplay||ex.name)}<br><span class="progress-caption">${ex.sets} sets · ${ex.repMin}–${ex.repMax} reps · ${ex.restSec}s rest${ex.rirTarget!=null?' · '+ex.rirTarget+' RIR':''}${ex.tempo?' · tempo '+escapeHtml(ex.tempo):''}</span></div><div class="arrows">
      <button aria-label="Move exercise up" data-move="up" data-exid="${ex.id}" ${i===0?'disabled':''}>↑</button><button aria-label="Move exercise down" data-move="down" data-exid="${ex.id}" ${i===day.exercises.length-1?'disabled':''}>↓</button>
      <button aria-label="Edit exercise" data-editex="${ex.id}">Edit</button><button aria-label="Copy exercise" data-copyex="${ex.id}">Copy</button><button aria-label="Remove exercise" data-delex="${ex.id}">Remove</button></div></div>`).join('') || `<div class="empty">${day.type==='rest'?'Rest day — no exercises.':'No exercises yet. Add one before starting this workout.'}</div>`}
    ${day.type==='training'?'<button class="btn btn-outline btn-sm" id="programmeAddExercise" style="width:100%;margin-top:12px;">+ Add exercise</button>':''}`;
  const after=fn=>()=>{if(fn())renderTab();};
  document.getElementById('programmeDaySettings').onclick=()=>openProgrammeDayModal(day.id);
  document.getElementById('programmeDayCopy').onclick=after(()=>duplicateProgrammeDay(day.id));
  document.getElementById('programmeDayDelete').onclick=after(()=>deleteProgrammeDay(day.id));
  document.getElementById('programmeDayUp').onclick=after(()=>moveProgrammeDay(day.id,-1));
  document.getElementById('programmeDayDown').onclick=after(()=>moveProgrammeDay(day.id,1));
  if(day.type==='training')document.getElementById('programmeAddExercise').onclick=()=>openExerciseEditModal(dayIdx,null);
  el.querySelectorAll('[data-move]').forEach(b=>b.onclick=after(()=>moveProgrammeExercise(day.id,b.dataset.exid,b.dataset.move==='up'?-1:1)));
  el.querySelectorAll('[data-editex]').forEach(b=>b.onclick=()=>openExerciseEditModal(DATA.program.findIndex(d=>d.id===day.id),b.dataset.editex));
  el.querySelectorAll('[data-copyex]').forEach(b=>b.onclick=after(()=>duplicateProgrammeExercise(day.id,b.dataset.copyex)));
  el.querySelectorAll('[data-delex]').forEach(b=>b.onclick=after(()=>deleteProgrammeExercise(day.id,b.dataset.delex)));
}
function saveProgrammeExercise(dayId,exId,fields,expectedRaw=null){
  const day=DATA.program.find(d=>d.id===dayId),current=day?.exercises.find(e=>e.id===exId);
  if(!day || day.type!=='training' || (exId && (!current || (expectedRaw!==null && JSON.stringify(current)!==expectedRaw)))){alert('This exercise or day changed. Reopen the editor before saving.');return false;}
  const {name,sets,repMin,repMax,restSec,inc,cat,rirTarget,tempo,note}=fields;
  if(typeof name!=='string' || !name.trim() || ![sets,repMin,repMax,restSec].every(Number.isInteger) || sets<1 || sets>100 || repMin<1 || repMax<repMin || restSec<0 || !Number.isFinite(inc) || inc<0 || !['heavy','moderate','isolation'].includes(cat) || (rirTarget!==null && (!Number.isInteger(rirTarget) || rirTarget<0 || rirTarget>5)) || typeof tempo!=='string' || tempo.length>80 || typeof note!=='string' || !Array.isArray(fields.alts) || fields.alts.some(a=>typeof a!=='string')){
    alert('Check the name, whole-number sets/reps/rest, non-negative weight step, category, RIR (0–5 or phase default) and tempo (80 characters maximum).');return false;
  }
  const edited={...(current||{id:programmeId('ex')}),name:name.trim(),sets,repMin,repMax,restSec,inc,cat,rirTarget,tempo:tempo.trim(),note:note.trim(),perLeg:!!fields.perLeg,alts:[...new Set(fields.alts.map(a=>a.trim()).filter(a=>a && a!==name.trim()))]};
  if(edited.currentDisplay && edited.currentDisplay!==edited.name && (name.trim()!==current.name || !edited.alts.includes(edited.currentDisplay)))delete edited.currentDisplay;
  return changeProgramme(program=>{const d=program.find(d=>d.id===dayId);if(current)d.exercises[d.exercises.findIndex(e=>e.id===exId)]=edited;else d.exercises.push(edited);});
}
function openExerciseEditModal(dayIdx,exId){
  const day=DATA.program[dayIdx];if(!day || day.type!=='training')return;
  const current=exId?day.exercises.find(e=>e.id===exId):null;if(exId && !current)return;
  const ex=current||{name:'',sets:3,repMin:8,repMax:12,restSec:90,inc:2.5,cat:'moderate',note:''},expectedRaw=current?JSON.stringify(current):null;
  showModal(`<h2>${current?'Edit exercise':'Add exercise'}</h2><div class="sub">Changes apply to future workouts. Your current workout and history keep their existing settings.</div>
    <div class="field"><label for="fEditName">Exercise name</label><input id="fEditName" value="${escapeHtml(ex.name)}" placeholder="e.g. Seated Cable Row"></div>
    <div class="field"><label for="fEditSets">Sets</label><input id="fEditSets" type="number" min="1" max="100" step="1" inputmode="numeric" value="${ex.sets}"></div>
    <div class="programme-fields"><div class="field"><label for="fEditRepMin">Rep min</label><input id="fEditRepMin" type="number" min="1" step="1" inputmode="numeric" value="${ex.repMin}"></div><div class="field"><label for="fEditRepMax">Rep max</label><input id="fEditRepMax" type="number" min="1" step="1" inputmode="numeric" value="${ex.repMax}"></div></div>
    <div class="programme-fields"><div class="field"><label for="fEditRest">Rest (seconds)</label><input id="fEditRest" type="number" min="0" step="1" inputmode="numeric" value="${ex.restSec}"></div><div class="field"><label for="fEditInc">Weight step (kg)</label><input id="fEditInc" type="number" min="0" step="any" inputmode="decimal" value="${ex.inc}"></div></div>
    <div class="field"><label for="fEditCategory">Exercise category</label><select id="fEditCategory">${[['heavy','Heavy compound'],['moderate','Moderate compound'],['isolation','Isolation']].map(([value,label])=>`<option value="${value}" ${(ex.cat||'moderate')===value?'selected':''}>${label}</option>`).join('')}</select></div>
    <div class="field"><label for="fEditRir">RIR target (optional, 0–5)</label><input id="fEditRir" type="number" min="0" max="5" step="1" inputmode="numeric" value="${ex.rirTarget??''}" placeholder="Phase default"><div class="progress-caption">Blank uses the programme phase. Deload always uses 3–4 RIR.</div></div>
    <div class="field"><label for="fEditTempo">Tempo (optional)</label><input id="fEditTempo" maxlength="80" value="${escapeHtml(ex.tempo||'')}" placeholder="e.g. 3–1–1–0: lower, pause, lift, pause"></div>
    <label class="programme-check"><input id="fEditPerLeg" type="checkbox" ${ex.perLeg?'checked':''}> Reps are per leg</label>
    <div class="field"><label for="fEditAlts">Alternatives (one per line)</label><textarea id="fEditAlts">${escapeHtml((ex.alts||[]).join('\n'))}</textarea></div>
    <div class="field"><label for="fEditNote">Notes</label><textarea id="fEditNote">${escapeHtml(ex.note||'')}</textarea></div>
    <button class="btn btn-primary" id="fEditSave">${current?'Save changes':'Add exercise'}</button><button class="btn btn-ghost" data-action="closeModal">Cancel</button>`);
  document.getElementById('fEditSave').onclick=()=>{
    const number=id=>{const value=document.getElementById(id).value.trim();return value===''?NaN:Number(value);};
    const rirInput=document.getElementById('fEditRir'),rir=rirInput.value.trim();
    const fields={name:document.getElementById('fEditName').value,sets:number('fEditSets'),repMin:number('fEditRepMin'),repMax:number('fEditRepMax'),restSec:number('fEditRest'),inc:number('fEditInc'),cat:document.getElementById('fEditCategory').value,rirTarget:rirInput.validity?.badInput?NaN:rir===''?null:Number(rir),tempo:document.getElementById('fEditTempo').value,note:document.getElementById('fEditNote').value,perLeg:document.getElementById('fEditPerLeg').checked,alts:document.getElementById('fEditAlts').value.split('\n')};
    if(!saveProgrammeExercise(day.id,exId,fields,expectedRaw))return;
    selectedEditorDayId=day.id;closeModal();renderTab();
  };
}
