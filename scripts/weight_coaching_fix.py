from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

marker = '/* EXPLICIT WEIGHT COACHING FIX */'
if marker in s:
    print('Weight coaching fix already applied')
    raise SystemExit(0)

patch = r'''/* EXPLICIT WEIGHT COACHING FIX */
(function(){
  const originalComputeRecommendation = window.computeRecommendation || computeRecommendation;
  window.computeRecommendation = function(exDef, lastLog){
    const rec = originalComputeRecommendation(exDef, lastLog);
    if(!rec) return rec;

    // Make the actionable prescription impossible to miss: weight + reps together.
    if(rec.nextWeight !== null && rec.nextWeight !== undefined && Number(rec.nextWeight) > 0){
      const weight = Number(rec.nextWeight);
      const reps = rec.targetReps || `${exDef.repMin}–${exDef.repMax}`;
      if(rec.type === 'up'){
        rec.text = `TODAY: ${weight} KG × ${reps} REPS`;
      }else if(rec.type === 'down'){
        rec.text = `TODAY: ${weight} KG × ${reps} REPS`;
      }else if(rec.type === 'maintain'){
        rec.text = `TODAY: ${weight} KG × ${reps} REPS — HOLD WEIGHT`;
      }else{
        rec.text = `TODAY: ${weight} KG × ${reps} REPS — BEAT YOUR REPS`;
      }
      rec.detail = `Use ${weight}kg for your working sets. Aim for ${reps} reps. ${rec.detail || ''}`.trim();
    }else{
      rec.text = `TODAY: CHOOSE A WEIGHT × ${rec.targetReps || `${exDef.repMin}–${exDef.repMax}`} REPS`;
      rec.detail = `Choose a load that lets you achieve the target reps with good technique. ${rec.detail || ''}`.trim();
    }
    return rec;
  };

  // Stronger visual hierarchy for the actual prescription.
  const css = document.createElement('style');
  css.textContent = `
    .reco-coach .coach-main{font-size:20px;font-weight:900;line-height:1.25;}
    .reco-coach .coach-detail{font-size:12.5px;line-height:1.45;}
  `;
  document.head.appendChild(css);
})();
'''

# Put the override immediately before the final script tag so the app uses it
# after all original functions have been declared.
pos = s.rfind('</script>')
if pos == -1:
    raise SystemExit('No closing script tag found')
s = s[:pos] + '\n' + patch + '\n' + s[pos:]
p.write_text(s, encoding='utf-8')
