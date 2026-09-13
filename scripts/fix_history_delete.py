from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')

# Replace the History card renderer with a real per-workout delete button.
old = '''function renderHistItem(s){
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
  </div>`;
}'''
new = '''function renderHistItem(s){
  return `<div class="hist-item">
    <div class="row" style="cursor:pointer;" data-action="viewSession" data-sid="${s.id}">
      <div class="dname">${escapeHtml(s.dayName)}</div>
      <div class="ddate">${fmtDate(s.date)}</div>
    </div>
    <div class="hist-meta">
      <span>${s.totalSets} sets</span>
      <span>${s.totalReps} reps</span>
      <span>${Math.round(s.totalVolume)} kg vol</span>
      ${s.newPRs && s.newPRs.length ? `<span class="pill pill-accent" style="padding:2px 8px;">${s.newPRs.length} PR${s.newPRs.length>1?'s':''}</span>`:''}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);">
      <button class="btn btn-danger-outline btn-sm" data-action="deleteWorkout" data-sid="${s.id}">Delete workout</button>
    </div>
  </div>`;
}'''
if old in s:
    s = s.replace(old, new, 1)
elif 'data-action="deleteWorkout" data-sid="${s.id}"' not in s:
    raise SystemExit('History renderer anchor not found')

# Add the delete action to the central event delegation.
anchor = "    }else if(action==='viewSession'){\n      el.onclick = ()=> openSessionDetail(el.dataset.sid);\n"
replacement = "    }else if(action==='viewSession'){\n      el.onclick = ()=> openSessionDetail(el.dataset.sid);\n    }else if(action==='deleteWorkout'){\n      el.onclick = (event)=>{\n        event.stopPropagation();\n        const sid = el.dataset.sid;\n        const session = DATA.sessions.find(s=>String(s.id)===String(sid));\n        if(!session) return;\n        const ok = confirm(`Delete ${session.dayName || 'this workout'} — ${fmtDate(session.date)}?\\n\\nThis removes the completed workout from History, Progress graphs, PR calculations and future coaching comparisons. Your programme and exercises will not be deleted.`);\n        if(!ok) return;\n        DATA.sessions = DATA.sessions.filter(s=>String(s.id)!==String(sid));\n        if(DATA.activeSession && String(DATA.activeSession.id)===String(sid)) DATA.activeSession = null;\n        save();\n        renderTab();\n      };\n"
if anchor in s:
    s = s.replace(anchor, replacement, 1)
elif "action==='deleteWorkout'" not in s:
    raise SystemExit('Event delegation anchor not found')

# Disable the old injection card; the History renderer above is now the source of truth.
old_marker = '/* DELETE WORKOUT FEATURE */\n(function(){'
start = s.find(old_marker, s.find('/* ============================= INIT ============================= */'))
if start != -1:
    end = s.find('\n})();', start)
    if end != -1:
        end += len('\n})();')
        s = s[:start] + '/* DELETE WORKOUT FEATURE — replaced by native History buttons */' + s[end:]

# Add styling for the native button once.
css = '.hist-item .btn-danger-outline{min-width:120px;}\n'
if css not in s:
    s = s.replace('</style>', css + '</style>', 1)

p.write_text(s, encoding='utf-8')
