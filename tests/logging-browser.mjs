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
      const page=await context.newPage(),errors=[];
      page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
      let accept=true;
      page.on('dialog',d=>accept?d.accept():d.dismiss());
      await page.goto(base);
      await page.locator('#navbar [data-tab="train"]').click();
      await page.locator('#dayPicker').selectOption('0');
      await page.locator('[data-action="startPicked"]').click();
      const first=page.locator('.ex-card').first(),second=page.locator('.ex-card').nth(1);
      const sets=await first.locator('[data-action="toggleComplete"]').count();
      await first.locator('[data-field="weight"]').last().fill('30');
      await first.locator('[data-field="reps"]').last().fill('10');
      await first.locator('[data-action="toggleComplete"]').last().check();
      await first.locator('[data-action="editExFromWorkout"]').click();
      await page.locator('#fEditName').fill('Future press');
      await page.locator('#fEditSets').fill('1');
      await page.locator('#fEditRest').fill('0');
      await page.locator('#fEditInc').fill('0');
      await page.locator('#fEditSave').click();
      assert.equal(await first.locator('[data-action="toggleComplete"]').count(),sets);
      assert.equal(await first.locator('[data-action="toggleComplete"]').last().isChecked(),true);
      assert((await first.locator('.ex-title').innerText()).includes('Incline Dumbbell Press'));
      await first.locator('[data-field="reps"]').last().fill('2.5');
      await first.locator('[data-action="toggleComplete"]').last().uncheck();
      await first.locator('[data-action="toggleComplete"]').last().click();
      assert.equal(await first.locator('[data-action="toggleComplete"]').last().isChecked(),false);
      await first.locator('[data-field="reps"]').last().fill('10');
      await first.locator('[data-action="toggleComplete"]').last().check();
      await second.locator('[data-field="weight"]').first().fill('0');
      const title=await second.locator('.ex-title').innerText();
      await second.locator('[data-action="openAlts"]').click();
      await page.locator('[data-alt="Pendlay Row"]').click();
      assert.equal(await second.locator('.ex-title').innerText(),title);
      await page.locator('[data-action="closeModal"]').click();
      await page.locator('#workoutNotes').fill('Phase 2 workout note');
      await first.locator('[data-action="exNotes"]').fill('Phase 2 exercise note');
      await page.locator('#rtAdd30').click();
      const end=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).restEndAt);
      await page.reload();
      assert.equal(await page.locator('#workoutNotes').inputValue(),'Phase 2 workout note');
      assert.equal(await first.locator('[data-action="exNotes"]').inputValue(),'Phase 2 exercise note');
      assert.equal(await first.locator('[data-action="toggleComplete"]').count(),sets);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).restEndAt),end);
      await page.locator('#rtSkip').click();
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).restEndAt),null);
      accept=false;
      await page.locator('[data-action="finishWorkout"]').click();
      assert.equal(await page.locator('#workoutNotes').count(),1);
      await page.locator('[data-action="cancelSession"]').click();
      assert.equal(await page.locator('#workoutNotes').count(),1);
      accept=true;
      await page.locator('[data-action="finishWorkout"]').click();
      await page.locator('[data-action="closeModalHome"]').click();
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));
      assert.equal(data.sessions.length,1);assert.equal(data.sessions[0].totalVolume,300);
      assert.equal(data.sessions[0].notes,'Phase 2 workout note');
      await page.locator('#navbar [data-tab="train"]').click();
      await page.locator('#dayPicker').selectOption('0');
      await page.locator('[data-action="startPicked"]').click();
      assert.equal(await first.locator('[data-action="toggleComplete"]').count(),1);
      assert((await first.locator('.ex-title').innerText()).includes('Future press'));
      assert.deepEqual(errors,[]);
      console.log(name+': Phase 2 edit safety, swap safety, invalid entry, notes, timer recovery, cancel and partial finish passed');
      await context.close();
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
