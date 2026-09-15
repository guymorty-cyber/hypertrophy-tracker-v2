from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

marker = '/* EXPLICIT WEIGHT COACHING FIX */'
if marker in s:
    # Replace the existing fix with the stronger progressive-overload presentation.
    start = s.find(marker)
    end = s.find('})();', start)
    if start == -1 or end == -1:
        raise SystemExit('Existing weight coaching fix could not be located')
    end += len('})();')
    s = s[:start] + s[end:]

patch = r'''/* EXPLICIT WEIGHT COACHING FIX */
(function(){
  const originalComputeRecommendation = window.computeRecommendation || computeRecommendation;
  window.computeRecommendation = function(exDef, lastLog){
    const rec = originalComputeRecommendation(exDef, lastLog);
    if(!rec) return rec;

    // The coach must always answer the two progressive-overload questions:
    // 1) What did I do last time?
    // 2) What exactly should I do today?
    const completed = lastLog && lastLog.sets ? lastLog.sets.filter(s =>
      s.completed && Number(s.weight) > 0 && Number(s.reps) > 0
    ) : [];

    if(completed.length){
      const lastPerformance = completed.map(s => `${Number(s.weight)}kg × ${Number(s.reps)}`).join('  |  ');
      const lastWeight = Number(completed[0].weight);
      const lastReps = completed.map(s => Number(s.reps));
      const lastTotal = lastReps.reduce((a,b)=>a+b,0);
      const recommendedWeight = rec.nextWeight !== null && rec.nextWeight !== undefined
        ? Number(rec.nextWeight)
        : lastWeight;
      const targetReps = rec.targetReps || `${exDef.repMin}–${exDef.repMax}`;

      if(rec.nextWeight !== null && rec.nextWeight !== undefined && Number(rec.nextWeight) > 0){
        if(rec.type === 'maintain'){
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — HOLD WEIGHT`;
        }else if(rec.type === 'up'){
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — INCREASE LOAD`;
        }else if(rec.type === 'down'){
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — REDUCE LOAD`;
        }else{
          rec.text = `TODAY: ${recommendedWeight} KG × ${targetReps} REPS — BEAT LAST TIME`;
        }
      }else{
        rec.text = `TODAY: ${lastWeight} KG × ${targetReps} REPS — BEAT LAST TIME`;
      }

      rec.detail = `LAST TIME: ${lastPerformance} (${lastTotal} total reps).  TODAY: ${recommendedWeight} KG × ${targetReps} REPS. ${rec.detail || ''}`.trim();
    }else{
      rec.text = `TODAY: CHOOSE A WEIGHT × ${rec.targetReps || `${exDef.repMin}–${exDef.repMax}`} REPS`;
      rec.detail = `No completed previous working sets are available. Choose a load that allows the target reps with good technique. ${rec.detail || ''}`.trim();
    }
    return rec;
  };

  const css = document.createElement('style');
  css.textContent = `
    .reco-coach .coach-main{font-size:20px;font-weight:900;line-height:1.25;}
    .reco-coach .coach-detail{font-size:12.5px;line-height:1.5;}
  `;
  document.head.appendChild(css);
})();
'''

pos = s.rfind('</script>')
if pos == -1:
    raise SystemExit('No closing script tag found')
s = s[:pos] + '\n' + patch + '\n' + s[pos:]
p.write_text(s, encoding='utf-8')
