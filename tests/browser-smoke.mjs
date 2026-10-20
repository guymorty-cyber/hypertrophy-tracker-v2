import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const server=createServer((req,res)=>{
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
  res.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
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
      console.log(name+': logging, recovery, timers, finish, deletion, Undo and stale-tab protection passed');
      await context.close();
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
