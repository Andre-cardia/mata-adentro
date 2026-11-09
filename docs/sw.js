// Mata Adentro — service worker (gerado pelo build.py). Rede primeiro, cache como reserva: abre sem internet
// depois da primeira visita e pega a versão nova assim que houver conexão.
const PREFIX = 'mata-adentro:' + self.registration.scope + ':'; // um cache por escopo: dist/ e docs/ não se apagam
const CACHE = PREFIX + 'bff69871c7';
const START = "./";
const FILES = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-192.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const nav = req.mode === 'navigate', key = nav ? url.origin + url.pathname : req; // ?fase=N usa a mesma cópia
  const fromCache = () => caches.match(key).then(r => r || (nav ? caches.match(START) : undefined));
  const fromNet = fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  // rede lenta: depois de 4 s a cópia guardada assume (o HTML tem uns 8 MB com o áudio)
  const slow = new Promise(res => setTimeout(res, 4000)).then(fromCache).then(r => r || fromNet);
  e.respondWith(Promise.race([fromNet.catch(() => fromCache()), slow]).then(r => r || fromNet));
});
