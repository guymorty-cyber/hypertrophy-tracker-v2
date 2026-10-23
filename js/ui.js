/* ============================= RENDER ROOT ============================= */
let currentTab = 'home';
let restTimerState = {running:false, remaining:0, total:0, interval:null};
let exerciseFilterQuery = '';
let selectedProgressExId = null;

function setTab(tab){
  currentTab = tab;
  document.querySelectorAll('#navbar button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.getElementById('backbtn').classList.add('hidden');
  renderTab();
  document.getElementById('content').scrollTop=0;
  window.scrollTo(0,0);
}
document.querySelectorAll('#navbar button').forEach(b=>{
  b.addEventListener('click', ()=> setTab(b.dataset.tab));
});
document.getElementById('exportQuickBtn').addEventListener('click', ()=> setTab('more'));

function renderTab(){
  const wk = currentTab==='train' && DATA.activeSession ? (DATA.activeSession.weekNumber || getWeekNumber()) : getWeekNumber();
  const phase = getPhase(wk);
  document.getElementById('phaseLabel').textContent = `Week ${wk} · ${phase.name}`;
  const c = document.getElementById('content');
  if(currentTab==='home') c.innerHTML = renderHome(wk,phase);
  else if(currentTab==='train') c.innerHTML = renderTrain();
  else if(currentTab==='progress') c.innerHTML = renderProgress();
  else if(currentTab==='history') c.innerHTML = renderHistory();
  else if(currentTab==='more') c.innerHTML = renderMore();
  attachTabEvents();
  syncMobileControls();
}
/* ---------- modal ---------- */
let modalReturnFocus=null;
let modalGeneration=0;
function showModal(html){
  modalGeneration++;
  if(document.getElementById('overlay').classList.contains?.('hide'))modalReturnFocus=document.activeElement;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('overlay').classList.remove('hide');
  document.body.classList.add('modal-open');
  document.getElementById('modalBody').focus?.({preventScroll:true});
  syncMobileControls();
  document.querySelectorAll('[data-action="closeModal"]').forEach(b=> b.onclick = closeModal);
}
function closeModal(){
  modalGeneration++;
  document.getElementById('overlay').classList.add('hide');
  document.body.classList.remove('modal-open');
  if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});
  else document.querySelector('#navbar button.active')?.focus({preventScroll:true});
  modalReturnFocus=null;
  syncMobileControls();
}
document.getElementById('overlay').addEventListener('click', (e)=>{
  if(e.target.id==='overlay') closeModal();
});

/* ---------- util ---------- */
function escapeHtml(str){
  if(str===null||str===undefined) return '';
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
