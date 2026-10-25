const CACHE='phrase-garden-shell-v4';
const ROOT=new URL('./',self.location.href);
const FILES=['./','index.html','style.css','data.js','app.js','pwa.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png','study-guide.md'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,ROOT),{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{for(const key of await caches.keys()){if(key.startsWith('phrase-garden-shell-')&&key!==CACHE)await caches.delete(key);}await self.clients.claim();})());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 event.respondWith((async()=>{
 const cache=await caches.open(CACHE);
 if(event.request.mode==='navigate'){
   const route=url.pathname.slice(ROOT.pathname.length);
   if(route===''||route==='index.html')return (await cache.match(ROOT.href))||fetch(event.request);
 }
 return (await cache.match(event.request))||fetch(event.request);
 })());
});