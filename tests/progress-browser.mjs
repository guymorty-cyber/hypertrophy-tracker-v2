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
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
   await page.goto(base);
   // Seed saved logs in reverse ID order, with a variation and historical-only movement.
   const fixture=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('htData_v1'))||defaultData(),ex=data.program[0].exercises[0],today=new Date();
    const date=days=>{const d=new Date(today);d.setDate(d.getDate()-days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
    const set=(weight,reps,completed=true)=>({weight,reps,completed});
    const session=(id,days,start,sets,name=ex.name,exerciseId=ex.id)=>({id,date:date(days),startedAt:start,dayId:data.program[0].id,dayName:'Upper A',weekNumber:1,phase:'Calibration',notes:'',kneePain:{before:null,after:null,nextMorning:null},exercises:[{exerciseId,name,notes:'',sets}]});
    data.sessions=[session('z-old',1,100,[set(30,10),set(25,12)]),session('a-new',1,200,[set(35,8),set(30,10),set(999,99,false)]),session('variant',0,300,[set(100,10)],'Different press'),session('archived',2,400,[set(0,15)],'Removed bodyweight movement','deleted_ex'),session('outside',100,500,[set(40,6)])];
    data.bodyweight=[{date:date(15),weight:73},{date:date(1),weight:74},{date:date(0),weight:74.2}];localStorage.setItem('htData_v1',JSON.stringify(data));return {key:JSON.stringify([ex.id,ex.name]),archived:JSON.stringify(['deleted_ex','Removed bodyweight movement']),variant:JSON.stringify([ex.id,'Different press'])};
   });
   await page.reload();const before=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   await page.locator('#navbar [data-tab="progress"]').click();
   await page.locator('#exSelect').selectOption(fixture.key);
   assert.equal(await page.locator('#progressLatest').innerText(),'35 kg × 8');assert.equal(await page.locator('#progressPrevious').innerText(),'30 kg × 10');
   await page.locator('#progressRange').selectOption('30');
   for(const metric of ['load','reps','volume','e1rm']){
    await page.locator('#progressMetric').selectOption(metric);
    assert.equal(await page.locator('#exerciseProgressDetail svg circle').count(),2);
    assert(!(await page.locator('#exerciseProgressDetail').innerHTML()).includes('NaN'));
   }
   assert((await page.locator('#bodyweightProgress').innerText()).includes('74.2 kg'));
   assert((await page.locator('#trainingProgress').innerText()).includes('Completed workouts'));
   await page.locator('#exSelect').selectOption(fixture.variant);
   assert.equal(await page.locator('#progressLatest').innerText(),'100 kg × 10');
   await page.locator('#exSelect').selectOption(fixture.archived);
   assert((await page.locator('#exerciseProgressDetail').innerText()).includes('Historical variation / removed exercise'));
   assert.equal(await page.locator('#progressLatest').innerText(),'0 kg × 15');
   assert.equal(await page.locator('#exerciseProgressDetail svg circle').count(),0);
   await page.locator('#progressMetric').selectOption('reps');assert.equal(await page.locator('#exerciseProgressDetail svg circle').count(),1);
   await page.locator('#exSearch').fill('no matching exercise');assert((await page.locator('#content').innerText()).includes('No exercises match'));
   await page.locator('#exSearch').fill('');await page.locator('#exSelect').selectOption(fixture.key);
   assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),before);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
   // A real History correction must change the next visit to Progress immediately.
   await page.locator('#navbar [data-tab="history"]').click();
   await page.locator('[data-action="editHistory"][data-sid="a-new"]').click();
   await page.locator('#historyWeight_0_0').fill('45');await page.locator('#historyEditSave').click();await page.locator('[data-action="closeModal"]').click();
   await page.locator('#navbar [data-tab="progress"]').click();await page.locator('#exSelect').selectOption(fixture.key);
   assert.equal(await page.locator('#progressLatest').innerText(),'45 kg × 8');
   await page.locator('#navbar [data-tab="history"]').click();await page.locator('[data-action="deleteWorkout"][data-sid="a-new"]').click();
   await page.locator('#navbar [data-tab="progress"]').click();assert.equal(await page.locator('#progressLatest').innerText(),'30 kg × 10');
   await page.locator('#undoDelete').click();assert.equal(await page.locator('#progressLatest').innerText(),'45 kg × 8');
   await page.reload();await page.locator('#navbar [data-tab="progress"]').click();await page.locator('#exSelect').selectOption(fixture.key);assert.equal(await page.locator('#progressLatest').innerText(),'45 kg × 8');
   assert.deepEqual(errors,[]);console.log(name+': Phase 4 workout comparisons, metric/range controls, variations, archived/bodyweight records, no-data states, read-only analytics and History corrections/delete/Undo passed');
   await context.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
