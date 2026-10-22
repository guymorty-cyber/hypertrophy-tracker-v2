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
      for(const weight of ['30','35']){
        await page.locator('#navbar [data-tab="train"]').click();
        await page.locator('#dayPicker').selectOption('0');
        await page.locator('[data-action="startPicked"]').click();
        await page.locator('[data-field="weight"]').first().fill(weight);
        await page.locator('[data-field="reps"]').first().fill('10');
        await page.locator('[data-action="toggleComplete"]').first().check();
        await page.locator('[data-action="finishWorkout"]').click();
        await page.locator('[data-action="closeModalHome"]').click();
      }
      await page.locator('#navbar [data-tab="history"]').click();
      assert.equal(await page.locator('.hist-item').count(),2);
      const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).sessions.map(s=>s.id));
      assert.equal(await page.locator('.hist-item').first().getAttribute('data-sid'),ids[1]);
      const older=page.locator('.hist-item').filter({has:page.locator(`[data-action="editHistory"][data-sid="${ids[0]}"]`)});
      await older.locator('[data-action="editHistory"]').click();
      await page.locator('#historyEditNotes').fill('Cancelled note');
      await page.locator('[data-action="closeModal"]').click();
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).sessions[0].notes),'');
      await older.locator('[data-action="editHistory"]').click();
      await page.locator('#historyWeight_0_0').fill('-1');
      await page.locator('#historyEditSave').click();
      assert((await page.locator('#historyEditError').innerText()).includes('Check'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).sessions[0].exercises[0].sets[0].weight),30);
      await page.locator('#historyWeight_0_0').fill('40');
      await page.locator('#historyEditNotes').fill('Corrected equipment record');
      await page.locator('#historyExNotes_0').fill('Bench setting 3');
      await page.evaluate(()=>{
        window.originalSetItem=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){if(key==='htData_v1')throw new DOMException('full','QuotaExceededError');return window.originalSetItem.call(this,key,value);};
      });
      await page.locator('#historyEditSave').click();
      assert((await page.locator('#historyEditError').innerText()).includes('not saved'));
      assert.equal(await page.locator('#historyWeight_0_0').inputValue(),'40');
      await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});
      await page.locator('#historyEditSave').click();
      assert((await page.locator('#modalBody').innerText()).includes('40kg × 10'));
      assert((await page.locator('#modalBody').innerText()).includes('Corrected equipment record'));
      await page.locator('[data-action="closeModal"]').click();
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')));
      assert.equal(data.sessions[0].totalVolume,400);
      assert.equal(data.sessions[1].newPRs.length,0);
      await page.reload();await page.locator('#navbar [data-tab="history"]').click();
      await page.locator('#histSearch').fill('equipment');
      assert.equal(await page.locator('.hist-item').count(),1);
      await page.locator('#histSearch').fill('Bench setting');
      assert.equal(await page.locator('.hist-item').count(),1);
      await page.locator('#histSearch').fill('not present');
      assert.equal(await page.locator('.hist-item').count(),0);
      await page.locator('#histSearch').fill('');
      await page.locator('.hist-item').first().click();
      await page.locator('#detailDelete').click();
      assert.equal(await page.locator('.hist-item').count(),1);
      assert.equal(await page.locator('#overlay').evaluate(e=>e.classList.contains('hide')),true);
      await page.locator('[data-action="deleteWorkout"]').click();
      assert.equal(await page.locator('.hist-item').count(),0);
      await page.locator('#undoDelete').click();await page.locator('#undoDelete').click();
      assert.equal(await page.locator('.hist-item').count(),2);
      // Export the actual edited data, then import it through the browser file input.
      await page.locator('#navbar [data-tab="more"]').click();
      let download;
      try{
        [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-action="exportData"]').click()]);
      }catch(error){
        console.log('Backup download diagnostics',JSON.stringify({engine:name,errors,state:await page.evaluate(()=>{
          const button=document.querySelector('[data-action="exportData"]'),r=button?.getBoundingClientRect();
          return {bound:!!button?.onclick,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,active:document.activeElement?.outerHTML,overlay:document.getElementById('overlay').className,scrollY,viewport:[innerWidth,innerHeight],hit:r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML:null};
        })}));throw error;
      }
      const exported=JSON.parse(readFileSync(await download.path(),'utf8'));
      assert.equal(exported.sessions[0].notes,'Corrected equipment record');
      await page.locator('#importFile').setInputFiles({name:'history-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
      await page.locator('#navbar [data-tab="history"]').click();
      assert.equal(await page.locator('.hist-item').count(),2);
      // A second tab changes storage while this editor is open: the save must fail.
      await page.locator('[data-action="editHistory"]').first().click();
      await page.locator('#historyEditNotes').fill('Stale correction');
      const second=await context.newPage();await second.goto(base);
      await second.evaluate(()=>{const d=JSON.parse(localStorage.getItem('htData_v1'));d.sessions[0].notes='Newer tab record';localStorage.setItem('htData_v1',JSON.stringify(d));});
      await page.bringToFront();await page.locator('#historyEditSave').click();
      assert((await page.locator('#historyEditError').innerText()).includes('another tab'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('htData_v1')).sessions[0].notes),'Newer tab record');
      assert.deepEqual(errors,[]);
      console.log(name+': Phase 3 search, correction, validation, quota retry, persistence, PR recalculation, deletion/Undo, export/import and stale-tab editing passed');
      await context.close();
    }finally{await browser.close();}
  }
}finally{await new Promise(resolve=>server.close(resolve));}
