const CACHE = 'portfolio-v1';
const PRECACHE = ['/all-in-one.mp4', '/hero-mobile.mp4'];

// On install: pre-fetch and cache both videos in the background
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          fetch(url, { cache: 'no-store' }).then((res) => {
            if (res.ok) cache.put(url, res);
          })
        )
      )
    )
  );
});

self.addEventListener('activate', (e) => {
  // Clean up old caches
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Serve videos from cache; fall back to network
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('.mp4')) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request))
    );
  }
});
