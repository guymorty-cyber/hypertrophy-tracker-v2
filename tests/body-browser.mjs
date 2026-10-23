import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const prefix='/hypertrophy-tracker-v2/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
  const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
  const path=resolve(root,relative);
  if(!path.startsWith(resolve(root)+sep)){res.writeHead(403);return res.end();}
  try{
    const body=readFileSync(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch(e){res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port+prefix;
try{
 for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
  const browser=await engine.launch();let closing=false;
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],dialogs=[];
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept().catch(e=>{if(!closing)errors.push(e.message);});});await page.goto(base);
   const fixture=await page.evaluate(()=>{
    const data=defaultData();data.programStartDate=todayISO();const date=days=>isoDay(utcDay(todayISO())-days*86400000),manualDate=date(1);
    data.bodyweight=[{date:manualDate,weight:85,custom:'Keep manual metadata'}];data.marker='Preserve unknown metadata';data.nutrition=[{date:todayISO(),calories:2500,protein:180}];localStorage.setItem('htData_v1',JSON.stringify(data));
    return {dates:[1,2,3,8,9,10,29,30,31].map(date),manualDate};
   });await page.reload();await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();await page.locator('[data-field="weight"]').first().fill('30');await page.locator('[data-field="reps"]').first().fill('8');await page.locator('[data-action="toggleComplete"]').first().check();
   const original=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   const header='No.,Date,Time,Weight(kg),Body Fat Percentage(%),Muscle Mass(kg),Skeletal Muscle Mass(kg),Fat-Free Mass(kg),Remarks';
   const csv=header+'\r\n'+fixture.dates.map((date,i)=>[i+1,date.replaceAll('-','.'),'07:30:00',82+i*.1,15,64+i*.1,38+i*.1,70+i*.1,'"Synthetic, fixture"'].join(',')).join('\r\n');
   const more=async()=>page.locator('#navbar [data-tab="more"]').click();
   const choose=async(text=csv)=>{await more();await page.locator('#renphoFile').setInputFiles({name:'synthetic-renpho.csv',mimeType:'text/csv',buffer:Buffer.from(text)});await page.locator('#confirmScaleImport').waitFor();};
   await choose();assert((await page.locator('#modalBody').innerText()).includes('9 new'));assert.equal(await page.locator('#scaleReplaceWeights').isChecked(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);await page.locator('[data-action="closeModal"]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);
   await choose();await page.locator('#modalBody summary').click();assert.equal(await page.locator('#modalBody tbody tr').count(),9);
   await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='htData_v1')throw new DOMException('full','QuotaExceededError');return window.originalSetItem.call(this,key,value);};});await page.locator('#confirmScaleImport').click();assert((await page.locator('#scaleImportError').innerText()).includes('full'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await page.locator('#confirmScaleImport').click();
   assert.equal(await page.locator('#bodyTrends').count(),1);assert((await page.locator('#bodyTrends').innerText()).includes('Last 7 days average'));assert((await page.locator('#scaleComposition').innerText()).includes('64 kg'));assert.equal(await page.locator('#scaleComposition svg circle').count(),9);
   let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1'))),old=JSON.parse(original);assert.equal(saved.scaleReadings.length,9);assert.equal(saved.bodyweight.find(row=>row.date===fixture.manualDate).weight,85);for(const key of ['activeSession','sessions','program','nutrition','marker'])assert.deepEqual(saved[key],old[key]);
   await page.locator('#bodyMetric').selectOption('skeletalMuscleKg');assert((await page.locator('#scaleComposition .progress-change').innerText()).includes('38 kg'));const currentAverage=await page.locator('#bodyTrends .metric .value').first().innerText();await page.locator('#progressRange').selectOption('30');assert.equal(await page.locator('#bodyTrends .metric .value').first().innerText(),currentAverage);assert.equal(await page.locator('#scaleComposition svg circle').count(),7);await page.locator('#progressRange').selectOption('all');
   await page.locator('#bodyTrends [data-action="undoScaleImport"]').click();assert.equal(await page.evaluate(()=>DATA.scaleReadings),undefined);assert.deepEqual(await page.evaluate(()=>DATA.bodyweight),old.bodyweight);assert.deepEqual(await page.evaluate(()=>DATA.activeSession),old.activeSession);
   await choose();await page.locator('#confirmScaleImport').click();const importedRaw=await page.evaluate(()=>localStorage.getItem('htData_v1'));await choose();assert((await page.locator('#modalBody').innerText()).includes('0 new'));assert((await page.locator('#modalBody').innerText()).includes('9 already present'));await page.locator('#confirmScaleImport').click();assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),importedRaw);
   const corrected=header+'\n1,'+fixture.manualDate.replaceAll('-','.')+',07:30:00,83,15,65,39,71,"Corrected fixture"';await choose(corrected);await page.locator('#scaleReplaceReadings').check();await page.locator('#confirmScaleImport').click();assert.equal(await page.evaluate(()=>DATA.scaleReadings.find(row=>row.date===DATA.bodyweight.find(b=>b.custom).date).weight),83);assert.equal(await page.evaluate(()=>DATA.bodyweight.find(row=>row.custom).weight),85);
   await choose(corrected);await page.locator('#scaleReplaceWeights').check();await page.locator('#confirmScaleImport').click();assert.equal(await page.evaluate(()=>DATA.bodyweight.find(row=>row.custom).weight),83);assert.equal(await page.evaluate(()=>DATA.scaleReadings.length),9);
   await page.locator('#bodyTrends [data-action="bodyMeasurements"]').click();await page.locator('#measure_waistCm').fill('82');await page.locator('#measure_armCm').fill('36');await page.locator('#saveBodyMeasurement').click();assert((await page.locator('#bodyMeasurements').innerText()).includes('82'));await page.locator('[data-action="editBodyMeasurement"]').click();assert.equal(await page.locator('#measure_waistCm').inputValue(),'82');await page.locator('#measure_waistCm').fill('81.5');await page.locator('#saveBodyMeasurement').click();assert.equal(await page.evaluate(()=>DATA.bodyMeasurements[0].waistCm),81.5);
   await page.locator('[data-action="editBodyMeasurement"]').click();await page.locator('#bodyMeasureDate').fill(fixture.manualDate);await page.locator('#bodyMeasureDate').dispatchEvent('change');assert.equal(await page.locator('#measure_waistCm').inputValue(),'');await page.locator('#measure_waistCm').fill('82');await page.locator('#saveBodyMeasurement').click();assert.equal(await page.evaluate(()=>DATA.bodyMeasurements.length),2);await page.locator('[data-action="editBodyMeasurement"][data-date="'+fixture.manualDate+'"]').click();await page.locator('#deleteBodyMeasurement').click();assert.equal(await page.evaluate(()=>DATA.bodyMeasurements.length),1);
   const beforeBad=await page.evaluate(()=>localStorage.getItem('htData_v1'));await more();await page.locator('#renphoFile').setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from(header+'\n1,2026.02.30,07:30:00,80,15,60,35,68,bad')});await page.waitForFunction(()=>document.getElementById('overlay').classList.contains('hide'));assert(dialogs.at(-1).includes('date/time'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),beforeBad);
   await choose();await page.evaluate(()=>{DATA.marker='Changed while preview open';save();});const duringPreview=await page.evaluate(()=>localStorage.getItem('htData_v1'));await page.locator('#confirmScaleImport').click();assert((await page.locator('#scaleImportError').innerText()).includes('data changed'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),duringPreview);await page.locator('[data-action="closeModal"]').click();
   await more();const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="exportData"]').click()]);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const backup=JSON.parse(Buffer.concat(chunks).toString());assert.equal(backup.scaleReadings.length,9);assert.equal(backup.bodyMeasurements.length,1);
   await page.locator('#importFile').setInputFiles({name:'body-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.waitForFunction(()=>document.getElementById('importFile')?.value==='');await page.reload();await page.locator('#navbar [data-tab="progress"]').click();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));assert.deepEqual(saved.scaleReadings,backup.scaleReadings);assert.deepEqual(saved.bodyMeasurements,backup.bodyMeasurements);assert.deepEqual(saved.activeSession,backup.activeSession);assert.equal(saved.marker,'Changed while preview open');
   const readonly=await page.evaluate(()=>localStorage.getItem('htData_v1'));await page.locator('#bodyMetric').selectOption('fatFreeMassKg');await page.locator('#bodyTrends summary').click();assert((await page.locator('#bodyTrends').innerText()).includes('cannot establish an exact amount of muscle gained'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),readonly);
   for(const width of [320,390,844]){await page.setViewportSize({width,height:width===844?390:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   assert.deepEqual(errors,[]);console.log(name+': RENPHO preview/cancel, manual conflict protection, duplicates/corrections, quota retry, Undo, trend windows, distinct estimates, measurement editing, invalid/stale import, JSON backup/reload, active history preservation and mobile layout passed');await context.close();
  }finally{closing=true;await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
