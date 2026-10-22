/* ---------- nutrition / bodyweight ---------- */
function logNutrition(){
  const cal = document.getElementById('calInput');
  const pro = document.getElementById('proInput');
  const calVal = cal && cal.value ? Number(cal.value) : null;
  const proVal = pro && pro.value ? Number(pro.value) : null;
  if([calVal,proVal].some(v=>v!==null && (!Number.isFinite(v) || v<0))){ alert('Enter non-negative calories and protein.'); return; }
  if(calVal===null && proVal===null) return;
  const today = todayISO();
  let entry = DATA.nutrition.find(n=>n.date===today);
  if(!entry){ entry={date:today,calories:0,protein:0}; DATA.nutrition.push(entry); }
  if(calVal!==null) entry.calories = calVal;
  if(proVal!==null) entry.protein = proVal;
  save();
  renderTab();
}
function logBodyweight(){
  const inp = document.getElementById('bwInput');
  if(!inp || !inp.value) return;
  const val = Number(inp.value);
  if(!Number.isFinite(val) || val<=0){ alert('Enter a positive bodyweight.'); return; }
  const today = todayISO();
  let entry = DATA.bodyweight.find(b=>b.date===today);
  if(!entry){ entry={date:today,weight:val}; DATA.bodyweight.push(entry); }
  else entry.weight = val;
  save();
  renderTab();
}
