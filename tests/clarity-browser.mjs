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
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{d.accept().catch(e=>{if(!closing)errors.push(e.message);});});await page.goto(base);
   const seed=await page.evaluate(()=>{
    const data=defaultData(),day=data.program[0],ex=day.exercises[0],date=todayISO();data.programStartDate=date;
    data.sessions=[7,8,9].map((n,i)=>({id:'clarity'+i,date,startedAt:i+1,dayId:day.id,dayName:day.name,weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId:ex.id,name:ex.name,notes:'',definition:JSON.parse(JSON.stringify(ex)),sets:[n,7,7].map(reps=>({weight:40,reps,completed:true}))}]}));
    data.sessions=rebuildHistory(data.sessions);localStorage.setItem('htData_v1',JSON.stringify(data));return {key:movementKey(ex.name),name:ex.name};
   });await page.reload();const raw=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   assert((await page.locator('#homeWeek').innerText()).includes('3 workouts'));assert((await page.locator('#weeklyReview').innerText()).includes('1 improving'));
   assert.equal(await page.locator('#weeklyReview details').evaluate(el=>el.open),false);
   await page.locator('#weeklyReview summary').click();assert((await page.locator('#weeklyReview .weekly-movement').innerText()).includes(seed.name));assert((await page.locator('#weeklyReview .coach-verdict').innerText()).includes('Improving'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),raw);
   await page.locator('[data-action="homeNavigate"][data-tab="progress"]').click();await page.locator('#exSelect').selectOption(seed.key);assert((await page.locator('.progress-target').first().innerText()).includes('Improving'));assert((await page.locator('.progress-next-action').first().innerText()).includes('24 total reps'));
   await page.locator('.progress-target .coach-explanation > summary').first().click();assert((await page.locator('.progress-target .coach-detail').first().innerText()).includes('21 → 22 → 23'));
   assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),raw);
   await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();const first=page.locator('.ex-card').first();
   assert((await first.locator('.prev-line').innerText()).includes('40kg×9'));assert((await first.locator('.coach-goal').innerText()).includes('one more total rep: 24 total reps'));
   assert.equal(await first.locator('.coach-explanation').evaluate(el=>el.open),false);assert.equal(await first.locator('.coach-detail').isVisible(),false);
   const position=await first.evaluate(el=>({target:el.querySelector('.reco').getBoundingClientRect().bottom,inputs:el.querySelector('.setlabels').getBoundingClientRect().top}));assert(position.target<=position.inputs+1);
   const summary=first.locator('.coach-explanation > summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await first.locator('.coach-explanation').evaluate(el=>el.open),true);assert.equal(await first.locator('.coach-set-target').count(),3);assert((await first.locator('.coach-verdict').innerText()).includes('Improving'));
   await page.locator('#workoutReadiness').selectOption('low');assert(!(await first.locator('.coach-goal').innerText()).includes('one more'));await first.locator('.coach-explanation > summary').click();assert((await first.locator('.coach-verdict').innerText()).includes('Holding steady'));
   await first.locator('[data-field="weight"]').first().fill('40');await first.locator('[data-field="reps"]').first().fill('9');await first.locator('[data-action="toggleComplete"]').first().check();
   await page.reload();assert.equal(await first.locator('[data-action="toggleComplete"]').first().isChecked(),true);assert.equal(await page.locator('#workoutReadiness').inputValue(),'low');
   await page.locator('#navbar [data-tab="home"]').click();assert((await page.locator('#homeWeek').innerText()).includes('3 workouts'));assert((await page.locator('.weekly-focus').innerText()).includes('easier effort'));
   await page.locator('[data-action="homeNavigate"][data-tab="history"]').click();await page.locator('[data-action="editHistory"][data-sid="clarity2"]').click();await page.locator('#historyReps_0_0').fill('6');await page.locator('#historyEditSave').click();await page.locator('[data-action="closeModal"]').click();
   await page.locator('#navbar [data-tab="home"]').click();assert((await page.locator('#weeklyReview').innerText()).includes('0 improving'));
   await page.locator('[data-action="homeNavigate"][data-tab="history"]').click();await page.locator('[data-action="deleteWorkout"][data-sid="clarity2"]').click();await page.locator('#navbar [data-tab="home"]').click();assert((await page.locator('#weeklyReview').innerText()).includes('1 building a baseline'));await page.locator('#undoDelete').click();assert((await page.locator('#homeWeek').innerText()).includes('3 workouts'));
   await page.locator('[data-action="personaliseDashboard"]').click();await page.locator('#dashboard_showCoaching').uncheck();await page.locator('#dashboardSave').click();assert.equal(await page.locator('#weeklyReview').count(),0);await page.reload();await page.locator('#navbar [data-tab="home"]').click();assert.equal(await page.locator('#weeklyReview').count(),0);
   await page.locator('[data-action="personaliseDashboard"]').click();await page.locator('#dashboard_showCoaching').check();await page.locator('#dashboardSave').click();assert.equal(await page.locator('#weeklyReview').count(),1);
   for(const width of [320,390,844]){await page.setViewportSize({width,height:width===844?390:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
   assert.deepEqual(errors,[]);console.log(name+': clear targets, optional/keyboard explanations, day verdicts, weekly review, readiness, saved logging, history correction/delete/Undo, visibility and mobile layout passed');await context.close();
  }finally{closing=true;await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
