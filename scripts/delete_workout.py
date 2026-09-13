from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

marker = '/* DELETE WORKOUT FEATURE */'
if marker in s:
    raise SystemExit(0)

css = r'''
/* DELETE WORKOUT FEATURE */
.delete-workout-card{background:var(--surface);border:1px solid rgba(229,72,77,.28);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px}
.delete-workout-card h3{margin:0 0 4px;font-size:15px}
.delete-workout-card .delete-sub{font-size:12px;color:var(--text-dim);line-height:1.4;margin-bottom:12px}
.delete-workout-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line)}
.delete-workout-row:first-child{border-top:none}
.delete-workout-info{min-width:0}
.delete-workout-name{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.delete-workout-date{font-size:11px;color:var(--text-dim);margin-top:2px}
.delete-workout-btn{flex:0 0 auto;border:1px solid rgba(229,72,77,.45);background:transparent;color:var(--danger);border-radius:8px;padding:7px 10px;font-size:11px;font-weight:800}
'''

js = r'''
/* DELETE WORKOUT FEATURE */
(function(){
  function getData(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || DATA;}catch(e){return DATA;}
  }
  function saveData(data){
    try{localStorage.setItem(STORAGE_KEY, JSON.stringify(data));}catch(e){console.error('Could not save workout deletion',e);}
  }
  function sessionLabel(session){
    const name = session.name || session.workoutName || session.programName || session.dayName || 'Workout';
    let date = session.date || session.startedAt || session.createdAt || '';
    if(date){
      const d = new Date(date);
      if(!Number.isNaN(d.getTime())) date = d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
    }
    return {name,date:String(date || '')};
  }
  function deleteWorkout(index){
    const data = getData();
    if(!data || !Array.isArray(data.sessions) || !data.sessions[index]) return;
    const info = sessionLabel(data.sessions[index]);
    const ok = window.confirm(`Delete ${info.name}${info.date ? ' — '+info.date : ''}?\n\nThis removes the completed workout from History, Progress graphs, PR calculations and future coaching comparisons. Your programme and exercises will not be deleted.`);
    if(!ok) return;
    data.sessions.splice(index,1);
    saveData(data);
    location.reload();
  }
  window.deleteWorkoutFromHistory = deleteWorkout;

  function injectDeleteCard(){
    const content = document.getElementById('content');
    if(!content || content.querySelector('#deleteWorkoutCard')) return;
    const historyItems = content.querySelector('.hist-item');
    const activeHistory = document.querySelector('#navbar button[data-tab="history"].active');
    if(!activeHistory && !historyItems) return;

    const data = getData();
    const sessions = data && Array.isArray(data.sessions) ? data.sessions : [];
    const card = document.createElement('div');
    card.id = 'deleteWorkoutCard';
    card.className = 'delete-workout-card';
    const rows = sessions.map((session,index)=>({session,index, ...sessionLabel(session)})).sort((a,b)=>{
      const da = new Date(a.session.date || a.session.startedAt || a.session.createdAt || 0).getTime();
      const db = new Date(b.session.date || b.session.startedAt || b.session.createdAt || 0).getTime();
      return db-da;
    });
    card.innerHTML = `<h3>Manage completed workouts</h3><div class="delete-sub">Delete an individual workout if you logged it by mistake. This does not change your programme.</div>` +
      (rows.length ? rows.map(r=>`<div class="delete-workout-row"><div class="delete-workout-info"><div class="delete-workout-name">${escapeHtml(r.name)}</div><div class="delete-workout-date">${escapeHtml(r.date)}</div></div><button class="delete-workout-btn" data-delete-index="${r.index}">Delete</button></div>`).join('') : '<div class="empty">No completed workouts to delete.</div>');
    content.prepend(card);
    card.querySelectorAll('[data-delete-index]').forEach(btn=>btn.addEventListener('click',()=>deleteWorkout(Number(btn.dataset.deleteIndex))));
  }
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

  const observer = new MutationObserver(()=>setTimeout(injectDeleteCard,0));
  const content = document.getElementById('content');
  if(content) observer.observe(content,{childList:true,subtree:true});
  document.querySelectorAll('#navbar button[data-tab="history"]').forEach(btn=>btn.addEventListener('click',()=>setTimeout(injectDeleteCard,80)));
  setTimeout(injectDeleteCard,100);
})();
'''

if '</style>' not in s or '</script>' not in s:
    raise SystemExit('index.html anchors not found')
s = s.replace('</style>', css + '\n</style>', 1)
last_script = s.rfind('</script>')
s = s[:last_script] + '\n' + js + '\n' + s[last_script:]
p.write_text(s, encoding='utf-8')

# The repository is also configured with GitHub Pages' branch source.
# Commit the patched index so that the branch-based Pages deployment receives it.
import subprocess
subprocess.run(['git','config','user.name','github-actions[bot]'], check=True)
subprocess.run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git','add','index.html'], check=True)
subprocess.run(['git','commit','-m','Apply delete workout feature to live app'], check=True)
subprocess.run(['git','push'], check=True)
