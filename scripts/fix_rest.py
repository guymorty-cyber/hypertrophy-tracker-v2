from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old_render = '''function renderTrain(){
  if(DATA.activeSession){
    return renderActiveSession();
  }
  const todayIdx = getNextProgramIndex();'''
new_render = '''function renderTrain(){
  if(DATA.activeSession){
    return renderActiveSession();
  }
  if(DATA.restDayOpen){
    return renderRestDayScreen();
  }
  const todayIdx = getNextProgramIndex();'''
if old_render in s:
    s = s.replace(old_render, new_render, 1)

old_button = '''<button class="btn btn-primary" data-action="startPicked">Start Workout</button>'''
new_button = '''<button class="btn btn-primary" data-action="startPicked">${DATA.program[todayIdx] && DATA.program[todayIdx].type==='rest' ? 'Open Rest Day' : 'Start Workout'}</button>'''
if old_button in s:
    s = s.replace(old_button, new_button, 1)

old_handler = '''}else if(action==='startPicked'){
      el.onclick = ()=>{ const idx = parseInt(document.getElementById('dayPicker').value); startSession(idx); };'''
new_handler = '''}else if(action==='startPicked'){
      el.onclick = ()=>{
        const idx = parseInt(document.getElementById('dayPicker').value);
        const day = DATA.program[idx];
        if(day && day.type==='rest') startRestDay();
        else startSession(idx);
      };'''
if old_handler in s:
    s = s.replace(old_handler, new_handler, 1)

old_rest = '''function startRestDay(){
  const restIdx = DATA.program.findIndex(d=>d.type==='rest');
  if(restIdx>=0) startSession(restIdx);
}'''
new_rest = '''function startRestDay(){
  const restIdx = DATA.program.findIndex(d=>d.type==='rest');
  if(restIdx<0) return;
  DATA.restDayOpen = true;
  DATA.activeSession = null;
  save();
  setTab('train');
}

function renderRestDayScreen(){
  return `
    <div class="card" style="text-align:center;padding:30px 20px;background:linear-gradient(155deg,#202a2a,#1a2023);">
      <div style="font-size:54px;line-height:1;margin-bottom:14px;">😴</div>
      <div style="font-size:12px;color:var(--teal);font-weight:900;letter-spacing:.7px;">RECOVERY</div>
      <h2 style="font-size:28px;margin:5px 0 8px;">REST DAY</h2>
      <p style="color:var(--text-dim);font-size:14px;line-height:1.5;margin:0 auto 20px;max-width:330px;">No sets. No reps. No workout. Recover, eat well, sleep and come back stronger.</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;">
        <span class="pill pill-dim">Recovery</span><span class="pill pill-dim">Muscle growth</span><span class="pill pill-dim">No training</span>
      </div>
      <button class="btn btn-primary" data-action="logRestDay">Log Rest Day</button>
    </div>
    <div class="card card-tight">
      <div class="row"><strong>Optional recovery</strong><span class="pill pill-teal">Easy</span></div>
      <div style="color:var(--text-dim);font-size:13px;line-height:1.5;margin-top:8px;">Light walking, mobility or easy cardio is fine. Nothing needs to be logged as a set.</div>
    </div>`;
}

function logRestDay(){
  const restDay = DATA.program.find(d=>d.type==='rest');
  if(!restDay) return;
  DATA.sessions.push({
    id:'sess_'+Date.now(),
    date:todayISO(),
    startedAt:Date.now(),
    finishedAt:Date.now(),
    dayId:restDay.id,
    dayName:restDay.name,
    weekNumber:getWeekNumber(),
    phase:getPhase(getWeekNumber()).name,
    exercises:[],
    kneePain:{before:null,after:null,nextMorning:null},
    notes:'Rest day'
  });
  DATA.restDayOpen = false;
  save();
  setTab('home');
}'''
if old_rest in s:
    s = s.replace(old_rest, new_rest, 1)

old_event = '''}else if(action==='startRestDay'){
      el.onclick = ()=> startRestDay();'''
new_event = '''}else if(action==='startRestDay'){
      el.onclick = ()=> startRestDay();
    }else if(action==='logRestDay'){
      el.onclick = ()=> logRestDay();'''
if old_event in s:
    s = s.replace(old_event, new_event, 1)

# Remove the old appended DOM patch if it exists; source-level logic above is now authoritative.
marker = '<script>\n(function(){\n  function wireRestPicker()'
idx = s.find(marker)
if idx != -1:
    end = s.find('</script>', idx)
    if end != -1:
        end += len('</script>')
        s = s[:idx] + s[end:]

p.write_text(s, encoding='utf-8')
print('Applied source-level rest-day fix')
