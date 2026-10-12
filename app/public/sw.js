// FiscalMind Africa — Service Worker (PWA)
// Stratégie : network-first pour le HTML (toujours la dernière version),
// cache-first pour les assets à hash (index-xxx.js — nouveau hash = nouveau fichier).
const CACHE = 'fm-v2';
const STATICS = ['/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATICS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Ne pas intercepter : API Supabase, SasPay, analytics
  if (url.hostname.includes('supabase.co') || url.hostname.includes('saspay.me')) return;
  if (e.request.method !== 'GET') return;

  const isHTML = e.request.mode === 'navigate'
    || url.pathname === '/' || url.pathname.endsWith('.html');

  if (isHTML) {
    // HTML : réseau d'abord, cache en secours (hors-ligne)
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('/')))
    );
  } else {
    // Assets (JS/CSS/images à hash) : cache d'abord, réseau en secours
    e.respondWith(
      caches.match(e.request).then(
        (hit) => hit || fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        }).catch(() => caches.match('/'))
      )
    );
  }
});
