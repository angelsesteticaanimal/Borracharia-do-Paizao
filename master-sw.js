// Não armazena senhas, dados do Firebase ou páginas do aplicativo operacional.
const CACHE = 'paizao-master-shell-v1';
const ASSETS = ['./master.html','./master.css','./master-install.js','./master.webmanifest','./master-icon-192.png','./master-icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('paizao-master-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./master.html')));
  } else if (ASSETS.some(p => new URL(p,self.registration.scope).pathname === new URL(request.url).pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
  }
});
