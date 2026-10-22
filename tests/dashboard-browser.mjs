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
   const fixture=await page.evaluate(()=>{
    const data=defaultData(),slots=data.program.flatMap(day=>day.exercises.filter(e=>e.name==='Dumbbell Shoulder Press').map(ex=>({day,ex})));data.programStartDate=todayISO();
    data.sessions=slots.map(({day,ex},i)=>({id:'shoulder'+i,date:todayISO(),startedAt:i+1,dayId:day.id,dayName:day.name,weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name:i?'  DUMBBELL   Shoulder Press ':ex.name,definition:JSON.parse(JSON.stringify(ex)),notes:'',sets:[{weight:20+i*2,reps:8+i*2,completed:true}]}]}));
    localStorage.setItem('htData_v1',JSON.stringify(data));return {key:movementKey(slots[0].ex.name),days:slots.map(s=>s.day.name)};
   });await page.reload();const original=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   assert((await page.locator('#homeWeek').innerText()).includes('2 workouts'));
   await page.locator('[data-action="homeNavigate"][data-tab="progress"]').click();
   assert.equal(await page.locator('#exSelect option').filter({hasText:'Dumbbell Shoulder Press'}).count(),1);
   await page.locator('#exSelect').selectOption(fixture.key);assert.equal(await page.locator('#progressLatest').innerText(),'22 kg × 10');assert.equal(await page.locator('#progressPrevious').innerText(),'20 kg × 8');
   assert.equal(await page.locator('.progress-target').count(),2);const targets=await page.locator('.progress-next').innerText();assert(targets.includes('3 × 6–10'));assert(targets.includes('3 × 8–12'));for(const day of fixture.days)assert(targets.includes(day));assert.equal(await page.locator('#exerciseProgressDetail svg circle').count(),2);
   assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);
   await page.locator('#navbar [data-tab="home"]').click();await page.locator('[data-action="personaliseDashboard"]').click();await page.locator('#dashboardName').fill('Cancelled');await page.locator('[data-action="closeModal"]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);
   await page.locator('[data-action="personaliseDashboard"]').click();await page.locator('#dashboardName').fill('Guy');await page.locator('#dashboardGoal').fill('2.5');await page.locator('#dashboardSave').click();assert((await page.locator('#dashboardError').innerText()).includes('whole-number'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);
   await page.locator('#dashboardGoal').fill('5');await page.locator('#dashboard_showNutrition').uncheck();await page.locator('#dashboard_showBodyweight').uncheck();
   await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='htData_v1')throw new DOMException('full','QuotaExceededError');return window.originalSetItem.call(this,key,value);};});
   await page.locator('#dashboardSave').click();assert((await page.locator('#dashboardError').innerText()).includes('full'));assert.equal(await page.locator('#dashboardName').inputValue(),'Guy');assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),original);
   await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await page.locator('#dashboardSave').click();assert((await page.locator('.home-heading').innerText()).includes('Welcome, Guy'));assert((await page.locator('#homeWeek').innerText()).includes('2 / 5 workouts'));assert(!(await page.locator('#content').innerText()).includes("Today's Nutrition"));
   await page.reload();assert((await page.locator('.home-heading').innerText()).includes('Welcome, Guy'));const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));assert.deepEqual(saved.sessions,JSON.parse(original).sessions);assert.deepEqual(saved.program,JSON.parse(original).program);
   await page.locator('[data-action="homeTrack"][data-input="bwInput"]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'bwInput');await page.locator('#bwInput').fill('74.2');await page.locator('[data-action="logBodyweight"]').click();
   await page.locator('#navbar [data-tab="home"]').click();await page.locator('[data-action="homeTrack"][data-input="calInput"]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'calInput');await page.locator('#calInput').fill('2500');await page.locator('#proInput').fill('160');await page.locator('[data-action="logNutrition"]').click();
   await page.locator('#navbar [data-tab="home"]').click();await page.locator('[data-action="personaliseDashboard"]').click();await page.locator('#dashboard_showNutrition').check();await page.locator('#dashboardSave').click();await page.locator('[data-action="logNutritionToday"]').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'calInput');
   await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();await page.locator('[data-field="weight"]').first().fill('30');await page.locator('[data-field="reps"]').first().fill('8');await page.locator('[data-action="toggleComplete"]').first().check();await page.locator('#workoutReadiness').selectOption('low');
   await page.locator('#navbar [data-tab="home"]').click();assert((await page.locator('#homeActive').innerText()).includes('1 of'));assert((await page.locator('#homeCoaching').innerText()).includes('Lower readiness today'));assert((await page.locator('#homeWeek').innerText()).includes('2 / 5 workouts'));await page.locator('#homeActive [data-action="gotoTrain"]').click();assert.equal(await page.locator('[data-action="toggleComplete"]').first().isChecked(),true);
   await page.reload();await page.locator('#navbar [data-tab="home"]').click();assert.equal(await page.locator('#homeActive').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('[data-action="homeNavigate"][data-tab="history"]').click();await page.locator('[data-action="deleteWorkout"][data-sid="shoulder1"]').click();await page.locator('#navbar [data-tab="progress"]').click();await page.locator('#exSelect').selectOption(fixture.key);assert.equal(await page.locator('#progressLatest').innerText(),'20 kg × 8');await page.locator('#undoDelete').click();assert.equal(await page.locator('#progressLatest').innerText(),'22 kg × 10');
   assert.deepEqual(errors,[]);console.log(name+': Phase 7 shared movement charts, day targets, read-only history, personalisation/cancel/validation/quota retry/reload, quick tracking, active continuation, priorities, deletion/Undo and mobile layout passed');await context.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
