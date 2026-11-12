// Revalidate online assets; retain offline support without keeping an old worker waiting.
const CACHE='sql-pocket-english-v2';
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(['./?v=english-v2','./mobile.css?v=english-v2','./mobile.js?v=english-v2','./manifest.webmanifest'])).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sql-pocket-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/workspace/'))return;
 event.respondWith(fetch(req,{cache:'no-cache'}).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
  return response;
 }).catch(()=>caches.match(req).then(cached=>cached||new Response('Connect to the internet and try opening again.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));
});
