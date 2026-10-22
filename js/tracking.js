/* ---------- nutrition / bodyweight ---------- */
function logNutrition(){
  const cal = document.getElementById('calInput');
  const pro = document.getElementById('proInput');
  const calVal = cal && cal.value ? Number(cal.value) : null;
  const proVal = pro && pro.value ? Number(pro.value) : null;
  if([calVal,proVal].some(v=>v!==null && (!Number.isFinite(v) || v<0))){ alert('Enter non-negative calories and protein.'); return; }
  if(calVal===null && proVal===null) return;
  const today = todayISO();
  const previous=DATA.nutrition.find(n=>n.date===today)||{date:today,calories:0,protein:0};
  const entry={...previous,calories:calVal??previous.calories,protein:proVal??previous.protein};
  const nutrition=DATA.nutrition.filter(n=>n.date!==today).concat(entry);
  if(!commitData({...DATA,nutrition}))return;
  renderTab();
}
function logBodyweight(){
  const inp = document.getElementById('bwInput');
  if(!inp || !inp.value) return;
  const val = Number(inp.value);
  if(!Number.isFinite(val) || val<=0){ alert('Enter a positive bodyweight.'); return; }
  const today = todayISO();
  const bodyweight=DATA.bodyweight.filter(b=>b.date!==today).concat({date:today,weight:val});
  if(!commitData({...DATA,bodyweight}))return;
  renderTab();
}
