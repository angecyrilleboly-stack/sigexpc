// ============================================================================
//  SIGEXPC - Service Worker (PWA)
//  Cache les fichiers statiques pour fonctionnement hors ligne.
// ============================================================================
const CACHE_NAME = 'sigexpc-v2-20260801';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/autoecole.html',
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
  '/offline.html'
];

// ===== INSTALL : mettre en cache les fichiers statiques =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.log('SW install error:', err))
  );
});

// ===== ACTIVATE : nettoyer les anciens caches =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ===== FETCH : stratégies de cache =====
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ignorer les requêtes non GET
  if (req.method !== 'GET') return;

  // Ignorer les requêtes vers CDN externes (Tailwind, Font Awesome, Chart.js, Three.js)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // --- STRATÉGIE 1 : Network First pour les API (données fraîches) ---
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // --- STRATÉGIE 2 : Cache First pour les fichiers statiques (CSS, JS, images) ---
  if (req.destination === 'style' ||
      req.destination === 'script' ||
      req.destination === 'image' ||
      req.destination === 'font' ||
      url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(req)
        .then((cached) => {
          if (cached) return cached;
          return fetch(req).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return res;
          });
        })
    );
    return;
  }

  // --- STRATÉGIE 3 : Network First pour les pages HTML (navigation) ---
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }
});

// ===== MESSAGE : forcer la mise à jour =====
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
