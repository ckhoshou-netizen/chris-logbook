const CACHE='chris-logbook-hourly-food-v14';
const FILES=['./','./index.html','./style.css','./main.mjs','./domain.mjs','./storage.mjs','./manifest.webmanifest','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./fonts/BarlowCondensed-BoldItalic.ttf','./catalog.mjs','./data/cnf-2026.json'];
const ASSETS=new Set(FILES.map(path=>new URL(path,self.location.href).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('chris-logbook-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Authentication routes and URLs containing sign-in state are never cached.
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.search||!ASSETS.has(url.pathname))return;
 event.respondWith((async()=>{
  const cached=await caches.match(event.request);
  try{
   const response=await fetch(event.request,{cache:'no-cache'});
   const type=response.headers.get('content-type')??'';
   const isScript=/\.mjs$/.test(url.pathname),isStyle=/\.css$/.test(url.pathname),isJson=/\.json$/.test(url.pathname);
   const validType=isScript?/javascript/.test(type):isStyle?/text\/css/.test(type):isJson?/application\/json/.test(type):true;
   // A redirected sign-in page must not overwrite a cached app asset.
   if(response.ok&&!response.redirected&&validType){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());return response;}
   return cached??response;
  }catch{
   return cached??(event.request.mode==='navigate'?await caches.match('./index.html'):null)??Response.error();
  }
 })());
});
