const CACHE='mechasonic-v2';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const response=await fetch('/index.html');
 const html=await response.clone().text();
 await cache.put('/index.html',response);
 await cache.put('/',new Response(html,{headers:{'Content-Type':'text/html'}}));
 const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match=>match[1]);
 await cache.addAll(['/manifest.webmanifest',...assets]);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
 event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(async()=>{
  const cached=await caches.match(event.request);if(cached)return cached;
  if(event.request.mode==='navigate')return (await caches.match('/index.html'))||Response.error();
  return Response.error();
 }));
});
