// Track & Tide - Service Worker for Map Tile Caching
// Cache-first strategy: serves tiles instantly from cache, fetches in background

const CACHE_NAME = 'tiles-cache-v2';
const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

// Tile URL patterns to cache
const TILE_PATTERNS = [
  /cartocdn\.com\/.*\/\d+\/\d+\/\d+.*\.(png|pbf|webp)/i,
];

self.addEventListener('install', (event) => {
  console.log('[SW] Tile cache service worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Tile cache service worker activated');
  // Clean old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isTileRequest(url) {
  return TILE_PATTERNS.some((pattern) => pattern.test(url));
}

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  if (!isTileRequest(url)) return;

  // Cache-first: serve from cache immediately, update cache in background
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            // Network failed, but we have cached response — that's fine
          });

        // Return cached immediately, but refresh cache in background
        return cached || fetchPromise;
      })
    )
  );
});
