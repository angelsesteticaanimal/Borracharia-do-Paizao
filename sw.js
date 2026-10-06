/* V3.12.7.17 — sem cache de telas/dados */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys()) await caches.delete(k); await self.clients.claim();})()));
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&e.request.mode==='navigate')e.respondWith(fetch(e.request,{cache:'no-store'}));});
