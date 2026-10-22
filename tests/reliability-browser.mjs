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
  const browser=await engine.launch();
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],dialogs=[];
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.accept();});await page.goto(base);
   const original=await page.evaluate(()=>{
    const data=defaultData(),ex=data.program[0].exercises[0];data.customFlag='Keep imported metadata';data.dashboard={name:'Test',weeklyGoal:5,showBodyweight:true,showNutrition:true,showCoaching:true};data.bodyweight=[{date:todayISO(),weight:73.5}];data.sessions=[{id:'existing',date:todayISO(),startedAt:1,dayId:data.program[0].id,dayName:data.program[0].name,weekNumber:1,phase:'Calibration',notes:'Existing history',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name:ex.name,definition:JSON.parse(JSON.stringify(ex)),notes:'',sets:[{weight:25,reps:10,completed:true}]}]}];data.sessions=rebuildHistory(data.sessions);localStorage.setItem('htData_v1',JSON.stringify(data));return data;
   });await page.reload();await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();
   const weight=page.locator('[data-field="weight"]').first(),reps=page.locator('[data-field="reps"]').first(),complete=page.locator('[data-action="toggleComplete"]').first();await weight.fill('30');await reps.fill('8');await page.locator('#entryDone').click();const before=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   const fail=()=>page.evaluate(()=>{window.reliabilitySetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='htData_v1')throw new DOMException('full','QuotaExceededError');return window.reliabilitySetItem.call(this,key,value);};});
   const recover=()=>page.evaluate(()=>{Storage.prototype.setItem=window.reliabilitySetItem;});
   await fail();await complete.click();assert.equal(await complete.isChecked(),false);assert.equal(await page.locator('#resttimer').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),before);assert((await page.locator('#saveStatus').innerText()).includes('full'));await recover();await complete.check();
   const deadline=await page.evaluate(()=>DATA.restEndAt);assert.equal(await page.locator('#resttimer').isVisible(),true);assert.equal(await page.evaluate(()=>restTimerState.endAt),deadline);
   await fail();await page.locator('#rtAdd30').click();assert.equal(await page.evaluate(()=>restTimerState.endAt),deadline);await page.locator('#rtSkip').click();assert.equal(await page.locator('#resttimer').isVisible(),true);await page.locator('[data-action="startRest"]').first().click();assert.equal(await page.evaluate(()=>restTimerState.endAt),deadline);await recover();await page.locator('#rtSkip').click();assert.equal(await page.evaluate(()=>DATA.restEndAt),null);
   // No-op saves must not replace the previous meaningful snapshot.
   await page.locator('#workoutNotes').fill('Backup target');await page.locator('#workoutNotes').fill('Current notes');await page.locator('#entryDone').click();const backup=await page.evaluate(()=>localStorage.getItem('htData_v1_backup'));await page.evaluate(()=>{save();save();});assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1_backup')),backup);
   await page.locator('#navbar [data-tab="more"]').click();await page.locator('#restoreBackupBtn').click();await page.locator('#navbar [data-tab="train"]').click();assert.equal(await page.locator('#workoutNotes').inputValue(),'Backup target');assert.equal(await page.evaluate(()=>DATA.sessions[0].notes),'Existing history');
   // A damaged primary must export its original bytes through the ordinary Export button.
   await page.evaluate(()=>localStorage.setItem('htData_v1','{damaged original history bytes'));await page.reload();await page.locator('#navbar [data-tab="more"]').click();const downloadPromise=page.waitForEvent('download');await page.locator('[data-action="exportData"]').click();const download=await downloadPromise;assert(download.suggestedFilename().startsWith('hypertrophy-recovery-'));assert.equal(readFileSync(await download.path(),'utf8'),'{damaged original history bytes');assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),'{damaged original history bytes');
   const input=page.locator('#importFile'),file=(name,data)=>({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await input.setInputFiles(file('recovery.json',original));assert.equal(await page.evaluate(()=>storageBlocked),false);assert.equal(await page.evaluate(()=>DATA.customFlag),original.customFlag);
   // Make file reads explicitly asynchronous so an older selection can finish last.
   await page.evaluate(()=>{window.reliabilityReader=window.FileReader;window.reliabilityReads=[];window.FileReader=class{readAsText(file){window.reliabilityReads.push({reader:this,file});}};});
   await input.setInputFiles(file('older.json',{...original,marker:'Older'}));await input.setInputFiles(file('latest.json',{...original,marker:'Latest'}));await page.evaluate(()=>window.reliabilityReads[0].reader.onerror());assert((await input.inputValue()).includes('latest.json'));
   const resolveRead=index=>page.evaluate(async index=>{const read=window.reliabilityReads[index];read.reader.onload({target:{result:await read.file.text()}});},index);
   await resolveRead(1);const latest=await page.evaluate(()=>localStorage.getItem('htData_v1'));await resolveRead(0);assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),latest);assert.equal(await page.evaluate(()=>DATA.marker),'Latest');
   await input.setInputFiles(file('slow.json',original));await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();const active=await page.evaluate(()=>localStorage.getItem('htData_v1'));await resolveRead(2);assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),active);assert(dialogs.at(-1).includes('data changed'));await page.evaluate(()=>{window.FileReader=window.reliabilityReader;});
   // Real stale-tab rejection: the second tab must not complete or overwrite this workout.
   await weight.fill('30');await reps.fill('8');await page.locator('#entryDone').click();const second=await context.newPage();second.setDefaultTimeout(15000);second.on('pageerror',e=>errors.push(e.message));second.on('dialog',d=>d.accept());await second.goto(base);await weight.fill('35');await page.locator('#entryDone').click();const newRaw=await page.evaluate(()=>localStorage.getItem('htData_v1'));await second.locator('[data-action="toggleComplete"]').first().click();assert.equal(await second.locator('[data-action="toggleComplete"]').first().isChecked(),false);assert.equal(await second.locator('#resttimer').isVisible(),false);assert((await second.locator('#saveStatus').innerText()).includes('another tab'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),newRaw);await second.close();
   // An ambiguous programme import is rejected before any data is replaced.
   await page.locator('#navbar [data-tab="more"]').click();const bad=JSON.parse(newRaw);bad.program[1].exercises[0].id=bad.program[0].exercises[0].id;await input.setInputFiles(file('ambiguous.json',bad));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),newRaw);
   await page.reload();assert.equal(await weight.inputValue(),'35');const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));assert.deepEqual(final.sessions,original.sessions);assert.deepEqual(final.bodyweight,original.bodyweight);assert.deepEqual(final.dashboard,original.dashboard);assert.equal(final.customFlag,original.customFlag);assert.deepEqual(errors,[]);
   console.log(name+': Phase 9 atomic completion/timers, quota rollback/retry, useful backup restore, damaged-byte export/recovery, asynchronous import races, stale tabs and malformed-import rejection passed');await context.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
