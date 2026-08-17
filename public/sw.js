// ============================================================================
//  SIGEXPC - Service Worker (PWA) v3
//  Cache agressif pour chargement instantané de toute l'application.
// ============================================================================
const CACHE_VERSION = 'sigexpc-v6-20260817';
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_PAGES = CACHE_VERSION + '-pages';
const CACHE_API = CACHE_VERSION + '-api';

// Fichiers à précharger immédiatement (CSS, JS, images)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/autoecole.html',
  '/offline.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/api.js',
  '/js/ui.js',
  '/js/app.js',
  '/js/views.js',
  '/js/views-candidats.js',
  '/js/views-stats.js',
  '/img/logo.png',
  '/img/bg-login.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
  '/img/icon-maskable-512.png'
];

// ===== INSTALL : précharger tous les fichiers statiques =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('SW precache error:', err))
  );
});

// ===== ACTIVATE : nettoyer anciens caches =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ===== FETCH : stratégies de cache intelligentes =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Ignorer CDN externes
  if (url.origin !== self.location.origin) return;

  // --- API : Network First (données fraîches) avec cache de secours ---
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_API).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response(JSON.stringify({ success: false, error: 'Hors ligne' }), { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // --- Fichiers statiques (CSS, JS, images, fonts) : Cache First ---
  if (req.destination === 'style' || req.destination === 'script' || req.destination === 'image' ||
      url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|gif)$/)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_STATIC).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // --- Pages HTML : Stale While Revalidate (afficher cache immédiatement, MAJ en arrière-plan) ---
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      caches.open(CACHE_PAGES).then((cache) => {
        return cache.match(req).then((cached) => {
          const fetchPromise = fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached || caches.match('/offline.html'));
          return cached || fetchPromise;
        });
      })
    );
    return;
  }
});

// ===== MESSAGE =====
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
