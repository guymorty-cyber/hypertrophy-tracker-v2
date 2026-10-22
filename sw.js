/* The build script pins the complete app shell to one release. No workout data is cached here. */
const BUILD='__BUILD_SHA__';
const PRECACHE=__PRECACHE__;
const SHELL=__SHELL__;
const PREFIX='ht-shell:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+BUILD;
const shellURL=new URL(SHELL,self.registration.scope).href;
const assetURLs=new Set(PRECACHE.map(path=>new URL(path,self.registration.scope).href));

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    try{
      const cache=await caches.open(CACHE);
      await cache.addAll(PRECACHE.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));
    }catch(error){
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // Keep the previous release for already-open tabs. Never touch other apps' caches or localStorage.
    const keys=(await caches.keys()).filter(key=>key.startsWith(PREFIX));
    const previous=keys.filter(key=>key!==CACHE).slice(-1);
    await Promise.all(keys.filter(key=>key!==CACHE && !previous.includes(key)).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
  if(request.method!=='GET' || url.origin!==scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const relative=url.pathname.slice(scope.pathname.length);
  if(relative==='version.json' || relative==='sw.js'){
    event.respondWith(fetch(new Request(request,{cache:'no-store'})).catch(()=>
      new Response('',{status:503,statusText:'Offline'})));
    return;
  }
  if(request.mode==='navigate' && ['', 'index.html', 'hypertrophy-trackernew.html'].includes(relative)){
    event.respondWith((async()=>{
      const cached=await (await caches.open(CACHE)).match(shellURL);
      return cached || fetch(request);
    })());
    return;
  }
  if(assetURLs.has(url.href)){
    event.respondWith((async()=>{
      const cached=await (await caches.open(CACHE)).match(request);
      return cached || fetch(request);
    })());
  }
});
