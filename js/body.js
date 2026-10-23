/* Body progress stays device-local. CSV import adds readings, never replaces a workout backup. */
let bodyImportSequence=0;
let lastScaleImport=null;
let bodyNotice='';
let bodyMetricKey='muscleMassKg';
const BODY_METRICS={
  muscleMassKg:{label:'RENPHO muscle mass estimate',unit:'kg',column:'Muscle Mass(kg)'},
  skeletalMuscleKg:{label:'RENPHO skeletal muscle estimate',unit:'kg',column:'Skeletal Muscle Mass(kg)'},
  bodyFatPct:{label:'RENPHO body fat estimate',unit:'%',column:'Body Fat Percentage(%)'},
  fatFreeMassKg:{label:'RENPHO fat-free mass estimate',unit:'kg',column:'Fat-Free Mass(kg)'}
};
const BODY_MEASURES={waistCm:'Waist',armCm:'Upper arm',chestCm:'Chest',thighCm:'Thigh'};
function bodyDateValid(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(utcDay(value)) && isoDay(utcDay(value))===value;}
function scaleKey(row){return row.date+'T'+row.time;}
function scaleSignature(row){return JSON.stringify([row.weight,...Object.keys(BODY_METRICS).map(key=>row[key]??null)]);}
function parseBodyCSV(text){
  if(typeof text!=='string' || text.length>2000000)throw Error('Choose a CSV export smaller than 2 MB.');
  const rows=[],row=[];let cell='',quoted=false,closed=false;
  const pushCell=()=>{row.push(cell);cell='';closed=false;};
  const pushRow=()=>{pushCell();if(row.some(value=>value.trim()!==''))rows.push(row.splice(0));else row.length=0;if(rows.length>10001)throw Error('Import at most 10,000 readings at a time.');};
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell!=='' || closed)throw Error('Malformed CSV quotation. Export the file again.');quoted=true;}
    else if(c===',')pushCell();
    else if(c==='\n' || c==='\r'){if(c==='\r' && text[i+1]==='\n')i++;pushRow();}
    else{if(closed && !/\s/.test(c))throw Error('Unexpected text after a quoted CSV field.');if(!closed)cell+=c;}
  }
  if(quoted)throw Error('The CSV ends inside a quoted field.');
  if(cell!=='' || row.length || closed)pushRow();
  return rows;
}
function parseRenphoCSV(text){
  const rows=parseBodyCSV(text);if(rows.length<2)throw Error('No readings were found in this CSV.');
  const normalize=value=>value.trim().replace(/\s+/g,'').toLowerCase(),headers=rows.shift().map(normalize);
  if(new Set(headers).size!==headers.length)throw Error('The CSV has duplicate column headings.');
  const column=name=>headers.indexOf(normalize(name));
  for(const required of ['Date','Time','Weight(kg)'])if(column(required)<0)throw Error('Use a RENPHO Health CSV exported in kilograms, with Date, Time and Weight(kg) columns.');
  const readings=new Map();let duplicates=0;
  rows.forEach((cells,index)=>{
    const rowNumber=index+2;if(cells.length!==headers.length)throw Error('CSV row '+rowNumber+' has an unexpected number of columns.');
    const get=name=>column(name)<0?'':cells[column(name)].trim();
    const date=get('Date').replace(/\./g,'-'),time=get('Time');
    if(!bodyDateValid(date) || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time))throw Error('Check the date/time on CSV row '+rowNumber+'. Use YYYY.MM.DD and HH:MM:SS.');
    const numeric=(name,required=false,max=600)=>{
      const raw=get(name);if(!required && ['', '--','-','N/A'].includes(raw.toUpperCase()))return null;
      if(!/^\d+(\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw)) || Number(raw)>max || (required && Number(raw)<=0))throw Error('Check '+name+' on CSV row '+rowNumber+'.');
      return Number(raw);
    };
    const weight=numeric('Weight(kg)',true),reading={source:'renpho-health',date,time,weight};
    for(const [key,metric] of Object.entries(BODY_METRICS))reading[key]=numeric(metric.column,false,key==='bodyFatPct'?100:weight);
    const key=scaleKey(reading),previous=readings.get(key);
    if(previous && scaleSignature(previous)!==scaleSignature(reading))throw Error('Two different readings share '+key+'. Export a single user’s readings and try again.');
    if(previous)duplicates++;else readings.set(key,reading);
  });
  return {readings:[...readings.values()].sort((a,b)=>scaleKey(a).localeCompare(scaleKey(b))),duplicates};
}
function planScaleImport(parsed,{replaceReadings=false,replaceWeights=false}={}){
  const readings=new Map((DATA.scaleReadings||[]).map(row=>[scaleKey(row),row]));
  let added=0,updated=0,unchanged=0,conflicts=0,future=0;
  const affected=new Set();
  for(const row of parsed.readings){
    if(row.date>todayISO()){future++;continue;}
    affected.add(row.date);const key=scaleKey(row),previous=readings.get(key);
    if(!previous){readings.set(key,row);added++;}
    else if(scaleSignature(previous)===scaleSignature(row))unchanged++;
    else{conflicts++;if(replaceReadings){readings.set(key,{...previous,...row});updated++;}}
  }
  const scaleReadings=[...readings.values()].sort((a,b)=>scaleKey(a).localeCompare(scaleKey(b)));
  const latest=new Map();for(const row of scaleReadings)if(affected.has(row.date))latest.set(row.date,row);
  let bodyweight=DATA.bodyweight.slice(),weightAdded=0,weightUpdated=0,weightConflicts=0;
  for(const [date,row] of latest){
    const current=bodyweight.filter(b=>b.date===date).at(-1);
    if(!current){bodyweight.push({date,weight:row.weight,source:'renpho-health',scaleTime:row.time});weightAdded++;continue;}
    const owned=current.source==='renpho-health';
    if(current.weight!==row.weight && !owned)weightConflicts++;
    if((owned || replaceWeights) && (current.weight!==row.weight || current.scaleTime!==row.time)){
      bodyweight=bodyweight.filter(b=>b.date!==date).concat({...current,date,weight:row.weight,source:'renpho-health',scaleTime:row.time});weightUpdated++;
    }
  }
  return {scaleReadings,bodyweight,added,updated,unchanged,conflicts,future,weightAdded,weightUpdated,weightConflicts,
    changed:added+updated+weightAdded+weightUpdated>0};
}
function applyScaleImport(parsed,options,expected){
  if(JSON.stringify(DATA)!==expected)throw Error('Your data changed during the preview. Select the CSV again to review it against your latest data.');
  const plan=planScaleImport(parsed,options);
  if(!plan.changed){bodyNotice='No changes: these readings are already present, or the existing values were kept.';return true;}
  const before={bodyweight:DATA.bodyweight,scaleReadings:DATA.scaleReadings};
  if(!commitData({...DATA,bodyweight:plan.bodyweight,scaleReadings:plan.scaleReadings}))return false;
  lastScaleImport={before,expected:JSON.stringify([DATA.scaleReadings,DATA.bodyweight])};
  bodyNotice='RENPHO import saved: '+plan.added+' new readings, '+plan.updated+' corrected readings; '+plan.weightAdded+' new weight dates and '+plan.weightUpdated+' updated weight dates.';
  return true;
}
function undoScaleImport(){
  if(!lastScaleImport)return false;
  if(JSON.stringify([DATA.scaleReadings,DATA.bodyweight])!==lastScaleImport.expected){alert('Bodyweight or scale data changed after this import. Undo would overwrite those changes; use your JSON backup or previous save instead.');return false;}
  const candidate={...DATA,bodyweight:lastScaleImport.before.bodyweight};
  if(lastScaleImport.before.scaleReadings===undefined)delete candidate.scaleReadings;else candidate.scaleReadings=lastScaleImport.before.scaleReadings;
  if(!commitData(candidate))return false;
  lastScaleImport=null;bodyNotice='The last RENPHO import was undone.';renderTab();return true;
}
function importRenphoFile(event){
  const sequence=++bodyImportSequence,input=event.target,file=input.files?.[0];if(!file)return;
  if(storageBlocked){input.value='';alert('Restore your saved tracker data before adding RENPHO readings.');return;}
  if(file.size>2000000){input.value='';alert('Choose a CSV export smaller than 2 MB.');return;}
  const expected=JSON.stringify(DATA),reader=new FileReader();
  showModal('<h3>Reading RENPHO export…</h3><p>Your tracker data has not changed.</p><button class="btn btn-outline" data-action="closeModal">Cancel</button>');
  const generation=modalGeneration;
  reader.onload=event=>{
    if(sequence!==bodyImportSequence || generation!==modalGeneration){input.value='';return;}
    try{
      if(JSON.stringify(DATA)!==expected)throw Error('Your data changed while the file was loading. Select the CSV again.');
      openScalePreview(parseRenphoCSV(event.target.result),expected);
    }catch(error){closeModal();alert('Could not read RENPHO CSV: '+error.message);}
    finally{input.value='';}
  };
  reader.onerror=()=>{input.value='';if(sequence!==bodyImportSequence || generation!==modalGeneration)return;closeModal();alert('Could not read this CSV. Your tracker data has not changed.');};
  reader.readAsText(file);
}
function openScalePreview(parsed,expected){
  const plan=planScaleImport(parsed),rows=parsed.readings.filter(row=>row.date<=todayISO());
  showModal(`<h3>Review RENPHO import</h3><p class="progress-caption">${rows.length} dated readings · ${rows.length?fmtDate(rows[0].date)+' – '+fmtDate(rows.at(-1).date):'no readings through today'}. This adds scale data to this device’s tracker. Check this is your profile before saving.</p>
    <p>${plan.added} new · ${plan.unchanged} already present · ${plan.conflicts} changed readings</p>
    <p class="progress-caption">${parsed.duplicates} duplicate rows ignored · ${plan.future} future readings excluded. The latest reading per date supplies daily weight. Existing RENPHO-owned weight dates update; manual dates are kept unless you choose otherwise.</p>
    ${plan.conflicts?`<label class="home-setting"><input type="checkbox" id="scaleReplaceReadings"> Replace ${plan.conflicts} existing scale readings with changed values from this file</label>`:''}
    ${plan.weightConflicts?`<label class="home-setting"><input type="checkbox" id="scaleReplaceWeights"> Replace ${plan.weightConflicts} manually logged daily weights with RENPHO weight</label>`:''}
    <details class="coach-explanation"><summary>Check readings before import</summary><div class="progress-table-wrap"><table class="progress-table"><thead><tr><th>Date / time</th><th>Weight</th><th>Muscle estimate</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${escapeHtml(row.date)}<br>${escapeHtml(row.time)}</td><td>${row.weight} kg</td><td>${row.muscleMassKg??'—'}${row.muscleMassKg===null?'':' kg'}</td></tr>`).join('')}</tbody></table></div></details>
    <p class="progress-caption">Body composition numbers are scale estimates. Fat-free mass includes water and other tissues; it is not the same as muscle.</p><p id="scaleImportError" role="alert"></p>
    <button class="btn btn-primary" id="confirmScaleImport" ${rows.length?'':'disabled'}>Import readings</button><button class="btn btn-outline" data-action="closeModal">Cancel</button>`);
  document.getElementById('confirmScaleImport').onclick=()=>{
    try{
      const options={replaceReadings:!!document.getElementById('scaleReplaceReadings')?.checked,replaceWeights:!!document.getElementById('scaleReplaceWeights')?.checked};
      if(!applyScaleImport(parsed,options,expected)){document.getElementById('scaleImportError').textContent=saveMessage;return;}
      closeModal();openBodyProgress();
    }catch(error){document.getElementById('scaleImportError').textContent=error.message;}
  };
}
function openBodyProgress(){setTab('progress');document.getElementById('bodyweightProgress')?.scrollIntoView?.({block:'start'});}
function renderBodyTools(){
  return `<div class="body-actions"><label class="btn btn-secondary body-file">Import RENPHO CSV<input id="renphoFile" type="file" aria-label="Import RENPHO CSV"></label><button class="btn btn-outline" data-action="bodyMeasurements">Log measurements</button><button class="btn btn-outline" data-action="bodyProgress">View body progress</button></div>${renderBodyNotice()}<p class="progress-caption">RENPHO Health → your scale → History → Export data (kg). Readings stay on this device and are included in your JSON backup. Import is manual; this is not automatic sync.</p>`;
}
function renderBodyNotice(){return `${bodyNotice?`<p class="body-notice" role="status">${escapeHtml(bodyNotice)}</p>`:''}${lastScaleImport?'<button class="btn btn-sm btn-outline" data-action="undoScaleImport">Undo last RENPHO import</button><p class="progress-caption">Undo is available until reload, provided the weight/scale data has not changed.</p>':''}`;}
function saveBodyMeasurement(entry,expected){
  const rows=DATA.bodyMeasurements||[];
  if(JSON.stringify(rows)!==expected)throw Error('Measurements changed. Reopen the measurement editor.');
  if(!bodyDateValid(entry.date) || entry.date>todayISO())throw Error('Choose a valid date through today.');
  if(!Object.keys(BODY_MEASURES).some(key=>Number.isFinite(entry[key])))throw Error('Enter at least one measurement.');
  for(const key of Object.keys(BODY_MEASURES))if(entry[key]!==null && entry[key]!==undefined && (!Number.isFinite(entry[key]) || entry[key]<=0 || entry[key]>400))throw Error('Use measurements greater than 0 and at most 400 cm.');
  const existing=rows.find(row=>row.date===entry.date)||{};
  return commitData({...DATA,bodyMeasurements:rows.filter(row=>row.date!==entry.date).concat({...existing,...entry}).sort((a,b)=>a.date.localeCompare(b.date))});
}
function openBodyMeasurements(date=todayISO()){
  const rows=DATA.bodyMeasurements||[],expected=JSON.stringify(rows);
  showModal(`<h3>Body measurements</h3><p class="progress-caption">Use centimetres, the same tape position and similar conditions. Optional fields can stay blank.</p><div class="field"><label for="bodyMeasureDate">Date</label><input id="bodyMeasureDate" type="date" max="${todayISO()}" value="${escapeHtml(date)}"></div><div class="body-measure-fields">${Object.entries(BODY_MEASURES).map(([key,label])=>`<div class="field"><label for="measure_${key}">${label} (cm)</label><input id="measure_${key}" type="number" min="0.1" max="400" step="any" inputmode="decimal"></div>`).join('')}</div><p id="bodyMeasureError" role="alert"></p><button class="btn btn-primary" id="saveBodyMeasurement">Save measurements</button><button class="btn btn-danger-outline" id="deleteBodyMeasurement" hidden>Delete this date</button><button class="btn btn-outline" data-action="closeModal">Cancel</button>`);
  const fill=()=>{
    const entry=rows.find(row=>row.date===document.getElementById('bodyMeasureDate').value);
    for(const key of Object.keys(BODY_MEASURES))document.getElementById('measure_'+key).value=entry?.[key]??'';
    document.getElementById('deleteBodyMeasurement').hidden=!entry;
  };fill();document.getElementById('bodyMeasureDate').onchange=fill;
  document.getElementById('saveBodyMeasurement').onclick=()=>{
    try{
      const entry={date:document.getElementById('bodyMeasureDate').value};
      for(const key of Object.keys(BODY_MEASURES)){const input=document.getElementById('measure_'+key);entry[key]=input.validity?.badInput?NaN:input.value===''?null:Number(input.value);}
      if(!saveBodyMeasurement(entry,expected)){document.getElementById('bodyMeasureError').textContent=saveMessage;return;}
      closeModal();renderTab();
    }catch(error){document.getElementById('bodyMeasureError').textContent=error.message;}
  };
  document.getElementById('deleteBodyMeasurement').onclick=()=>{
    if(JSON.stringify(DATA.bodyMeasurements||[])!==expected){document.getElementById('bodyMeasureError').textContent='Measurements changed. Reopen the editor.';return;}
    const date=document.getElementById('bodyMeasureDate').value;
    if(!confirm('Delete measurements for '+date+'?'))return;
    if(!commitData({...DATA,bodyMeasurements:rows.filter(row=>row.date!==date)})){document.getElementById('bodyMeasureError').textContent=saveMessage;return;}
    closeModal();renderTab();
  };
}
function bodyWeightWindows(){
  const days=dailyBodyweight().filter(row=>row.date<=todayISO()),end=utcDay(todayISO());
  const window=offset=>{const rows=days.filter(row=>utcDay(row.date)>=end-(offset+6)*86400000 && utcDay(row.date)<=end-offset*86400000);return {count:rows.length,avg:rows.length>=3?rows.reduce((n,row)=>n+row.weight,0)/rows.length:null};};
  const current=window(0),previous=window(7),fourWeeks=window(28);
  return {current,previous,fourWeeks,weeklyChange:current.avg!==null && previous.avg!==null?current.avg-previous.avg:null,fourWeekChange:current.avg!==null && fourWeeks.avg!==null?current.avg-fourWeeks.avg:null};
}
function rollingBodyweight(range=progressRange){
  const days=dailyBodyweight().filter(row=>row.date<=todayISO());
  return days.map((row,i)=>{const recent=days.slice(0,i+1).filter(point=>utcDay(point.date)>=utcDay(row.date)-6*86400000);return {...row,count:recent.length,value:recent.length>=3?recent.reduce((n,point)=>n+point.weight,0)/recent.length:null};}).filter(row=>row.value!==null && inProgressRange(row.date,range));
}
function signedBodyNumber(value,unit){return value===null?'Need more readings':(value>0?'+':'')+progressNumber(value,2)+' '+unit;}
function renderBodyInsights(){
  const windows=bodyWeightWindows(),measurements=(DATA.bodyMeasurements||[]).filter(row=>inProgressRange(row.date)).sort((a,b)=>a.date.localeCompare(b.date));
  const scale=(DATA.scaleReadings||[]).filter(row=>inProgressRange(row.date)).sort((a,b)=>scaleKey(a).localeCompare(scaleKey(b))),latest=scale.at(-1);
  const metric=BODY_METRICS[bodyMetricKey]||BODY_METRICS.muscleMassKg,metricKey=Object.keys(BODY_METRICS).find(key=>BODY_METRICS[key]===metric),byDate=new Map();
  for(const row of scale)if(Number.isFinite(row[metricKey]))byDate.set(row.date,row);
  const scaleSeries=[...byDate.values()].map(row=>({date:row.date,value:row[metricKey]}));
  const waist=measurements.filter(row=>Number.isFinite(row.waistCm)),lastWaist=waist.at(-1),priorWaist=waist.at(-2);
  const training=weeklyCoachingReview(),c=training.counts;
  return `<div class="card" id="bodyTrends"><h3 class="progress-title">Your weight trend</h3><p class="progress-caption">Current windows through ${fmtDate(todayISO())} · independent of the chart date filter</p><div class="metric-grid"><div class="metric"><div class="label">Last 7 days average</div><div class="value">${windows.current.avg===null?'—':progressNumber(windows.current.avg,2)+' kg'}</div><div class="progress-caption">${windows.current.count} measured days · minimum 3</div></div><div class="metric"><div class="label">Vs preceding 7 days</div><div class="value">${signedBodyNumber(windows.weeklyChange,'kg')}</div></div><div class="metric"><div class="label">4-week change in average</div><div class="value">${signedBodyNumber(windows.fourWeekChange,'kg')}</div></div></div>${renderSparkline(rollingBodyweight(),{label:'7-day average weight',unit:'kg'})}<p class="progress-caption">Each average uses recorded days only, with at least three days per 7-day window. Missing weigh-ins are not filled in. A weight change is not a measurement of muscle gained.</p>
    <details class="coach-explanation"><summary>Putting your progress together</summary><p>Training this week: ${c.improving} movements improving · ${c.holding} holding · ${c.attention} need attention. ${c.baseline} still building a baseline.</p><p>${lastWaist?`Waist: ${lastWaist.waistCm} cm on ${fmtDate(lastWaist.date)}${priorWaist?'; '+signedBodyNumber(lastWaist.waistCm-priorWaist.waistCm,'cm')+' vs '+fmtDate(priorWaist.date):'; log another measurement to compare'}.`:'Log waist measurements to compare alongside weight and training.'}</p><p class="progress-caption">These are separate signals to review together over several weeks. Strength, tape measurements and scale estimates cannot establish an exact amount of muscle gained.</p></details>
    <div class="body-actions"><button class="btn btn-outline" data-action="bodyMeasurements">Log measurements</button><button class="btn btn-outline" data-action="homeNavigate" data-tab="more">Import RENPHO in More</button></div>${renderBodyNotice()}</div>
    <div class="card" id="scaleComposition"><h3 class="progress-title">RENPHO estimates</h3><p class="progress-caption">Selected date range · ${scale.length} readings${latest?' · latest '+fmtDate(latest.date)+' '+latest.time:''}</p><label class="progress-caption" for="bodyMetric">Show estimate</label><select id="bodyMetric" class="searchbox">${Object.entries(BODY_METRICS).map(([key,value])=>`<option value="${key}" ${key===metricKey?'selected':''}>${value.label}</option>`).join('')}</select>${renderSparkline(scaleSeries,{label:metric.label,unit:metric.unit})}<div class="progress-change">${scaleSeries.length?progressNumber(scaleSeries.at(-1).value,2)+' '+metric.unit+' · '+fmtDate(scaleSeries.at(-1).date):'Import a RENPHO Health CSV to see available estimates.'}</div><p class="progress-caption">Last available estimate per day. Muscle mass, skeletal muscle and fat-free mass are different estimates. Hydration and measurement conditions affect them; fat-free mass includes water and other tissues. Treat changes as estimates, not proof of muscle gain.</p>
    ${scale.length?`<details class="coach-explanation"><summary>Recent scale readings</summary><div class="progress-table-wrap"><table class="progress-table"><thead><tr><th>Date / time</th><th>Weight</th><th>Body fat estimate</th><th>Muscle estimate</th></tr></thead><tbody>${scale.slice(-30).reverse().map(row=>`<tr><td>${row.date}<br>${row.time}</td><td>${row.weight} kg</td><td>${row.bodyFatPct??'—'}${row.bodyFatPct==null?'':'%'}</td><td>${row.muscleMassKg??'—'}${row.muscleMassKg==null?'':' kg'}</td></tr>`).join('')}</tbody></table></div><p class="progress-caption">Latest 30 readings in the selected range. JSON export retains every imported reading.</p></details>`:''}</div>
    <div class="card" id="bodyMeasurements"><h3 class="progress-title">Body measurements</h3>${renderSparkline(waist.map(row=>({date:row.date,value:row.waistCm})),{label:'Waist measurement',unit:'cm'})}<div class="progress-table-wrap">${measurements.length?`<table class="progress-table"><thead><tr><th>Date</th>${Object.values(BODY_MEASURES).map(label=>`<th>${label} cm</th>`).join('')}<th>Edit</th></tr></thead><tbody>${measurements.slice(-20).reverse().map(row=>`<tr><td>${row.date}</td>${Object.keys(BODY_MEASURES).map(key=>`<td>${row[key]??'—'}</td>`).join('')}<td><button class="btn btn-sm btn-outline" data-action="editBodyMeasurement" data-date="${row.date}">Edit</button></td></tr>`).join('')}</tbody></table>`:'<p class="progress-caption">No tape measurements in this range. Add waist, upper arm, chest or thigh measurements when useful.</p>'}</div><button class="btn btn-outline" data-action="bodyMeasurements">Log measurements</button><p class="progress-caption">Use the same side, tape position and similar conditions each time. Table shows the latest 20 dates in range.</p></div>`;
}
