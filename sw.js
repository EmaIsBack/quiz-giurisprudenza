// Service worker: l'app funziona anche offline.
// Prima la rete, così aggiornamenti e nuovi capitoli arrivano subito; offline usa la cache.
const VERSION = 'v3-2026-11-19';
const CACHE = 'qg-' + VERSION;
const SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/engine.js', 'js/store.js', 'js/content.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('qg-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Prima la rete (così aggiornamenti e nuovi capitoli arrivano subito), offline la cache.
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
