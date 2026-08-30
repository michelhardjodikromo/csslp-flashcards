/* Offline cache for the CSSLP Flashcards web app.
   Strategy: audio is cache-first (big, immutable, keep offline once played);
   everything else (HTML, JS, CSS, JSON) is network-first so new deploys show
   immediately when online and still work offline from cache. */
const VERSION = 'csslp-v4';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'exam.js',
  'exam.css',
  'cards.json',
  'exams.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const sameOrigin = new URL(request.url).origin === self.location.origin;
  const isAudio = request.url.includes('/audio/');

  if (isAudio) {
    // Cache-first: audio never changes, avoid re-downloading.
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        if (res.ok && sameOrigin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
        return res;
      }))
    );
    return;
  }

  // Network-first for code/data/HTML: fresh when online, cached when offline.
  e.respondWith(
    fetch(request).then((res) => {
      if (res.ok && sameOrigin) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
      return res;
    }).catch(() => caches.match(request).then((hit) => hit || caches.match('index.html')))
  );
});
