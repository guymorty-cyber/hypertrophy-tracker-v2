from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Make deletion visible as part of every native History card rather than a separate injected section.
css = '''
/* HISTORY DELETE BUTTON */
.hist-item .history-delete-wrap{display:flex;justify-content:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);}
.hist-item .history-delete-btn{background:transparent;color:var(--danger);border:1px solid rgba(229,72,77,.55);border-radius:9px;padding:9px 13px;font-size:12px;font-weight:800;}
.hist-item .history-delete-btn:active{opacity:.7;}
'''
if '/* HISTORY DELETE BUTTON */' not in s:
    s=s.replace('</style>',css+'\n</style>',1)

# Replace the actual History card renderer. This is the renderer used by renderHistory(),
# so the button cannot be lost when the History tab re-renders.
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
s2,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'Could not locate native renderHistItem (matches={n})')
s=s2

# Add a native delegated action beside viewSession. Stop propagation so pressing Delete
# never opens the workout detail card.
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
        const ok = window.confirm(`Delete ${session.dayName || 'workout'}${dateText ? ' — '+dateText : ''}?\\n\\nThis removes the completed workout from History, Progress graphs, PR calculations and future coaching comparisons. Your programme and exercises will not be deleted.`);
        if(!ok) return;
        DATA.sessions = DATA.sessions.filter(s=>String(s.id)!==String(sid));
        if(DATA.activeSession && String(DATA.activeSession.id)===String(sid)) DATA.activeSession=null;
        save();
        renderTab();
      };
    }"""
if needle not in s:
    raise SystemExit('Could not locate viewSession action handler')
s=s.replace(needle,insert,1)

# Remove the old visibility/injection implementation if an earlier deployment patch
# is present. The native renderer above is now the single source of truth.
start=s.find('/* HISTORY DELETE VISIBILITY FIX */')
if start!=-1:
    end=s.find('\n})();',start)
    if end!=-1:
        s=s[:start]+s[end+len('\n})();'):]

p.write_text(s,encoding='utf-8')
