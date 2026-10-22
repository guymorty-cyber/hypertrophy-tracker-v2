/* Installation, offline readiness and user-controlled updates. Workout data stays in storage.js. */
let availableBuild=null;
let pwaRegistration=null;
let installPrompt=null;
let offlineReady=false;
let updateRequested=false;

function setOfflineStatus(message){
  const el=document.getElementById('offlineStatus');
  if(el) el.textContent=message;
}
function refreshOfflineStatus(){
  if(navigator.onLine===false){
    setOfflineStatus(offlineReady?'Offline — workouts save on this device':'Connect once to enable offline use');
  }else{
    setOfflineStatus(offlineReady?'Ready for offline use':'Preparing offline use…');
  }
}
function offerAppUpdate(){
  const button=document.getElementById('updateApp');
  if(button) button.hidden=false;
}
function watchWorker(registration){
  if(registration.waiting) offerAppUpdate();
  const installing=registration.installing;
  if(!installing) return;
  installing.addEventListener('statechange',()=>{
    if(installing.state==='installed' && registration.waiting) offerAppUpdate();
  });
}
async function checkForUpdate(){
  if(navigator.onLine===false) return;
  try{
    if(pwaRegistration) await pwaRegistration.update();
    if(APP_BUILD.startsWith('__')) return;
    const response=await fetch('./version.json',{cache:'no-store'});
    if(!response.ok) return;
    const version=await response.json();
    if(typeof version.build==='string' && /^[a-f0-9]{40}$/.test(version.build) && version.build!==APP_BUILD){
      availableBuild=version.build;
      // A controlled page must wait for the complete new shell to download.
      if(!navigator.serviceWorker?.controller || pwaRegistration?.waiting) offerAppUpdate();
    }
  }catch(e){} // Offline use must not depend on update discovery.
}
function reloadApp(){
  const url=new URL(location.href);
  url.searchParams.set('v',availableBuild || Date.now().toString());
  location.replace(url.href);
}
async function applyAppUpdate(){
  if(!save()) return false;
  if(pwaRegistration?.waiting){
    updateRequested=true;
    setOfflineStatus('Applying update — your workout is saved');
    pwaRegistration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
    return true;
  }
  if(navigator.serviceWorker?.controller){
    setOfflineStatus('The update is still downloading. Try again when connected.');
    await checkForUpdate();
    return false;
  }
  if(availableBuild){ reloadApp(); return true; }
  return false;
}
async function installApp(){
  if(installPrompt){
    const prompt=installPrompt;
    installPrompt=null;
    await prompt.prompt();
    await prompt.userChoice;
    return;
  }
  showModal(`<h2>Install Hypertrophy Tracker</h2>
    <p>On iPhone, open this page in Safari, tap Share, then Add to Home Screen.</p>
    <p>On Android or desktop, use your browser menu and choose Install app or Add to Home Screen.</p>
    <p>Open online once and wait for “Ready for offline use”. Keep using the same browser or existing Home Screen app for your saved history. Export a backup in More before changing how you open the app.</p>
    <button class="btn btn-primary" data-action="closeModal">Done</button>`);
}
function setupPWA(){
  document.getElementById('updateApp').onclick=()=>applyAppUpdate();
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    installPrompt=event;
  });
  window.addEventListener('online',()=>{refreshOfflineStatus();checkForUpdate();});
  window.addEventListener('offline',refreshOfflineStatus);
  window.addEventListener('pageshow',checkForUpdate);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') checkForUpdate();
  });
  if(!('serviceWorker' in navigator)){
    setOfflineStatus('Offline loading is not supported in this browser');
    checkForUpdate();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(updateRequested) reloadApp();
    else if(offlineReady) refreshOfflineStatus();
  });
  refreshOfflineStatus();
  const registrationPromise=navigator.onLine===false
    ? navigator.serviceWorker.getRegistration('./')
    : navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  registrationPromise.then(registration=>{
    if(!registration) throw new Error('Connect once to enable offline use');
    pwaRegistration=registration;
    watchWorker(registration);
    registration.addEventListener('updatefound',()=>watchWorker(registration));
    return navigator.serviceWorker.ready;
  }).then(()=>{
    offlineReady=true;
    refreshOfflineStatus();
    checkForUpdate();
  }).catch(()=>{
    setOfflineStatus('Offline setup unavailable — connect and reopen to retry');
    checkForUpdate();
  });
}
