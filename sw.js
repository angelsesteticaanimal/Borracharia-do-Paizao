/* Registro mínimo para instalação: NÃO armazena dados nem telas em cache. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method==='GET' && event.request.mode==='navigate'){event.respondWith(fetch(event.request));}});
