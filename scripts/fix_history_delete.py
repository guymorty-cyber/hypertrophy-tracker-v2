from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Keep the native per-workout delete button if the renderer is present.
# Also add a robust, visible management section after History cards. This is
# deliberately independent of the app's tab implementation so it survives
# re-renders and works on iPhone Safari.
old_css = '.hist-item .btn-danger-outline{min-width:120px;}\n'
css = '''
.hist-item .btn-danger-outline{min-width:120px;}
.history-delete-section{background:var(--surface);border:1px solid rgba(229,72,77,.38);border-radius:var(--radius);padding:16px;margin:16px 0 24px;}
.history-delete-section h3{margin:0 0 5px;font-size:16px;font-weight:800;color:var(--text);}
.history-delete-section .hds-sub{font-size:12px;color:var(--text-dim);line-height:1.4;margin-bottom:12px;}
.history-delete-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line);}
.history-delete-info{min-width:0;}
.history-delete-name{font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.history-delete-date{font-size:11px;color:var(--text-dim);margin-top:2px;}
.history-delete-btn{flex:0 0 auto;background:transparent;color:var(--danger);border:1px solid rgba(229,72,77,.5);border-radius:9px;padding:9px 12px;font-size:12px;font-weight:800;}
'''
if old_css in s:
    s = s.replace(old_css, css, 1)
elif '.history-delete-section' not in s:
    if '</style>' not in s:
        raise SystemExit('style anchor not found')
    s = s.replace('</style>', css + '</style>', 1)

js = r'''
/* HISTORY DELETE VISIBILITY FIX */
(function(){
  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function label(s){
    const name=s.dayName||s.name||s.workoutName||s.programName||'Workout';
    let date=s.date||s.startedAt||s.createdAt||'';
    if(date){const d=new Date(date);if(!Number.isNaN(d.getTime())) date=d.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});}
    return {name:String(name),date:String(date||'')};
  }
  function removeSession(sid){
    const session=(DATA.sessions||[]).find(x=>String(x.id)===String(sid));
    if(!session)return;
    const x=label(session);
    if(!window.confirm(`Delete ${x.name}${x.date?' — '+x.date:''}?\n\nThis removes the completed workout from History, Progress graphs, PR calculations and future coaching comparisons. Your programme and exercises will not be deleted.`))return;
    DATA.sessions=DATA.sessions.filter(x=>String(x.id)!==String(sid));
    if(DATA.activeSession&&String(DATA.activeSession.id)===String(sid))DATA.activeSession=null;
    if(typeof save==='function')save();
    if(typeof renderTab==='function')renderTab();
    setTimeout(install,50);
  }
  function install(){
    const content=document.getElementById('content');
    if(!content)return;
    const items=content.querySelectorAll('.hist-item');
    if(!items.length){const old=content.querySelector('.history-delete-section');if(old)old.remove();return;}
    if(content.querySelector('.history-delete-section'))return;
    const section=document.createElement('section');
    section.className='history-delete-section';
    const sessions=Array.isArray(DATA.sessions)?DATA.sessions.slice():[];
    sessions.sort((a,b)=>new Date(b.date||b.startedAt||b.createdAt||0)-new Date(a.date||a.startedAt||a.createdAt||0));
    section.innerHTML='<h3>Delete completed workouts</h3><div class="hds-sub">Remove an individual workout from your history. This will also remove it from progression, PR calculations and future coaching comparisons.</div>'+
      (sessions.length?sessions.map(s=>{const x=label(s);return `<div class="history-delete-row"><div class="history-delete-info"><div class="history-delete-name">${esc(x.name)}</div><div class="history-delete-date">${esc(x.date)}</div></div><button type="button" class="history-delete-btn" data-history-delete="${esc(s.id)}">Delete</button></div>`;}).join(''):'<div class="hds-sub">No completed workouts.</div>');
    items[items.length-1].insertAdjacentElement('afterend',section);
    section.addEventListener('click',e=>{const b=e.target.closest('[data-history-delete]');if(b){e.preventDefault();e.stopPropagation();removeSession(b.dataset.historyDelete);}});
  }
  const content=document.getElementById('content');
  if(content){
    const observer=new MutationObserver(()=>{setTimeout(install,0);});
    observer.observe(content,{childList:true,subtree:true});
  }
  setTimeout(install,100);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(install,100);});
})();
'''

# Remove any previous visibility-fix block before adding the corrected one.
marker='/* HISTORY DELETE VISIBILITY FIX */'
if marker in s:
    first=s.find(marker)
    end=s.find('\n})();',first)
    if end!=-1:
        s=s[:first]+s[end+len('\n})();'):]

last=s.rfind('</script>')
if last==-1: raise SystemExit('script anchor not found')
s=s[:last]+'\n'+js+'\n'+s[last:]
p.write_text(s,encoding='utf-8')
