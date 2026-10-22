/* Phone entry helpers. These change focus/layout only, never workout data. */
function keyboardInset(height,viewport,editing){
  if(!editing || !viewport || !Number.isFinite(viewport.height) ||
    !Number.isFinite(viewport.offsetTop) || Math.abs((viewport.scale||1)-1)>.05)return 0;
  const inset=Math.max(0,Math.round(height-viewport.height-viewport.offsetTop));
  return inset>100?inset:0;
}
function isEntryField(el){
  return !!el && !el.disabled && !el.readOnly &&
    (el.tagName==='TEXTAREA' || (el.tagName==='INPUT' && ['text','search','number','email','tel','url','password'].includes(el.type)));
}
function entryFields(){
  const root=document.querySelector('#overlay:not(.hide)')||document.getElementById('content');
  return [...root.querySelectorAll('input,textarea')].filter(el=>isEntryField(el) && el.getClientRects().length);
}
function entryDescription(el){
  if(!el)return '';
  const row=el.closest?.('.setrow');
  if(row)return `Set ${Number(el.dataset.setidx)+1} · ${el.dataset.field==='weight'?'kg':'reps'}`;
  return el.getAttribute?.('aria-label')||el.labels?.[0]?.textContent.trim()||el.placeholder||'Input';
}
function syncMobileControls(){
  const active=document.activeElement;
  const touch=window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints>0;
  const editing=!!touch && isEntryField(active),viewport=window.visualViewport;
  const inset=keyboardInset(window.innerHeight,viewport,editing);
  const style=document.documentElement?.style;
  style?.setProperty('--keyboard-inset',inset+'px');
  style?.setProperty('--viewport-height',(viewport?.height||window.innerHeight)+'px');
  style?.setProperty('--viewport-top',(viewport?.offsetTop||0)+'px');
  const navHeight=document.getElementById('navbar').getBoundingClientRect?.().height;
  if(navHeight)style?.setProperty('--nav-height',navHeight+'px');
  document.body.classList.toggle('entry-editing',editing);
  document.body.classList.toggle('keyboard-open',inset>0);
  const toolbar=document.getElementById('entryToolbar');toolbar.hidden=!editing;
  if(!editing)return;
  const fields=entryFields(),index=fields.indexOf(active);
  document.getElementById('entryPrevious').disabled=index<=0;
  document.getElementById('entryNext').disabled=index<0 || index===fields.length-1;
  document.getElementById('entryLabel').textContent=entryDescription(active);
  active.enterKeyHint=active.tagName==='TEXTAREA'?'enter':index<fields.length-1?'next':'done';
}
function moveEntry(direction){
  const fields=entryFields(),index=fields.indexOf(document.activeElement),next=fields[index+direction];
  if(index<0 || !next)return;
  next.focus({preventScroll:true});next.scrollIntoView({block:'center'});syncMobileControls();
}
function setupMobile(){
  const toolbar=document.getElementById('entryToolbar');
  // Keep focus on the field until the requested control handles it.
  toolbar.addEventListener('pointerdown',event=>event.preventDefault());
  document.getElementById('entryPrevious').onclick=()=>moveEntry(-1);
  document.getElementById('entryNext').onclick=()=>moveEntry(1);
  document.getElementById('entryDone').onclick=()=>{document.activeElement?.blur?.();syncMobileControls();};
  document.addEventListener('focusin',syncMobileControls);
  document.addEventListener('focusout',()=>setTimeout(syncMobileControls,0));
  window.addEventListener('resize',syncMobileControls);
  window.visualViewport?.addEventListener('resize',syncMobileControls);
  window.visualViewport?.addEventListener('scroll',syncMobileControls);
  document.addEventListener('keydown',event=>{
    if(event.key==='Enter' && isEntryField(event.target) && event.target.tagName!=='TEXTAREA'){
      event.preventDefault();
      const fields=entryFields(),index=fields.indexOf(event.target);
      if(index>=0 && index<fields.length-1)moveEntry(1);else event.target.blur();
    }
    const overlay=document.getElementById('overlay');
    if(overlay.classList.contains('hide'))return;
    if(event.key==='Escape'){event.preventDefault();closeModal();return;}
    if(event.key!=='Tab')return;
    const fields=[...document.getElementById('modalBody').querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(el=>!el.disabled && el.tabIndex>=0 && el.getClientRects().length);
    if(!fields.length){event.preventDefault();return;}
    const index=fields.indexOf(document.activeElement);
    if(event.shiftKey && index<=0){event.preventDefault();fields.at(-1).focus();}
    else if(!event.shiftKey && (index<0 || index===fields.length-1)){event.preventDefault();fields[0].focus();}
  });
  syncMobileControls();
}
