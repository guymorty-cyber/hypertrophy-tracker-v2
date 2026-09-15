from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

css = '''
/* HISTORY DELETE VISIBILITY */
.history-delete-section{background:var(--surface);border:1px solid rgba(229,72,77,.5);border-radius:var(--radius);padding:16px;margin:16px 0 24px;}
.history-delete-section h3{margin:0 0 5px;font-size:16px;font-weight:800;color:var(--text);}
.history-delete-section .hds-sub{font-size:12px;color:var(--text-dim);line-height:1.4;margin-bottom:12px;}
.history-delete-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line);}
.history-delete-info{min-width:0;}
.history-delete-name{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.history-delete-date{font-size:11px;color:var(--text-dim);margin-top:2px;}
.history-delete-btn{flex:0 0 auto;background:transparent;color:var(--danger);border:1px solid rgba(229,72,77,.55);border-radius:9px;padding:10px 14px;font-size:12px;font-weight:800;}
'''
# Replace the previous CSS block if present; otherwise add it.
start=s.find('/* HISTORY DELETE VISIBILITY */')
if start!=-1:
    end=s.find('*/',start)+2
    # CSS block has multiple rules, so use the known section boundary if possible.
    end2=s.find('\n.hist-item .btn-danger-outline',start)
    if end2==-1: end2=s.find('\n/*',end)
    if end2==-1: end2=end
    # Safer: remove through the closing rule of history-delete-btn.
    marker='.history-delete-btn{'
    m=s.find(marker,start)
    if m!=-1:
        close=s.find('}\n',m)+2
        s=s[:start]+s[close:]
if '</style>' not in s: raise SystemExit('style anchor not found')
s=s.replace('</style>',css+'\n</style>',1)

js=r'''
/* HISTORY DELETE VISIBILITY FIX */
(function(){
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function label(s){
    const name=s.dayName||s.name||s.workoutName||s.programName||'Workout';
    let date=s.date||s.startedAt||s.createdAt||'';
    if(date){const d=new Date(date);if(!Number.isNaN(d.getTime()))date=d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}
    return {name:String(name),date:String(date||'')};
  }
  function isHistory(){
    const active=document.querySelector('#navbar button.active');
    if(active && /history/i.test(active.textContent||'')) return true;
    const buttons=document.querySelectorAll('#navbar button');
    for(const b of buttons){if(/history/i.test(b.textContent||'') && (b.getAttribute('aria-current')==='page'||b.classList.contains('selected')))return true;}
    return false;
  }
  function removeSession(sid){
    const sessions=Array.isArray(DATA.sessions)?DATA.sessions:[];
    const session=sessions.find(x=>String(x.id)===String(sid));
    if(!session)return;
    const x=label(session);
    if(!window.confirm(`Delete ${x.name}${x.date?' — '+x.date:''}?\n\nThis removes the completed workout from History, Progress graphs, PR calculations and future coaching comparisons. Your programme and exercises will not be deleted.`))return;
    DATA.sessions=sessions.filter(x=>String(x.id)!==String(sid));
    if(DATA.activeSession&&String(DATA.activeSession.id)===String(sid))DATA.activeSession=null;
    if(typeof save==='function')save();
    if(typeof renderTab==='function')renderTab();
    setTimeout(install,100);
  }
  function install(){
    const content=document.getElementById('content');
    if(!content || !isHistory())return;
    let section=content.querySelector('.history-delete-section');
    if(section)section.remove();
    section=document.createElement('section');
    section.className='history-delete-section';
    const sessions=Array.isArray(DATA.sessions)?DATA.sessions.slice():[];
    sessions.sort((a,b)=>new Date(b.date||b.startedAt||b.createdAt||0)-new Date(a.date||a.startedAt||a.createdAt||0));
    section.innerHTML='<h3>Delete completed workouts</h3><div class="hds-sub">Remove an individual workout from your history. This also removes it from progression, PR calculations and future coaching comparisons.</div>'+
      (sessions.length?sessions.map(s=>{const x=label(s);return `<div class="history-delete-row"><div class="history-delete-info"><div class="history-delete-name">${esc(x.name)}</div><div class="history-delete-date">${esc(x.date)}</div></div><button type="button" class="history-delete-btn" data-history-delete="${esc(s.id)}">Delete</button></div>`;}).join(''):'<div class="hds-sub">No completed workouts.</div>');
    content.appendChild(section);
    section.addEventListener('click',e=>{const b=e.target.closest('[data-history-delete]');if(b){e.preventDefault();e.stopPropagation();removeSession(b.dataset.historyDelete);}});
  }
  function schedule(){setTimeout(install,50);setTimeout(install,250);setTimeout(install,700);}
  document.addEventListener('click',e=>{const b=e.target.closest('#navbar button');if(b&&/history/i.test(b.textContent||''))schedule();});
  const content=document.getElementById('content');
  if(content){const observer=new MutationObserver(()=>{if(isHistory())schedule();});observer.observe(content,{childList:true,subtree:true});}
  schedule();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
})();
'''
# Remove previous JS block if present.
marker='/* HISTORY DELETE VISIBILITY FIX */'
while marker in s:
    first=s.find(marker)
    end=s.find('\n})();',first)
    if end==-1: break
    s=s[:first]+s[end+len('\n})();'):]
last=s.rfind('</script>')
if last==-1: raise SystemExit('script anchor not found')
s=s[:last]+'\n'+js+'\n'+s[last:]
p.write_text(s,encoding='utf-8')
