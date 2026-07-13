const VERSION='offline-cookbook-v4.5.0';
const MEDIA_CACHE='offline-cookbook-media-v5';
const APP_SHELL=[
  './',
  './index.html',
  './styles.css?v=4.5.0',
  './recipes.js?v=4.5.0',
  './translator.js?v=4.5.0',
  './app.js?v=4.5.0',
  './manifest.webmanifest?v=4.5.0',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==VERSION&&key!==MEDIA_CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});

async function cacheFallback(request){
  return (await caches.match(request)) || (await caches.match(request,{ignoreSearch:true}));
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);

  if(request.destination==='image'&&url.origin!==self.location.origin){
    event.respondWith(caches.open(MEDIA_CACHE).then(async cache=>{
      const cached=await cache.match(request);
      if(cached)return cached;
      try{
        const response=await fetch(request,{referrerPolicy:'no-referrer'});
        // Ошибка записи в кэш (часто квота iOS) не должна уничтожать уже загруженную картинку.
        if(response){try{await cache.put(request,response.clone())}catch(error){console.warn('Image cache skipped',error)}}
        return response;
      }catch{
        return new Response('',{status:504,statusText:'Offline image unavailable'});
      }
    }));
    return;
  }

  if(url.hostname.includes('themealdb.com')||url.hostname.includes('dummyjson.com')||url.hostname.includes('thecocktaildb.com')||url.hostname.includes('wikibooks.org')){
    event.respondWith(fetch(request).then(response=>{
      if(response?.ok)caches.open(VERSION).then(cache=>cache.put(request,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>cacheFallback(request)));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response?.ok)caches.open(VERSION).then(cache=>cache.put('./index.html',response.clone())).catch(()=>{});
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response?.ok)caches.open(VERSION).then(cache=>cache.put(request,response.clone())).catch(()=>{});
      return response;
    }).catch(()=>cacheFallback(request)));
  }
});
