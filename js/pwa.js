/* Installation, offline readiness and user-controlled updates. Workout data stays in storage.js. */
let availableBuild=null;
let pwaRegistration=null;
let installPrompt=null;
let offlineReady=false;
let updateRequested=false;
let updateCheckPromise=null;
let appCheckMessage='';

function setOfflineStatus(message){
  const el=document.getElementById('offlineStatus');
  if(el) el.textContent=message;
  const detail=document.getElementById('appOfflineState');
  if(detail)detail.textContent=message;
}
function refreshOfflineStatus(){
  if(!('serviceWorker' in navigator)){setOfflineStatus('Offline loading is not supported in this browser');return;}
  if(navigator.onLine===false){
    setOfflineStatus(offlineReady?'Offline — workouts save on this device':'Connect once to enable offline use');
  }else{
    setOfflineStatus(offlineReady?'Ready for offline use':'Preparing offline use…');
  }
}
function offerAppUpdate(){
  const button=document.getElementById('updateApp');
  if(button) button.hidden=false;
  appCheckMessage='Update ready. Use Update app above; your current data saves first.';
  refreshAppDetails();
}
function watchWorker(registration){
  if(registration.waiting) offerAppUpdate();
  const installing=registration.installing;
  if(!installing) return;
  installing.addEventListener('statechange',()=>{
    if(installing.state==='installed' && registration.waiting) offerAppUpdate();
  });
}
async function discoverAppUpdate(){
  if(navigator.onLine===false)return 'offline';
  try{
    // A server that does not respond must not leave the manual check spinning.
    const withTimeout=promise=>{
      let timer;
      return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Update check timed out')),10000);})]).finally(()=>clearTimeout(timer));
    };
    if(pwaRegistration)await withTimeout(pwaRegistration.update());
    if(APP_BUILD.startsWith('__'))return 'development';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    let version;
    try{
      const response=await fetch('./version.json',{cache:'no-store',signal:controller.signal});
      if(!response.ok)return 'unavailable';
      version=await response.json();
    }finally{clearTimeout(timer);}
    if(typeof version.build!=='string' || !/^[a-f0-9]{40}$/.test(version.build))return 'unavailable';
    if(version.build!==APP_BUILD){
      availableBuild=version.build;
      // A controlled page must wait for the complete new shell to download.
      const ready=!navigator.serviceWorker?.controller || !!pwaRegistration?.waiting;
      if(ready)offerAppUpdate();
      return ready?'ready':'downloading';
    }
    return 'current';
  }catch(e){return 'unavailable';} // Offline logging is independent of discovery.
}
function checkForUpdate(){
  if(!updateCheckPromise)updateCheckPromise=discoverAppUpdate().finally(()=>{updateCheckPromise=null;const button=document.getElementById('checkAppUpdate');if(button)button.disabled=false;});
  return updateCheckPromise;
}
function installedApp(){
  return navigator.standalone===true || !!window.matchMedia?.('(display-mode: standalone)').matches;
}
function appUpdateMessage(result){
  if(result==='offline')return 'Offline. Your saved workouts remain on this device; reconnect to check for updates.';
  if(result==='ready')return 'Update ready. Use Update app above; your current data saves first.';
  if(result==='downloading')return 'A new version is downloading. Keep the app open online until Update app appears.';
  if(result==='current')return 'You are using the latest published version.';
  if(result==='development')return 'Local preview. Published versions support update checks.';
  return 'Could not check for updates. Your current app is unchanged; try again when connected.';
}
function refreshAppDetails(){
  const mode=document.getElementById('appLaunchMode');
  if(mode)mode.textContent=installedApp()?'Opened as a Home Screen app':'Opened in a browser';
  const message=document.getElementById('appUpdateMessage');
  if(message)message.textContent=appCheckMessage;
}
async function checkAppStatus(){
  const button=document.getElementById('checkAppUpdate');
  if(button)button.disabled=true;
  appCheckMessage='Checking for updates…';refreshAppDetails();
  const result=await checkForUpdate();
  appCheckMessage=appUpdateMessage(pwaRegistration?.waiting?'ready':result);
  refreshAppDetails();
  if(button)button.disabled=false;
  refreshOfflineStatus();
  return result;
}
function renderAppExperience(){
  return `<h2 class="section" style="margin-top:0;">App &amp; offline</h2><div class="card" id="appExperience">
    <div class="app-status-row" id="appLaunchMode">${installedApp()?'Opened as a Home Screen app':'Opened in a browser'}</div>
    <div class="app-status-row" id="appOfflineState">${escapeHtml(document.getElementById('offlineStatus').textContent)}</div>
    <div class="app-status-row">Version: ${APP_BUILD.startsWith('__')?'Local preview':escapeHtml(APP_BUILD.slice(0,7))}</div>
    <button class="btn btn-outline" id="checkAppUpdate" data-action="checkAppUpdate" ${updateCheckPromise?'disabled':''}>Check for updates</button><p class="app-status-row" id="appUpdateMessage" role="status">${escapeHtml(appCheckMessage||(updateCheckPromise?'Checking for updates…':''))}</p>
    <p class="app-status-row">Workouts save on this device. Offline readiness means the app can reopen without a connection; export a JSON backup in Data before changing devices or clearing browser data.</p>
  </div>`;
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
  if(installedApp()){
    showModal(`<h2>Home Screen app</h2><p>You are already opening the tracker as an app. No reinstall is needed.</p><p>Open online and wait for “Ready for offline use” before training without a connection. Keep using this existing app for its saved history.</p><button class="btn btn-primary" data-action="closeModal">Done</button>`);
    return;
  }
  if(installPrompt){
    const prompt=installPrompt;
    installPrompt=null;
    await prompt.prompt();
    await prompt.userChoice;
    return;
  }
  showModal(`<h2>Install Hypertrophy Tracker</h2>
    <p>On iPhone, open this page in Safari, tap Share (or More → Share), then Add to Home Screen. If shown, turn on Open as Web App, then tap Add.</p>
    <p>On Android or desktop, use your browser menu and choose Install app or Add to Home Screen.</p>
    <p>Open online once and wait for “Ready for offline use”. Keep using the same browser or existing Home Screen app for your saved history. Export a backup in More before changing how you open the app. If the new Home Screen app opens empty, import that backup there; do not reset your original tracker.</p>
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
  window.addEventListener('pageshow',()=>{refreshOfflineStatus();refreshAppDetails();checkForUpdate();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;refreshAppDetails();});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){refreshOfflineStatus();refreshAppDetails();checkForUpdate();}
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
  // An existing offline worker stays usable even when a fresh registration
  // request fails (for example, Wi-Fi is connected but the server is unreachable).
  navigator.serviceWorker.ready.then(registration=>{
    if(!pwaRegistration) pwaRegistration=registration;
    offlineReady=true;
    refreshOfflineStatus();
    checkForUpdate();
  });
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
    if(offlineReady) refreshOfflineStatus();
    else setOfflineStatus('Offline setup unavailable — connect and reopen to retry');
    checkForUpdate();
  });
}
