from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# The app declares DATA with `let`, so it is not exposed as window.DATA.
# Use the actual global lexical binding instead.
s = s.replace('data-action="startPicked">Start Workout', 'id="startPickedBtn" data-action="startPicked">Start Workout')

patch = r'''<script>
(function(){
  function wireRestPicker(){
    const picker=document.getElementById('dayPicker');
    const btn=document.getElementById('startPickedBtn');
    if(!picker || !btn) return;
    const sync=function(){
      const idx=parseInt(picker.value,10);
      if(typeof DATA==='undefined' || !DATA.program) return;
      const day=DATA.program[idx];
      const rest=!!day && day.type==='rest';
      btn.textContent=rest?'Open Rest Day':'Start Workout';
      btn.onclick=function(){
        if(rest && typeof startRestDay==='function') startRestDay();
        else if(typeof startSession==='function') startSession(idx);
      };
    };
    sync();
    picker.onchange=sync;
  }

  function wireTodayButton(){
    if(typeof DATA==='undefined' || typeof getNextProgramIndex!=='function') return;
    const btn=document.querySelector('[data-action="startToday"]');
    if(!btn) return;
    const idx=getNextProgramIndex();
    const day=DATA.program[idx];
    if(day && day.type==='rest'){
      btn.textContent='Open Rest Day';
      btn.onclick=function(){ if(typeof startRestDay==='function') startRestDay(); };
    }
  }

  function installRestScreen(){
    if(typeof startRestDay!=='function' || window.__restDayFixed) return;
    const original=startRestDay;
    window.__restDayFixed=true;
    window.startRestDay=function(){
      const restIdx=DATA.program.findIndex(d=>d.type==='rest');
      if(restIdx<0) return;
      original();
      const content=document.getElementById('content');
      if(!content) return;
      setTimeout(function(){
        content.innerHTML=`
          <div class="card" style="text-align:center;padding:30px 20px;background:linear-gradient(155deg,#202a2a,#1a2023);">
            <div style="font-size:54px;line-height:1;margin-bottom:14px;">😴</div>
            <div style="font-size:12px;color:var(--teal);font-weight:900;letter-spacing:.7px;">RECOVERY</div>
            <h2 style="font-size:28px;margin:5px 0 8px;">REST DAY</h2>
            <p style="color:var(--text-dim);font-size:14px;line-height:1.5;margin:0 auto 20px;max-width:330px;">No sets. No reps. No workout. Recover, eat well, sleep and come back stronger.</p>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;">
              <span class="pill pill-dim">Recovery</span><span class="pill pill-dim">Muscle growth</span><span class="pill pill-dim">No training</span>
            </div>
            <button class="btn btn-primary" id="fixedLogRest">Log Rest Day</button>
          </div>
          <div class="card card-tight">
            <div class="row"><strong>Optional recovery</strong><span class="pill pill-teal">Easy</span></div>
            <div style="color:var(--text-dim);font-size:13px;line-height:1.5;margin-top:8px;">Light walking, mobility or easy cardio is fine. Nothing needs to be logged as a set.</div>
          </div>`;
        document.getElementById('fixedLogRest').onclick=function(){
          save();
          setTab('home');
        };
      },0);
    };
  }

  function run(){ wireRestPicker(); wireTodayButton(); installRestScreen(); }
  run();
  new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
})();
</script>'''

s = s.replace('</body>', patch + '\n</body>', 1)
p.write_text(s, encoding='utf-8')
print('Applied rest-day picker scope fix')
