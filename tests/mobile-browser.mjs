import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const prefix='/hypertrophy-tracker-v2/';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
let failVersion=false;
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
  if(failVersion && url.pathname.endsWith('/version.json')){res.writeHead(503);return res.end('Temporarily unavailable');}
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
   await page.waitForFunction(()=>navigator.serviceWorker.controller && document.getElementById('offlineStatus').textContent.includes('Ready'));
   const meta=await page.locator('meta[name="viewport"]').getAttribute('content');assert(!meta.includes('maximum-scale'));assert(!meta.includes('user-scalable=no'));
   await page.locator('#navbar [data-tab="more"]').click();await page.waitForFunction(()=>!document.getElementById('checkAppUpdate').disabled);
   assert((await page.locator('#appExperience').innerText()).includes('Opened in a browser'));const initial=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   await page.locator('#checkAppUpdate').click();await page.waitForFunction(()=>document.getElementById('appUpdateMessage').textContent.includes('latest published'));assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),initial);
   failVersion=true;await page.locator('#checkAppUpdate').click();await page.waitForFunction(()=>document.getElementById('appUpdateMessage').textContent.includes('Could not check'));assert.equal(await page.locator('#checkAppUpdate').isEnabled(),true);failVersion=false;
   await context.setOffline(true);await page.locator('#checkAppUpdate').click();assert((await page.locator('#appUpdateMessage').innerText()).includes('reconnect'));assert((await page.locator('#appOfflineState').innerText()).includes('Offline'));await context.setOffline(false);
   await page.locator('[data-action="installApp"]').click();assert((await page.locator('#modalBody').innerText()).includes('Open as Web App'));assert((await page.locator('#modalBody').innerText()).includes('import that backup'));
   await page.keyboard.press('Escape');assert.equal(await page.locator('#overlay').isVisible(),false);
   await page.evaluate(()=>{Object.defineProperty(navigator,'standalone',{configurable:true,value:true});refreshAppDetails();});assert((await page.locator('#appLaunchMode').innerText()).includes('Home Screen app'));await page.locator('[data-action="installApp"]').click();assert((await page.locator('#modalBody').innerText()).includes('No reinstall is needed'));await page.locator('[data-action="closeModal"]').click();await page.evaluate(()=>{delete navigator.standalone;});
   await page.locator('#navbar [data-tab="train"]').click();await page.locator('#dayPicker').selectOption('0');await page.locator('[data-action="startPicked"]').click();
   const weight=page.locator('[data-field="weight"]').first(),reps=page.locator('[data-field="reps"]').first();
   await weight.fill('32.5');assert.equal(await page.locator('#entryToolbar').isVisible(),true);assert.equal(await page.locator('#entryPrevious').isDisabled(),true);assert((await page.locator('#entryLabel').innerText()).includes('Set 1 · kg'));
   await page.locator('#entryNext').click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.field),'reps');await reps.fill('8');await page.locator('#entryPrevious').click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.field),'weight');await weight.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.dataset.field),'reps');
   assert.equal(await page.locator('[data-action="toggleComplete"]').first().isChecked(),false);
   const savedBeforeKeyboard=await page.evaluate(()=>localStorage.getItem('htData_v1'));
   // Model a visual keyboard viewport; Playwright does not show a physical iOS keyboard.
   const keyboardHeight=await page.evaluate(()=>{
    window.mobileOriginalViewport=Object.getOwnPropertyDescriptor(window,'visualViewport');
    const height=Math.round(innerHeight*.55);Object.defineProperty(window,'visualViewport',{configurable:true,value:{height,offsetTop:0,scale:1}});syncMobileControls();return height;
   });assert.equal(await page.locator('#navbar').evaluate(el=>getComputedStyle(el).visibility),'hidden');const bar=await page.locator('#entryToolbar').boundingBox();assert(Math.abs(bar.y+bar.height-keyboardHeight)<2);
   await page.evaluate(()=>{Object.defineProperty(window,'visualViewport',window.mobileOriginalViewport);syncMobileControls();});assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),savedBeforeKeyboard);
   await page.locator('#entryDone').click();assert.equal(await page.locator('#entryToolbar').isVisible(),false);assert.equal(await page.locator('[data-action="toggleComplete"]').first().isChecked(),false);
   await page.locator('[data-action="toggleComplete"]').first().check();assert.equal(await page.locator('#resttimer').isVisible(),true);
   for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);await page.evaluate(()=>syncMobileControls());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.equal(await weight.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),true);const hit=await page.locator('.checkwrap').first().boundingBox();assert(hit.width>=44 && hit.height>=44);
    await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));const finish=await page.locator('[data-action="finishWorkout"]').boundingBox(),rest=await page.locator('#resttimer').boundingBox();assert(finish.y+finish.height<=rest.y+1,'Rest bar covered Finish');
   }
   await page.setViewportSize({width:390,height:844});await page.locator('#workoutNotes').fill('First line');await page.locator('#workoutNotes').press('End');await page.locator('#workoutNotes').press('Enter');await page.locator('#workoutNotes').pressSequentially('Second line');assert((await page.locator('#workoutNotes').inputValue()).includes('First line\nSecond line'));await page.locator('#entryDone').click();
   // Focus stays in the dialog, returns to its opener, and Cancel preserves saved data.
   await page.locator('#navbar [data-tab="home"]').click();const beforeDialog=await page.evaluate(()=>localStorage.getItem('htData_v1'));await page.locator('[data-action="personaliseDashboard"]').focus();await page.locator('[data-action="personaliseDashboard"]').click();
   assert.equal(await page.locator('#modalBody').getAttribute('role'),'dialog');await page.locator('[data-action="closeModal"]').focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'dashboardName');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'closeModal');await page.keyboard.press('Escape');assert.equal(await page.locator('#overlay').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'personaliseDashboard');assert.equal(await page.evaluate(()=>localStorage.getItem('htData_v1')),beforeDialog);
   await page.reload();assert.equal(await weight.inputValue(),'32.5');assert.equal(await reps.inputValue(),'8');assert.equal(await page.locator('[data-action="toggleComplete"]').first().isChecked(),true);assert((await page.locator('#workoutNotes').inputValue()).includes('Second line'));assert.deepEqual(errors,[]);
   console.log(name+': Phase 8 input navigation, touch sizing, narrow/landscape layouts, keyboard geometry, dialog focus, install/standalone help, manual/offline/failed update checks and workout recovery passed');await context.close();
  }finally{await browser.close();}
 }
}finally{await new Promise(resolve=>server.close(resolve));}
