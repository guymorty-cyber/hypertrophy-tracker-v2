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
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[];
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base);
   await page.locator('#navbar [data-tab="more"]').click();await page.locator('[data-action="addProgrammeDay"]').click();
   await page.locator('#dayEditName').fill('Builder lower');await page.locator('#dayEditLower').check();await page.locator('#dayEditSave').click();
   const dayIndex=await page.locator('#editDaySelect').inputValue();
   await page.locator('#programmeAddExercise').click();await page.locator('#fEditName').fill('Builder exercise');await page.locator('#fEditSets').fill('2.5');await page.locator('#fEditSave').click();
   assert.equal(await page.locator('#fEditSave').count(),1);
   await page.locator('#fEditSets').fill('2');await page.locator('#fEditRepMin').fill('6');await page.locator('#fEditRepMax').fill('10');await page.locator('#fEditRest').fill('0');await page.locator('#fEditInc').fill('0.25');await page.locator('#fEditCategory').selectOption('isolation');await page.locator('#fEditRir').fill('3');await page.locator('#fEditTempo').fill('3-1-1-0');await page.locator('#fEditPerLeg').check();await page.locator('#fEditAlts').fill('Alternative exercise');await page.locator('#fEditSave').click();
   let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));const dayId=data.program[Number(dayIndex)].id,exId=data.program[Number(dayIndex)].exercises[0].id;
   assert.equal(data.program[Number(dayIndex)].exercises[0].inc,.25);
   await page.locator('[data-copyex]').click();assert.equal(await page.locator('[data-editex]').count(),2);
   await page.locator('[data-move="down"]').first().click();await page.locator('[data-delex]').first().click();assert.equal(await page.locator('[data-editex]').count(),1);
   await page.locator('#programmeDayUp').click();assert.equal(Number(await page.locator('#editDaySelect').inputValue()),Number(dayIndex)-1);
   await page.locator('#programmeDayCopy').click();assert((await page.locator('#editDaySelect option:checked').innerText()).includes('copy'));
   await page.locator('#programmeDayDelete').click();
   // Select by its saved ID after other programme changes have shifted its index.
   let index=await page.evaluate(id=>JSON.parse(localStorage.getItem('htData_v1')).program.findIndex(d=>d.id===id),dayId);
   await page.locator('#editDaySelect').selectOption(String(index));await page.locator('#programmeDaySettings').click();await page.locator('#dayEditName').fill('Builder renamed');await page.locator('#dayEditSave').click();
   await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption(String(index));await page.locator('[data-action="startPicked"]').click();
   assert((await page.locator('.coach-effort').first().innerText()).includes('3 RIR'));assert((await page.locator('.ex-card').first().innerText()).includes('Tempo: 3-1-1-0'));assert((await page.locator('.ex-target').first().innerText()).includes('each leg'));
   await page.locator('[data-field="weight"]').first().fill('10');await page.locator('[data-field="reps"]').first().fill('8');await page.locator('[data-action="toggleComplete"]').first().check();
   const active=await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('htData_v1')).activeSession));
   await page.locator('#navbar [data-tab="more"]').click();await page.locator('#editDaySelect').selectOption(String(index));await page.locator('#programmeDayDelete').click();assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('htData_v1')).activeSession)),active);
   await page.locator('[data-editex]').click();await page.locator('#fEditSets').fill('1');await page.locator('#fEditRir').fill('4');await page.locator('#fEditTempo').fill('New tempo');await page.locator('#fEditSave').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('htData_v1')).activeSession)),active);
   await page.reload();assert.equal(await page.locator('[data-action="toggleComplete"]').count(),2);assert((await page.locator('.coach-effort').first().innerText()).includes('3 RIR'));
   await page.locator('[data-action="finishWorkout"]').click();await page.locator('[data-action="closeModalHome"]').click();
   await page.locator('#navbar [data-tab="more"]').click();await page.locator('#editDaySelect').selectOption(String(index));await page.locator('#programmeDayDelete').click();
   await page.locator('#navbar [data-tab="history"]').click();assert.equal(await page.locator('.hist-item').count(),1);
   await page.locator('#navbar [data-tab="progress"]').click();await page.locator('#exSearch').fill('Builder exercise');assert((await page.locator('#exerciseProgressDetail').innerText()).includes('Historical variation / removed exercise'));
   // Add a distinct rest day and prove Train logs that selected day, not the first rest day.
   await page.locator('#navbar [data-tab="more"]').click();await page.locator('[data-action="addProgrammeDay"]').click();await page.locator('#dayEditName').fill('Extra recovery');await page.locator('#dayEditType').selectOption('rest');await page.locator('#dayEditSave').click();const restIndex=await page.locator('#editDaySelect').inputValue();
   assert.equal(await page.locator('#programmeAddExercise').count(),0);
   await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption(restIndex);await page.locator('[data-action="startPicked"]').click();await page.locator('[data-action="logRestDay"]').click();
   data=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));assert.equal(data.sessions.at(-1).dayName,'Extra recovery');assert.equal(data.sessions.length,2);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));assert.deepEqual(errors,[]);
   console.log(name+': Phase 5 day/exercise CRUD, copy/reorder, strict inputs, effort/tempo, active recovery, retained history/analytics and selected rest day passed');await context.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
