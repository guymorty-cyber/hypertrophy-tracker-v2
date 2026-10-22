import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const source=fileURLToPath(new URL('../',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'tracker-pwa-'));
const builds=['a'.repeat(40),'b'.repeat(40),'c'.repeat(40)];
const roots=builds.map((build,i)=>{
  const path=join(temp,String(i));
  execFileSync('python',['scripts/build_pages.py','--output',path,'--build',build],{cwd:source});
  return path;
});
const prefix='/hypertrophy-tracker-v2/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
let current=0,missingAssetSeen=false;
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
  const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
  if(relative==='legacy-fixture.html'){
    res.writeHead(200,{'Content-Type':'text/html'});
    return res.end('<!doctype html><title>Previous tracker storage fixture</title>Previous tracker');
  }
  if(current===2 && relative==='assets/'+builds[2]+'/js/views/workout.js'){
    missingAssetSeen=true;
    res.writeHead(503);return res.end('A release asset is unavailable');
  }
  const path=resolve(roots[current],relative);
  if(!path.startsWith(resolve(roots[current])+sep)){res.writeHead(403);return res.end();}
  try{
    const body=readFileSync(path);
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(body);
  }catch(e){res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const base='http://127.0.0.1:'+port+prefix;
async function setOffline(context,name,offline){
  if(name!=='WebKit') return context.setOffline(offline);
  // Playwright issue microsoft/playwright#42775: WebKit's offline emulator
  // rejects even literal service-worker responses. Stop the origin instead.
  if(offline && server.listening) await new Promise(resolve=>server.close(resolve));
  if(!offline && !server.listening) await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
}

// Synthetic data in the existing htData_v1 format, including personal programme edits.
const dataSource=readFileSync(join(source,'js/data.js'),'utf8');
const legacy=new Function(dataSource+'\nreturn defaultData();')();
legacy.programStartDate='2026-09-01';
legacy.program[0].name='My Upper A';
legacy.program[0].exercises[0].sets=4;
legacy.bodyweight=[{date:'2026-10-20',weight:73.5}];
legacy.nutrition=[{date:'2026-10-20',calories:2850,protein:200}];
const session={id:'legacy-finished',date:'2026-10-20',startedAt:1792494000000,
  dayId:legacy.program[0].id,dayName:'My Upper A',weekNumber:1,phase:'Calibration',
  exercises:legacy.program[0].exercises.map((ex,i)=>({exerciseId:ex.id,name:ex.name,notes:'Existing exercise note',
    sets:Array.from({length:ex.sets},()=>({weight:i===0?30:null,reps:i===0?8:null,completed:i===0}))})),
  kneePain:{before:1,after:1,nextMorning:null},notes:'Existing finished workout',totalSets:4,totalReps:32,totalVolume:960};
legacy.sessions=[session];
legacy.pendingNextMorning={sessionId:session.id,date:session.date,dayName:session.dayName};
legacy.activeSession=JSON.parse(JSON.stringify(session));
legacy.activeSession.id='legacy-active';
legacy.activeSession.startedAt=Date.now();
legacy.activeSession.notes='Existing unfinished workout';
legacy.customFlag='Keep unknown saved fields';
const originalRaw=JSON.stringify(legacy),backupRaw=JSON.stringify({...legacy,activeSession:null});

try{
  // Validate the packaged shell and manifest without relying on browser install UI.
  const manifest=JSON.parse(readFileSync(join(roots[0],'manifest.webmanifest'),'utf8'));
  assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.id,'./');
  for(const icon of manifest.icons) assert(existsSync(join(roots[0],icon.src)));
  const worker=readFileSync(join(roots[0],'sw.js'),'utf8');
  new Function(worker);assert(!worker.includes('__PRECACHE__'));
  for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    current=0;missingAssetSeen=false;
    if(!server.listening) await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    const browser=await engine.launch();
    try{
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      let page=await context.newPage();
      const errors=[];
      const watch=p=>{p.setDefaultTimeout(20000);p.on('pageerror',error=>errors.push(error.message));p.on('dialog',d=>d.accept());};
      watch(page);
      await page.goto(base+'legacy-fixture.html');
      await page.evaluate(({raw,backup})=>{
        localStorage.setItem('htData_v1',raw);localStorage.setItem('htData_v1_backup',backup);
      },{raw:originalRaw,backup:backupRaw});
      await page.goto(base+'?v=previous-release');
      await page.waitForFunction(()=>navigator.serviceWorker.controller && document.querySelector('#offlineStatus').textContent.includes('Ready'));
      assert.equal(await page.locator('#workoutNotes').inputValue(),'Existing unfinished workout');
      assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),originalRaw,'Upgrade changed existing saved data');
      assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1_backup')),backupRaw);
      assert.equal(await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.scope)),base);
      await page.evaluate(()=>caches.open('unrelated-app-cache'));

      await setOffline(context,name,true);
      await page.close();page=await context.newPage();watch(page);
      await page.goto(base+'?v=offline-reopen');
      assert.equal(await page.locator('#workoutNotes').inputValue(),'Existing unfinished workout');
      await page.locator('#workoutNotes').fill('Saved while offline');
      await page.locator('.ex-card').first().locator('[data-action="addSet"]').click();
      assert.equal(await page.locator('.ex-card').first().locator('[data-action="toggleComplete"]').count(),5);
      await page.locator('[data-action="finishWorkout"]').click();
      await page.locator('[data-action="closeModalHome"]').click();
      await page.locator('#navbar [data-tab="history"]').click();
      assert.equal(await page.locator('.hist-item').count(),2);
      await page.close();page=await context.newPage();watch(page);
      await page.goto(base+'index.html?v=offline-history');
      await page.locator('#navbar [data-tab="history"]').click();
      assert.equal(await page.locator('.hist-item').count(),2);
      await page.locator('#navbar [data-tab="more"]').click();
      await page.locator('[data-action="installApp"]').click();
      assert((await page.locator('#modalBody').innerText()).includes('Add to Home Screen'));
      await page.locator('[data-action="closeModal"]').click();

      // A waiting worker must never reload a workout without the user's Update action.
      await page.locator('#navbar [data-tab="train"]').click();
      await page.locator('#dayPicker').selectOption('0');
      await page.locator('[data-action="startPicked"]').click();
      await page.locator('#workoutNotes').fill('Preserve me through the app update');
      current=1;await setOffline(context,name,false);
      await page.evaluate(()=>checkForUpdate());
      await page.locator('#updateApp').waitFor({state:'visible'});
      await page.waitForFunction(()=>navigator.serviceWorker.getRegistration().then(r=>!!r.waiting));
      assert.equal(await page.evaluate(()=>APP_BUILD),builds[0]);
      const second=await context.newPage();watch(second);await second.goto(base);
      const secondURL=second.url();
      // Simulate full device storage. Update must stop before activating the new worker.
      await page.evaluate(()=>{
        window.originalStorageSet=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){
          if(key==='htData_v1') throw new DOMException('Storage full','QuotaExceededError');
          return window.originalStorageSet.call(this,key,value);
        };
      });
      await page.locator('#updateApp').click();
      assert((await page.locator('#saveStatus').innerText()).includes('full'));
      assert.equal(await page.evaluate(()=>APP_BUILD),builds[0]);
      await page.evaluate(()=>{Storage.prototype.setItem=window.originalStorageSet;});
      await page.locator('#updateApp').click();
      await page.waitForFunction(build=>APP_BUILD===build,builds[1]);
      assert.equal(await page.locator('#workoutNotes').inputValue(),'Preserve me through the app update');
      assert.equal(second.url(),secondURL,'Another open tab was forcibly reloaded');
      assert.equal(await second.evaluate(()=>APP_BUILD),builds[0]);
      assert((await page.evaluate(()=>caches.keys())).includes('unrelated-app-cache'));
      await second.close();
      await page.waitForFunction(()=>document.querySelector('#offlineStatus').textContent.includes('Ready'));

      // An incomplete next release cannot replace the current offline shell.
      current=2;await page.evaluate(()=>checkForUpdate());
      await new Promise((resolve,reject)=>{
        const start=Date.now();const timer=setInterval(()=>{
          if(missingAssetSeen){clearInterval(timer);resolve();}
          else if(Date.now()-start>20000){clearInterval(timer);reject(Error('Missing-asset test did not install'));}
        },100);
      });
      await page.waitForFunction(()=>navigator.serviceWorker.getRegistration().then(r=>!r.installing && !r.waiting));
      assert.equal(await page.evaluate(()=>APP_BUILD),builds[1]);
      assert.equal(await page.locator('#updateApp').isVisible(),false);
      assert(!(await page.evaluate(()=>caches.keys())).some(key=>key.endsWith('c'.repeat(40))));
      await setOffline(context,name,true);await page.close();page=await context.newPage();watch(page);
      await page.goto(base+'?v=after-failed-update');
      assert.equal(await page.evaluate(()=>APP_BUILD),builds[1]);
      assert.equal(await page.locator('#workoutNotes').inputValue(),'Preserve me through the app update');
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));
      assert.equal(saved.sessions.length,2);assert.equal(saved.program[0].name,'My Upper A');
      assert.deepEqual(saved.bodyweight,legacy.bodyweight);assert.deepEqual(saved.nutrition,legacy.nutrition);
      assert.equal(saved.customFlag,legacy.customFlag);
      assert.deepEqual(errors,[]);
      console.log(name+': legacy history, offline reopen/logging, installation metadata, safe updates and failed-release recovery passed');
      await context.close();
    }finally{await browser.close();}
  }
}finally{
  if(server.listening) await new Promise(resolve=>server.close(resolve));
  rmSync(temp,{recursive:true,force:true});
}
