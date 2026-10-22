'use strict';
const assert=require('node:assert/strict');const {boot,script}=require('./regression.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const headers=['No.','Date','Time','Weight(kg)','Body Fat Percentage(%)','Muscle Mass(kg)','Skeletal Muscle Mass(kg)','Fat-Free Mass(kg)','Remarks'];
const quote=x=>'"'+String(x).replaceAll('"','""')+'"';
const csv=rows=>'\uFEFF'+headers.map(quote).join(',')+'\r\n'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
const row=(date='2026.10.19',time='07:30:00',weight=80)=>['1',date,time,weight,15,60,35,68,'Synthetic fixture, not personal data'];
function fixture(rows=[row()]){const h=boot(script);h.app.save();return {h,parsed:h.app.parseRenphoCSV(csv(rows))};}
const apply=(h,parsed,options={})=>h.app.applyScaleImport(parsed,options,JSON.stringify(h.app.data));
test('RENPHO headers, BOM, CRLF, quoted commas/newlines and independent estimate columns parse accurately',()=>{
 const a=row();a[8]='comma, newline\nquote " here';const {h,parsed}=fixture([a]);assert.deepEqual(parsed.readings[0],{source:'renpho-health',date:'2026-10-19',time:'07:30:00',weight:80,bodyFatPct:15,muscleMassKg:60,skeletalMuscleKg:35,fatFreeMassKg:68});assert.equal(h.app.data.scaleReadings,undefined);
});
test('Missing estimates remain null and weight-only exports work without inferring muscle',()=>{
 const h=boot(script),p=h.app.parseRenphoCSV('Date,Time,Weight(kg)\n2026.10.19,08:00:00,81');assert.equal(p.readings[0].muscleMassKg,null);assert.equal(p.readings[0].bodyFatPct,null);const a=row();a[4]='--';a[5]='';assert.equal(h.app.parseRenphoCSV(csv([a])).readings[0].bodyFatPct,null);
});
test('Malformed rows, invalid dates/times, unsupported units, duplicate headings and invalid values fail the whole file',()=>{
 const h=boot(script),original=JSON.stringify(h.app.data),bad=[];
 for(const [index,value]of [[1,'2026.02.30'],[2,'24:00:00'],[3,''],[3,'0'],[3,'Infinity'],[3,'80oops'],[3,'-1'],[4,'101'],[5,'81']]){const a=row();a[index]=value;bad.push(csv([a]));}
 bad.push('Date,Time,Weight(lb)\n2026.10.19,08:00:00,180','Date,Time,Weight(kg),Date\n2026.10.19,08:00:00,80,2026.10.19','Date,Time,Weight(kg)\n2026.10.19,08:00:00','"unclosed','x'.repeat(2000001));
 for(const text of bad)assert.throws(()=>h.app.parseRenphoCSV(text));assert.equal(JSON.stringify(h.app.data),original);
});
test('Duplicate timestamps are idempotent; conflicting timestamps within a file are rejected',()=>{
 const {h,parsed}=fixture([row(),row()]);assert.equal(parsed.readings.length,1);assert.equal(parsed.duplicates,1);assert(apply(h,parsed));const raw=h.records.get('htData_v1'),writes=h.state.writes.length;assert(apply(h,parsed));assert.equal(h.records.get('htData_v1'),raw);assert.equal(h.state.writes.length,writes);assert.throws(()=>h.app.parseRenphoCSV(csv([row(),row('2026.10.19','07:30:00',81)])));
});
test('Latest timestamp supplies a single daily weight, independent of CSV order; same-day readings are retained',()=>{
 const {h,parsed}=fixture([row('2026.10.19','18:00:00',82),row('2026.10.19','06:00:00',80)]);assert(apply(h,parsed));assert.equal(h.app.data.scaleReadings.length,2);assert.equal(h.app.data.bodyweight.length,1);assert.equal(h.app.data.bodyweight[0].weight,82);
});
test('Manual daily weights are protected unless explicitly replaced and imported dates update their owned weight',()=>{
 const {h,parsed}=fixture();h.app.data.bodyweight=[{date:'2026-10-19',weight:79,custom:'Keep'}];h.app.save();assert.equal(h.app.planScaleImport(parsed).weightConflicts,1);assert(apply(h,parsed));assert.equal(h.app.data.bodyweight[0].weight,79);assert.equal(h.app.data.bodyweight[0].custom,'Keep');assert(apply(h,parsed,{replaceWeights:true}));assert.equal(h.app.data.bodyweight[0].weight,80);
 const later=h.app.parseRenphoCSV(csv([row('2026.10.19','12:00:00',81)]));assert(apply(h,later));assert.equal(h.app.data.bodyweight[0].weight,81);assert.equal(h.app.data.scaleReadings.length,2);
});
test('Changed readings are preserved by default and corrected only with explicit replacement',()=>{
 const {h,parsed}=fixture();assert(apply(h,parsed));const changed=h.app.parseRenphoCSV(csv([row('2026.10.19','07:30:00',81)]));assert.equal(h.app.planScaleImport(changed).conflicts,1);assert(apply(h,changed));assert.equal(h.app.data.scaleReadings[0].weight,80);assert(apply(h,changed,{replaceReadings:true}));assert.equal(h.app.data.scaleReadings[0].weight,81);assert.equal(h.app.data.bodyweight[0].weight,81);
});
test('Future readings are excluded without affecting valid historical readings',()=>{
 const {h,parsed}=fixture([row(),row('2026.10.21')]);assert.equal(h.app.planScaleImport(parsed).future,1);assert(apply(h,parsed));assert.equal(h.app.data.scaleReadings.length,1);assert.equal(h.app.data.bodyweight.length,1);
});
test('Imports preserve workouts, active drafts, nutrition, programme, measurements and unknown metadata',()=>{
 const {h,parsed}=fixture();h.app.startSession(0);h.app.data.marker={keep:true};h.app.data.bodyMeasurements=[{date:'2026-10-19',waistCm:80}];h.app.data.nutrition=[{date:'2026-10-19',calories:2500,protein:180}];h.app.save();const before=clone(h.app.data);assert(apply(h,parsed));for(const key of ['sessions','activeSession','program','nutrition','marker','bodyMeasurements'])assert.deepEqual(h.app.data[key],before[key]);
});
test('Quota failures roll back the entire import; retry succeeds without duplicates',()=>{
 const {h,parsed}=fixture(),before=JSON.stringify(h.app.data),raw=h.records.get('htData_v1');h.state.writeFailure=true;assert.equal(apply(h,parsed),false);assert.equal(JSON.stringify(h.app.data),before);assert.equal(h.records.get('htData_v1'),raw);h.state.writeFailure=false;assert(apply(h,parsed));assert.equal(h.app.data.scaleReadings.length,1);
});
test('Stale tabs and data changes during preview cannot overwrite newer data',()=>{
 const {h,parsed}=fixture(),expected=JSON.stringify(h.app.data);h.app.data.marker='Changed';assert.throws(()=>h.app.applyScaleImport(parsed,{},expected));h.app.save();const raw=h.records.get('htData_v1');h.records.set('htData_v1',raw+' ');assert.equal(apply(h,parsed),false);assert.equal(h.records.get('htData_v1'),raw+' ');
});
test('Undo restores only imported weight/scale arrays, retains later workout changes and refuses later body edits',()=>{
 const {h,parsed}=fixture();assert(apply(h,parsed));h.app.startSession(0);assert(h.app.undoScaleImport());assert(h.app.data.activeSession);assert.equal(h.app.data.scaleReadings,undefined);assert.equal(h.app.data.bodyweight.length,0);assert(apply(h,parsed));h.app.data.bodyweight.push({date:'2026-10-20',weight:81});h.app.save();assert.equal(h.app.undoScaleImport(),false);assert.equal(h.app.data.bodyweight.length,2);
});
test('JSON export/import and reload preserve estimates and measurements; legacy loads cause no storage rewrite',()=>{
 const {h,parsed}=fixture();assert(apply(h,parsed));assert(h.app.saveBodyMeasurement({date:'2026-10-19',waistCm:81,armCm:37},'[]'));const raw=h.records.get('htData_v1'),reloaded=boot(script,{'htData_v1':raw});assert.equal(reloaded.records.get('htData_v1'),raw);assert.deepEqual(reloaded.app.data.scaleReadings,h.app.data.scaleReadings);assert.deepEqual(reloaded.app.data.bodyMeasurements,h.app.data.bodyMeasurements);const replacement=boot(script);replacement.app.importData({target:{files:[{content:raw}],value:'body.json'}});assert.deepEqual(replacement.app.data.scaleReadings,h.app.data.scaleReadings);assert.deepEqual(replacement.app.data.bodyMeasurements,h.app.data.bodyMeasurements);const legacy=boot(script);legacy.app.save();const old=legacy.records.get('htData_v1');assert.equal(boot(script,{'htData_v1':old}).records.get('htData_v1'),old);
});
test('Malformed body collections in JSON are rejected before a replacement',()=>{
 const {h,parsed}=fixture();assert(apply(h,parsed));assert(h.app.saveBodyMeasurement({date:'2026-10-19',waistCm:80},'[]'));
 for(const change of [d=>d.scaleReadings=null,d=>d.scaleReadings.push(clone(d.scaleReadings[0])),d=>d.scaleReadings[0].bodyFatPct=101,d=>d.scaleReadings[0].muscleMassKg='60',d=>d.scaleReadings[0].time='bad',d=>d.bodyMeasurements.push(clone(d.bodyMeasurements[0])),d=>d.bodyMeasurements[0].waistCm=-1,d=>d.bodyMeasurements[0]={date:'2026-10-19'}]){const bad=clone(h.app.data);change(bad);assert.throws(()=>h.app.validateData(bad));}
});
test('Rolling weight uses recorded days, one observation per date, minimum coverage and real 7/28-day windows',()=>{
 const h=boot(script);h.app.data.bodyweight=[['2026-10-18',81],['2026-10-19',82],['2026-10-20',83],['2026-10-11',80],['2026-10-12',80],['2026-10-13',80],['2026-09-20',79],['2026-09-21',79],['2026-09-22',79],['2026-10-21',999],['2026-10-20',84]].map(([date,weight])=>({date,weight}));
 const w=h.app.bodyWeightWindows();assert.equal(w.current.count,3);assert.equal(w.current.avg,247/3);assert.equal(w.previous.avg,80);assert.equal(w.fourWeeks.avg,79);assert.equal(w.fourWeekChange,247/3-79);assert.equal(h.app.rollingBodyweight().at(-1).value,247/3);h.app.data.bodyweight=[{date:'2026-10-20',weight:80}];assert.equal(h.app.bodyWeightWindows().current.avg,null);assert.equal(h.app.rollingBodyweight().length,0);
});
test('Measurement corrections preserve unknown fields, validate dates/values and rollback failed saves',()=>{
 const h=boot(script);h.app.data.bodyMeasurements=[{date:'2026-10-19',waistCm:80,custom:'keep'}];h.app.save();let expected=JSON.stringify(h.app.data.bodyMeasurements);assert(h.app.saveBodyMeasurement({date:'2026-10-19',waistCm:81,chestCm:100},expected));assert.equal(h.app.data.bodyMeasurements[0].custom,'keep');expected=JSON.stringify(h.app.data.bodyMeasurements);
 for(const entry of [{date:'2026-10-21',waistCm:80},{date:'2026-02-30',waistCm:80},{date:'2026-10-20',waistCm:0},{date:'2026-10-20',armCm:Infinity},{date:'2026-10-20'}])assert.throws(()=>h.app.saveBodyMeasurement(entry,expected));assert.throws(()=>h.app.saveBodyMeasurement({date:'2026-10-20',waistCm:80},'[]'));h.state.writeFailure=true;assert.equal(h.app.saveBodyMeasurement({date:'2026-10-19',waistCm:82},expected),false);assert.equal(h.app.data.bodyMeasurements[0].waistCm,81);
});
test('Body rendering is read-only, labelled as estimates and filters future/selected-range observations',()=>{
 const {h,parsed}=fixture();assert(apply(h,parsed));h.app.data.scaleReadings.push({...parsed.readings[0],date:'2026-10-21',weight:999});const before=JSON.stringify(h.app.data),raw=h.records.get('htData_v1'),html=h.app.renderBodyInsights();assert(html.includes('60 kg'));assert(html.includes('fat-free mass'));assert(!html.includes('999'));assert(!html.includes('NaN'));h.app.progressRange='30';h.app.renderProgress();assert.equal(JSON.stringify(h.app.data),before);assert.equal(h.records.get('htData_v1'),raw);
});
test('Out-of-order readers, cancellation, read errors and edits while reading cannot publish an old preview',()=>{
 const h=boot(script);h.state.deferReads=true;const select=text=>({target:{files:[{content:text}],value:'selected'}});
 h.app.importRenphoFile(select(csv([row()])));h.app.importRenphoFile(select(csv([row('2026.10.19','08:00:00',82)])));h.state.readers[0].reader.onerror();h.state.readers[1].reader.onload({target:{result:h.state.readers[1].file.content}});const preview=h.element('modalBody').innerHTML;assert(preview.includes('82 kg'));h.state.readers[0].reader.onload({target:{result:h.state.readers[0].file.content}});assert.equal(h.element('modalBody').innerHTML,preview);assert.equal(h.app.data.scaleReadings,undefined);
 const g=boot(script);g.state.deferReads=true;g.app.importRenphoFile(select(csv([row()])));g.app.data.marker='Changed';g.state.readers[0].reader.onload({target:{result:g.state.readers[0].file.content}});assert(g.state.alerts.at(-1).includes('data changed'));assert.equal(g.app.data.scaleReadings,undefined);
});
console.log(count+' body tracking/import checks passed');
