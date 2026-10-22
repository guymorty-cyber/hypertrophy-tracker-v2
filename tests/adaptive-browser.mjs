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
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base);
   await page.evaluate(()=>{
    const data=defaultData(),ex=data.program[0].exercises[0];ex.sets=1;const date=todayISO();data.programStartDate=date;
    data.sessions=[1,2,3].map(n=>({id:'seed'+n,date,startedAt:n,dayId:data.program[0].id,dayName:data.program[0].name,weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name:ex.name,definition:JSON.parse(JSON.stringify(ex)),notes:'',sets:[{weight:40,reps:8,completed:true}]}]}));localStorage.setItem('htData_v1',JSON.stringify(data));
   });await page.reload();
   const start=async()=>{await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();};
   await start();const first=page.locator('.ex-card').first();
   assert((await first.locator('.coach-detail').innerText()).includes('three comparable workouts'));
   assert((await first.locator('.coach-main').innerText()).includes('HOLD / REBUILD'));
   assert.equal(await first.locator('[data-action="exerciseEffort"]').isDisabled(),true);
   await page.locator('#workoutReadiness').selectOption('low');assert((await first.locator('.coach-detail').innerText()).includes('readiness lower than usual'));
   await page.locator('#workoutReadiness').selectOption('usual');
   await first.locator('[data-field="weight"]').first().fill('40');await first.locator('[data-field="reps"]').first().fill('10');await first.locator('[data-action="toggleComplete"]').first().check();
   await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='htData_v1')throw new DOMException('full','QuotaExceededError');return window.originalSetItem.call(this,key,value);};});
   await first.locator('[data-action="exerciseEffort"]').selectOption('0');assert.equal(await first.locator('[data-action="exerciseEffort"]').inputValue(),'');assert((await page.locator('#saveStatus').innerText()).includes('full'));
   await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await first.locator('[data-action="exerciseEffort"]').selectOption('0');
   await page.reload();assert.equal(await first.locator('[data-action="exerciseEffort"]').inputValue(),'0');assert.equal(await page.locator('#workoutReadiness').inputValue(),'usual');
   await page.locator('[data-action="finishWorkout"]').click();await page.locator('[data-action="closeModalHome"]').click();
   const id=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).sessions.at(-1).id);
   await start();assert((await first.locator('.coach-main').innerText()).includes('40 KG'));assert((await first.locator('.coach-detail').innerText()).includes('harder than its 2 RIR target'));
   await page.locator('#navbar [data-tab="history"]').click();await page.locator(`[data-action="editHistory"][data-sid="${id}"]`).click();
   assert.equal(await page.locator('#historyEffort_0').inputValue(),'0');await page.locator('#historyEffort_0').selectOption('2');await page.locator('#historyEditSave').click();assert((await page.locator('#modalBody').innerText()).includes('Reported final-set RIR: 2'));await page.locator('[data-action="closeModal"]').click();
   await page.locator('#navbar [data-tab="train"]').click();assert((await first.locator('.coach-main').innerText()).includes('42.5 KG'));
   await page.locator('#workoutReadiness').selectOption('low');assert((await first.locator('.coach-main').innerText()).includes('40 KG'));assert((await first.locator('.coach-effort').innerText()).includes('Lower readiness'));
   await page.locator('#workoutReadiness').selectOption('');assert((await first.locator('.coach-main').innerText()).includes('42.5 KG'));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));assert.deepEqual(errors,[]);
   console.log(name+': Phase 6 stall explanation, readiness controls, gated RIR feedback, quota rollback, recovery, next-workout adaptation and History correction passed');await context.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
