from pathlib import Path
import re

p = Path('hypertrophy-trackernew.html')
s = p.read_text(encoding='utf-8')

old = """function getTodayProgramDay(){
  // Monday=0 ... Sunday=6 mapping to program index
  const jsDay = new Date().getDay(); // 0=Sun..6=Sat
  const idx = jsDay===0 ? 6 : jsDay-1; // Mon->0 ... Sun->6
  return idx;
}"""
new = """function getNextProgramIndex(){
  if(!DATA.sessions.length){
    const first = DATA.program.findIndex(d=>d.type==='training');
    return first>=0 ? first : 0;
  }
  const sessions = DATA.sessions.slice().sort((a,b)=>{
    const dc = String(a.date||'').localeCompare(String(b.date||''));
    if(dc!==0) return dc;
    return Number(a.startedAt||0)-Number(b.startedAt||0);
  });
  const last = sessions[sessions.length-1];
  const lastIdx = DATA.program.findIndex(d=>d.id===last.dayId);
  return lastIdx<0 ? 0 : (lastIdx+1)%DATA.program.length;
}
function getTodayProgramDay(){ return getNextProgramIndex(); }"""
if old in s:
    s = s.replace(old, new, 1)

s = s.replace('const todayIdx = getTodayProgramDay();', 'const todayIdx = getNextProgramIndex();')
s = s.replace('DAY ${todayIdx+1} · REST', '${todayIdx+1}. REST DAY')
s = s.replace('NEXT WORKOUT · DAY ${todayIdx+1}', 'NEXT WORKOUT · ${todayIdx+1}')
s = s.replace('Day ${activeDayIdx+1} — ${escapeHtml(day.name)}', '${activeDayIdx+1}. ${escapeHtml(day.name)}')
s = s.replace('Day ${i+1} — ${escapeHtml(d.name)}', '${i+1}. ${escapeHtml(d.name)}')
s = s.replace("This week's split", 'Workout sequence')
s = s.replace('<label>Choose day</label>', '<label>Choose workout</label>')
s = s.replace('Log a workout anyway', 'Log Rest Day')

if 'data-action="startRestDay"' not in s:
    s = s.replace('data-action="gotoTrain">Log Rest Day', 'data-action="startRestDay">Log Rest Day')
if "action==='startRestDay'" not in s:
    s = s.replace("}else if(action==='gotoTrain'){", "}else if(action==='startRestDay'){\n      el.onclick = ()=> startRestDay();\n    }else if(action==='gotoTrain'){")
if 'function startRestDay()' not in s:
    s = s.replace('function startSession(dayIdx){', "function startRestDay(){\n  const restIdx = DATA.program.findIndex(d=>d.type==='rest');\n  if(restIdx>=0) startSession(restIdx);\n}\n\nfunction startSession(dayIdx){", 1)

coach_fn = r'''function computeRecommendation(exDef, lastLog){
  const phase = (typeof getPhase === 'function' && typeof getWeekNumber === 'function') ? getPhase(getWeekNumber()) : null;
  const phaseName = phase && phase.name ? phase.name : 'Hypertrophy';
  const setsPlanned = Math.max(1, Number(exDef.sets||1));
  const isIsolation = exDef.cat === 'isolation';
  const rir = phaseName === 'Deload' ? 3 : (isIsolation ? (phaseName === 'Peak' ? 0 : 1) : (phaseName === 'Calibration' ? 2 : 1));

  if(!lastLog || !lastLog.sets || !lastLog.sets.length){
    return {type:'first',nextWeight:null,targetReps:`${exDef.repMin}–${exDef.repMax}`,
      sets:phaseName==='Deload'?Math.max(1,Math.ceil(setsPlanned*.5)):setsPlanned,
      text:`Start with a weight you can do for ${exDef.repMin}–${exDef.repMax} reps with about ${rir} RIR.`,
      detail:`AI Coach target: ${phaseName} · ${rir} RIR · ${setsPlanned} planned sets. Add reps before load.`};
  }
  const completed = lastLog.sets.filter(s=>s.completed && Number(s.weight)>0 && Number(s.reps)>0);
  if(!completed.length){
    return {type:'first',nextWeight:null,targetReps:`${exDef.repMin}–${exDef.repMax}`,sets:setsPlanned,
      text:`Use a conservative starting weight and aim for ${exDef.repMin}–${exDef.repMax} reps with about ${rir} RIR.`,
      detail:`No usable previous set was recorded. ${phaseName} phase.`};
  }
  const avgReps = completed.reduce((a,s)=>a+Number(s.reps),0)/completed.length;
  const avgWeight = completed.reduce((a,s)=>a+Number(s.weight),0)/completed.length;
  const increment = Math.max(Number(exDef.inc||0),0.5);
  let nextWeight=avgWeight, type='reps', text;
  if(avgReps >= exDef.repMax){
    nextWeight=avgWeight+increment; type='up';
    text=`Increase to about ${nextWeight} kg and aim for ${exDef.repMin}–${exDef.repMax} reps.`;
  }else if(avgReps < exDef.repMin){
    nextWeight=Math.max(increment,avgWeight-increment); type='down';
    text=`Drop to about ${nextWeight} kg and rebuild into the ${exDef.repMin}–${exDef.repMax} range.`;
  }else{
    text=`Keep about ${avgWeight} kg and beat last time by 1–2 total reps before adding load.`;
  }
  const targetSets=phaseName==='Deload'?Math.max(1,Math.ceil(setsPlanned*.5)):setsPlanned;
  const rirText=rir===0?'0 RIR on the final isolation set':`${rir} RIR`;
  return {type,nextWeight,targetReps:`${exDef.repMin}–${exDef.repMax}`,sets:targetSets,text,
    detail:`AI Coach: ${targetSets} sets · ${exDef.repMin}–${exDef.repMax} reps · ${rirText}. Previous average: ${avgWeight.toFixed(1)} kg × ${avgReps.toFixed(1)} reps.`};
}

'''
pattern = r'function computeRecommendation\(exDef, lastLog\)\{.*?\n\}\n\nfunction renderExerciseBlock'
s, n = re.subn(pattern, coach_fn+'function renderExerciseBlock', s, count=1, flags=re.S)
if n != 1:
    raise RuntimeError('Could not locate recommendation engine')

s = s.replace("<div class=\"coach-title\">Today's advice</div>", "<div class=\"coach-title\">AI HYPERTROPHY COACH</div>", 1)
s = s.replace("<div class=\"coach-detail\">${escapeHtml(rec.detail||'')} ${escapeHtml(previous)}</div>", "<div class=\"coach-detail\">${escapeHtml(rec.detail||'')} · ${rec.sets||ex.sets} sets · Target ${escapeHtml(rec.targetReps||`${ex.repMin}–${ex.repMax}`)} reps ${escapeHtml(previous)}</div>", 1)

# Rest days get their own recovery screen rather than a fake workout with set/rep rows.
rest_patch = r'''
// Dedicated rest-day UI. The underlying session completion remains the same, so
// rest days still advance the sequence and appear in history without exercise data.
s += r'''
<style>
.rest-day-card{background:linear-gradient(155deg,#202a2a,#1a2023);border:1px solid var(--line);border-radius:16px;padding:28px 20px;text-align:center;margin:8px 0 14px;}
.rest-day-icon{font-size:54px;line-height:1;margin-bottom:14px;}
.rest-day-card h2{font-size:28px;margin:0 0 8px;letter-spacing:-.5px;}
.rest-day-card p{color:var(--text-dim);font-size:14px;line-height:1.5;margin:0 auto 20px;max-width:330px;}
.rest-day-meta{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;}
.rest-day-meta span{background:var(--surface-3);color:var(--text-dim);padding:7px 10px;border-radius:99px;font-size:12px;font-weight:700;}
</style>
'''

rest_patch += r'''
const _originalStartRestDay = typeof startRestDay === 'function' ? startRestDay : null;
function startRestDay(){
  const restIdx = DATA.program.findIndex(d=>d.type==='rest');
  if(restIdx<0) return;
  // Let the existing session machinery initialise the session/sequence state.
  startSession(restIdx);
  setTimeout(()=>{
    const content = document.getElementById('content');
    if(!content) return;
    content.innerHTML = `
      <div class="rest-day-card">
        <div class="rest-day-icon">😴</div>
        <h2>Rest Day</h2>
        <p>No sets. No reps. No workout. Recover, eat well, sleep and come back stronger.</p>
        <div class="rest-day-meta">
          <span>Recovery</span><span>Muscle growth</span><span>Next session: Lower B</span>
        </div>
        <button class="btn btn-primary" id="completeRestDayBtn">Log Rest Day</button>
      </div>
      <div class="card card-tight">
        <div class="row"><strong>Optional recovery</strong><span class="pill pill-teal">Easy</span></div>
        <div style="color:var(--text-dim);font-size:13px;line-height:1.5;margin-top:8px;">Light walking, mobility or easy cardio is fine if you want it. Nothing needs to be logged as a set.</div>
      </div>`;
    document.getElementById('completeRestDayBtn')?.addEventListener('click',()=>{
      // Re-render the underlying rest session and use its existing completion path.
      startSession(restIdx);
      setTimeout(()=>{
        const primary = Array.from(document.querySelectorAll('button.btn-primary'))
          .find(b=>/finish|complete|log rest|save/i.test((b.textContent||'').trim()));
        if(primary) primary.click();
      },50);
    });
  },50);
}
'''

# Insert the rest-day override just before the final page writes.
marker = "Path('index.html').write_text(s, encoding='utf-8')"
if marker not in s:
    raise RuntimeError('Could not find final page write')
s = s.replace(marker, rest_patch + "\n" + marker, 1)

Path('index.html').write_text(s, encoding='utf-8')
p.write_text(s, encoding='utf-8')
print('Prepared Pages build with adaptive hypertrophy coaching and dedicated rest-day UI')
