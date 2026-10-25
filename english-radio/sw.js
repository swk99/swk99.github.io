const CACHE='sunnu-english-radio-v1';
const FILES=['./','index.html','app.js','style.css','lessons.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('sunnu-english-radio-')&&k!==CACHE)await caches.delete(k);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin||!url.pathname.startsWith(new URL('./',location.href).pathname))return;e.respondWith((async()=>{const c=await caches.open(CACHE);if(e.request.mode==='navigate'){try{return await fetch(e.request)}catch{return await c.match('./')}}return await c.match(e.request)||fetch(e.request)})())});
