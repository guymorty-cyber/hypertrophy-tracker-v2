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
      page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
      await page.goto(base);
      const start=async()=>{
        await page.locator('#navbar [data-tab="train"]').click();
        await page.locator('#dayPicker').selectOption('0');
        await page.locator('[data-action="startPicked"]').click();
      };
      await start();
      const first=page.locator('.ex-card').first();
      assert((await first.locator('.coach-effort').innerText()).includes('2 RIR'));
      for(const [reps,expected] of [
        [[8,8,7],'40 KG · 9 / 8 / 7 REPS'],
        [[9,9,8],'40 KG · 10 / 9 / 8 REPS'],
        [[10,10,10],'42.5 KG · 6 / 6 / 6 REPS']
      ]){
        for(let i=0;i<3;i++){
          await first.locator('[data-field="weight"]').nth(i).fill('40');
          await first.locator('[data-field="reps"]').nth(i).fill(String(reps[i]));
          await first.locator('[data-action="toggleComplete"]').nth(i).check();
        }
        await page.locator('[data-action="finishWorkout"]').click();
        await page.locator('[data-action="closeModalHome"]').click();
        await start();
        await first.locator('.coach-explanation > summary').click();
        assert((await first.locator('.coach-main').innerText()).includes(expected));
        assert.equal(await first.locator('.coach-set-target').count(),3);
      }
      // A deload changes the new session prescription, not the stored programme.
      await page.evaluate(()=>{
        const data=JSON.parse(localStorage.getItem('htData_v1')),d=new Date();d.setDate(d.getDate()-28);
        data.programStartDate=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
        data.activeSession=null;localStorage.setItem('htData_v1',JSON.stringify(data));
      });
      await page.reload();await start();
      assert.equal(await first.locator('[data-action="toggleComplete"]').count(),2);
      assert((await first.locator('.coach-effort').innerText()).includes('3–4 RIR'));
      await first.locator('.coach-explanation > summary').click();
      assert((await first.locator('.coach-detail').innerText()).includes('No partials'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).program[0].exercises[0].sets),3);
      assert.deepEqual(errors,[]);
      console.log(name+': Phase 1 previous performance → logged workouts → next prescription and deload guidance passed');
      await context.close();
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
