/* ---------- MORE ---------- */
function renderMore(){
  const bw = DATA.bodyweight.slice().sort((a,b)=>a.date<b.date?-1:1);
  const weekAvg = computeWeeklyAvg();
  const nutritionAdvice = computeNutritionAdvice();
  return `
    <h2 class="section" style="margin-top:0;">Bodyweight</h2>
    <div class="card">
      <div class="field" style="margin-bottom:10px;">
        <label>Log today's weight (kg)</label>
        <input type="number" step="0.1" inputmode="decimal" id="bwInput" placeholder="e.g. 82.6">
      </div>
      <button class="btn btn-primary" data-action="logBodyweight">Save weight</button>
      ${bw.length ? `<div class="svgwrap" style="margin-top:14px;">${renderSparkline(bw.map(b=>({date:b.date,value:b.weight})))}</div>` : ''}
      <div class="metric-grid">
        <div class="metric"><div class="label">Latest</div><div class="value">${bw.length?bw[bw.length-1].weight+' kg':'—'}</div></div>
        <div class="metric"><div class="label">Weekly avg trend</div><div class="value" style="font-size:13px;">${bodyweightWeeklyRate(weekAvg)!==null ? bodyweightWeeklyRate(weekAvg).toFixed(2)+' kg/wk' : 'Need 2+ weeks'}</div></div>
      </div>
    </div>

    <h2 class="section">Nutrition</h2>
    <div class="card">
      <div class="field"><label>Calories today</label><input type="number" inputmode="numeric" id="calInput" placeholder="${NUTRITION_TARGET.calories}"></div>
      <div class="field"><label>Protein today (g)</label><input type="number" inputmode="numeric" id="proInput" placeholder="${NUTRITION_TARGET.protein}"></div>
      <button class="btn btn-primary" data-action="logNutrition">Save nutrition</button>
      <div class="divider"></div>
      <div style="font-size:12.5px;color:var(--text-dim);line-height:1.5;">
        Targets: ${NUTRITION_TARGET.calories} kcal · ${NUTRITION_TARGET.protein}g protein · ${NUTRITION_TARGET.fat}g fat · ${NUTRITION_TARGET.carbs}g carbs.<br>
        Goal: +${WEIGHT_GAIN_TARGET.min}–${WEIGHT_GAIN_TARGET.max} kg/week.
      </div>
      ${nutritionAdvice ? `<div class="reco reco-reps" style="margin:12px 0 0;">${nutritionAdvice}</div>` : ''}
    </div>

    <h2 class="section">Programme Editor</h2>
    <div class="card">
      <div class="field" style="margin-bottom:10px;">
        <label>Edit day</label>
        <select id="editDaySelect" class="searchbox">
          ${DATA.program.map((d,i)=>`<option value="${i}">${i+1}. ${escapeHtml(d.name)}</option>`).join('')}
        </select>
      </div>
      <div id="dayEditorList"></div>
    </div>

    <h2 class="section">Data</h2>
    <div class="card stack">
      <button class="btn btn-secondary" data-action="exportData">Export data (JSON)</button>
      <label class="btn btn-secondary" style="text-align:center;">
        Import data (JSON)
        <input type="file" id="importFile" accept="application/json" style="display:none;">
      </label>
      <button class="btn btn-outline" id="restoreBackupBtn" style="margin-bottom:10px;">Restore previous save</button>
      <button class="btn btn-danger-outline" data-action="resetData">Reset all data</button>
      <p style="font-size:12px;color:var(--text-dim);">Data is saved on this device. Export a backup regularly before changing devices or clearing browser data.</p>
    </div>
    <div class="card card-tight" style="text-align:center;">
      <button class="btn btn-outline" data-action="installApp" style="margin-bottom:10px;">Install app / iPhone help</button>
      <div style="font-size:12px;color:var(--text-faint);">Install on your Home Screen. Open online once and wait for “Ready for offline use” before training without a connection.</div>
    </div>
  `;
}
function computeNutritionAdvice(){
  const weekAvg = computeWeeklyAvg();
  if(weekAvg.length<3) return null;
  const last3 = weekAvg.slice(-3);
  if(last3.some((row,i)=>i>0 && utcDay(row.date)-utcDay(last3[i-1].date)!==7*86400000)) return null;
  const diffs = [];
  for(let i=1;i<last3.length;i++) diffs.push(last3[i].avg-last3[i-1].avg);
  const lastTwo = diffs.slice(-2);
  if(lastTwo.length<2) return null;
  if(lastTwo.every(d=>d<0.05)) return `Weight gain has been under ${WEIGHT_GAIN_TARGET.min}kg/week for 2 weeks straight. Consider adding 100–150 kcal/day.`;
  if(lastTwo.every(d=>d>0.30)) return `Weight gain has exceeded 0.30kg/week for 2 weeks straight. Consider reducing 100–150 kcal/day.`;
  return null;
}
