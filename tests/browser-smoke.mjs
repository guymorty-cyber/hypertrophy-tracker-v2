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
      page.on('pageerror',error=>errors.push(error.message));
      page.on('dialog',dialog=>dialog.accept());
      await page.goto(base);
      await page.locator('#navbar [data-tab="train"]').click();
      await page.locator('[data-action="startPicked"]').click();
      const first=page.locator('.ex-card').first();
      await first.locator('[data-field="weight"]').first().fill('30');
      await first.locator('[data-field="reps"]').first().fill('10');
      await first.locator('[data-action="toggleComplete"]').first().check();
      await page.locator('#workoutNotes').fill('Browser recovery test');
      assert.equal(await page.locator('#resttimer').evaluate(el=>el.classList.contains('show')),true);
      await page.reload();
      assert.equal(await page.locator('#workoutNotes').inputValue(),'Browser recovery test');
      assert.equal(await page.locator('[data-action="toggleComplete"]').first().isChecked(),true);
      assert.equal(await page.locator('#resttimer').evaluate(el=>el.classList.contains('show')),true);
      await page.locator('[data-action="finishWorkout"]').click();
      await page.locator('[data-action="closeModalHome"]').click();
      await page.locator('#navbar [data-tab="history"]').click();
      assert.equal(await page.locator('.hist-item').count(),1);
      await page.locator('[data-action="deleteWorkout"]').click();
      assert.equal(await page.locator('.hist-item').count(),0);
      assert.equal(await page.locator('#overlay').evaluate(el=>el.classList.contains('hide')),true);
      await page.locator('#undoDelete').click();
      assert.equal(await page.locator('.hist-item').count(),1);
      await page.reload();
      await page.locator('#navbar [data-tab="history"]').click();
      assert.equal(await page.locator('.hist-item').count(),1);
      // Repeat the same exercise with real history, not just a fresh programme.
      await page.locator('#navbar [data-tab="train"]').click();
      await page.locator('#dayPicker').selectOption('0');
      await page.locator('[data-action="startPicked"]').click();
      const repeat=page.locator('.ex-card').first();
      const planned=await repeat.locator('[data-action="toggleComplete"]').count();
      await repeat.locator('[data-field="weight"]').first().fill('37.5');
      await repeat.locator('[data-action="useLastSession"]').click();
      assert.equal(await repeat.locator('[data-field="weight"]').first().inputValue(),'37.5');
      assert.equal(await repeat.locator('[data-field="reps"]').first().inputValue(),'10');
      assert.equal(await repeat.locator('[data-action="toggleComplete"]').first().isChecked(),false);
      await repeat.locator('[data-action="addSet"]').click();
      assert.equal(await repeat.locator('[data-action="toggleComplete"]').count(),planned+1);
      await page.reload();
      assert.equal(await repeat.locator('[data-action="toggleComplete"]').count(),planned+1);
      await repeat.locator('[data-action="removeSet"]').click();
      assert.equal(await repeat.locator('[data-action="toggleComplete"]').count(),planned);
      await repeat.locator('[data-field="weight"]').last().fill('35');
      await repeat.locator('[data-field="reps"]').last().fill('8');
      await repeat.locator('[data-action="toggleComplete"]').last().check();
      assert.equal(await repeat.locator('[data-action="removeSet"]').isDisabled(),true);
      await repeat.locator('[data-action="toggleComplete"]').last().uncheck();
      await repeat.locator('[data-action="removeSet"]').click();
      assert.equal(await repeat.locator('[data-action="toggleComplete"]').count(),planned-1);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).program[0].exercises[0].sets),planned);
      await page.locator('#navbar [data-tab="history"]').click();
      const second=await context.newPage();
      second.on('dialog',dialog=>dialog.accept());
      await second.goto(base);
      await second.evaluate(()=>{
        const d=JSON.parse(localStorage.getItem('htData_v1'));
        d.sessions=[];
        localStorage.setItem('htData_v1',JSON.stringify(d));
      });
      await page.waitForFunction(()=>document.querySelector('#saveStatus').textContent.includes('another tab'));
      await page.locator('[data-action="deleteWorkout"]').click();
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).sessions.length),0);
      assert.equal(await page.locator('.hist-item').count(),1);
      assert.deepEqual(errors,[]);
      console.log(name+': logging, recovery, timers, repeat-session coaching, set controls, history and stale-tab protection passed');
      await context.close();
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}


