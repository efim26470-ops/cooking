const VERSION='offline-cookbook-v2.0.0';
const MEDIA_CACHE='offline-cookbook-media-v2';
const APP_SHELL=['./','./index.html','./styles.css','./recipes.js','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION&&key!==MEDIA_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.destination==='image'&&url.origin!==self.location.origin){
    event.respondWith(caches.open(MEDIA_CACHE).then(async cache=>{
      const cached=await cache.match(request);if(cached)return cached;
      try{const response=await fetch(request);await cache.put(request,response.clone());return response}catch{return new Response('',{status:504,statusText:'Offline image unavailable'})}
    }));
    return;
  }

  if(url.hostname.includes('themealdb.com')||url.hostname.includes('dummyjson.com')){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy)).catch(()=>{});return response;
    }).catch(()=>caches.match(request)));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./index.html',copy)).catch(()=>{});return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy)).catch(()=>{})}return response;
  })));
});
