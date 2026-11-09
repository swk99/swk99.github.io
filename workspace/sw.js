// Network first for same-origin GETs only. Execution CDN still needs connectivity.
const CACHE='sql-pocket-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','./mobile.css?v=1','./mobile.js?v=1','./manifest.webmanifest']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('sql-pocket-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith('/workspace/'))return;
 event.respondWith(fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
  return response;
 }).catch(()=>caches.match(req).then(cached=>cached||new Response('인터넷에 연결한 후 다시 열어 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));
});
