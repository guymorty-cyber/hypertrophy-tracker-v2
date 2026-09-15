from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Directly own the History card renderer. Each completed workout gets a real button.
if '/* HISTORY DELETE BUTTON */' not in s:
    s=s.replace('</style>','''
/* HISTORY DELETE BUTTON */
.hist-item .history-delete-wrap{display:flex;justify-content:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);}
.hist-item .history-delete-btn{background:transparent;color:var(--danger);border:1px solid rgba(229,72,77,.55);border-radius:9px;padding:9px 13px;font-size:12px;font-weight:800;cursor:pointer;}
.hist-item .history-delete-btn:active{opacity:.7;}
'''+ '\n</style>',1)

pattern=r"function renderHistItem\(s\)\{.*?\n\}"
replacement='''function renderHistItem(s){
  return `<div class="hist-item" data-action="viewSession" data-sid="${s.id}">
    <div class="row">
      <div class="dname">${escapeHtml(s.dayName)}</div>
      <div class="ddate">${fmtDate(s.date)}</div>
    </div>
    <div class="hist-meta">
      <span>${s.totalSets} sets</span>
      <span>${s.totalReps} reps</span>
      <span>${Math.round(s.totalVolume)} kg vol</span>
      ${s.newPRs && s.newPRs.length ? `<span class="pill pill-accent" style="padding:2px 8px;">${s.newPRs.length} PR${s.newPRs.length>1?'s':''}</span>`:''}
    </div>
    <div class="history-delete-wrap">
      <button type="button" class="history-delete-btn" data-action="deleteWorkout" data-sid="${s.id}">Delete workout</button>
    </div>
  </div>`;
}'''
s,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'History renderer not found: {n}')

needle="""    }else if(action==='viewSession'){
      el.onclick = ()=> openSessionDetail(el.dataset.sid);
    }"""
insert="""    }else if(action==='viewSession'){
      el.onclick = ()=> openSessionDetail(el.dataset.sid);
    }else if(action==='deleteWorkout'){
      el.onclick = (event)=>{
        event.stopPropagation();
        const sid = el.dataset.sid;
        const session = DATA.sessions.find(s=>String(s.id)===String(sid));
        if(!session) return;
        const dateText = session.date ? fmtDate(session.date) : '';
        if(!window.confirm(`Delete ${session.dayName || 'workout'}${dateText ? ' — '+dateText : ''}?\\n\\nThis removes the completed workout from History, Progress graphs, PR calculations and future coaching comparisons. Your programme and exercises will not be deleted.`)) return;
        DATA.sessions = DATA.sessions.filter(s=>String(s.id)!==String(sid));
        if(DATA.activeSession && String(DATA.activeSession.id)===String(sid)) DATA.activeSession=null;
        save();
        renderTab();
      };
    }"""
if needle not in s:
    raise SystemExit('History action handler not found')
s=s.replace(needle,insert,1)

# Visible build marker: guarantees a fresh source change and makes cache state diagnosable.
marker='<!-- HISTORY DELETE BUILD 2026-09-15 -->'
if marker not in s:
    s=s.replace('</head>',marker+'\n</head>',1)

p.write_text(s,encoding='utf-8')
