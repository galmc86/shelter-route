// Shelter Route — Service Worker
// Cache-first for static assets, network-first for API calls

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `shelter-route-static-${CACHE_VERSION}`;
const TILE_CACHE = `shelter-route-tiles-${CACHE_VERSION}`;
const API_CACHE = `shelter-route-api-${CACHE_VERSION}`;

// App shell resources to precache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/shelters.json',
];

// Install: precache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  // Note: skipWaiting is NOT called here — activation is controlled
  // via the SKIP_WAITING message handler so users can choose when to update.
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => {
            return (
              key.startsWith('shelter-route-') &&
              key !== STATIC_CACHE &&
              key !== TILE_CACHE &&
              key !== API_CACHE
            );
          })
          .map((key) => caches.delete(key))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch: strategy depends on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // OREF proxy (real-time alert data) — network-only, never cache
  if (isOrefProxy(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Shelters data — network-first with cache fallback (needs to be fresh but available offline)
  if (isSheltersData(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Map tiles — cache-first with expiration
  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(request, TILE_CACHE, 7 * 24 * 60 * 60));
    return;
  }

  // API calls — network-first with cache fallback
  if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Static assets (JS, CSS, images, fonts) — cache-first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (HTML pages) — network-first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, STATIC_CACHE).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// --- Helper functions ---

function isTileRequest(url) {
  return (
    /^https?:\/\/[a-c]\.tile\.openstreetmap\.org\//.test(url.href) ||
    /^https?:\/\/.*\.tile\./.test(url.href)
  );
}

function isAPIRequest(url) {
  return (
    url.hostname === 'api.openrouteservice.org' ||
    url.hostname === 'nominatim.openstreetmap.org' ||
    url.hostname === 'maps.googleapis.com' ||
    url.hostname === 'places.googleapis.com'
  );
}

function isStaticAsset(url) {
  // Exclude shelters.json — it has its own network-first strategy
  if (isSheltersData(url)) return false;
  return /\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|json)(\?.*)?$/.test(
    url.pathname
  );
}

function isSheltersData(url) {
  return url.pathname.endsWith('/shelters.json') || url.pathname === '/shelters.json';
}

function isOrefProxy(url) {
  return url.hostname.includes('workers.dev');
}

// Cache-first strategy: serve from cache, falling back to network
async function cacheFirst(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Check if cache entry is still fresh (if maxAge specified)
    if (maxAgeSeconds) {
      const dateHeader = cached.headers.get('sw-cache-date');
      if (dateHeader) {
        const cacheDate = new Date(dateHeader).getTime();
        const now = Date.now();
        if (now - cacheDate > maxAgeSeconds * 1000) {
          // Cache expired — fetch fresh copy in background
          fetchAndCache(request, cache);
          // Still serve the stale response for speed
          return cached;
        }
      }
    }
    return cached;
  }

  return fetchAndCache(request, cache);
}

// Network-first strategy: try network, fall back to cache
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone and cache the response with a timestamp
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', new Date().toISOString());

      const body = await responseToCache.blob();
      const cachedResponse = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Fetch and store in cache
async function fetchAndCache(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-date', new Date().toISOString());

      const body = await responseToCache.blob();
      const cachedResponse = new Response(body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch (error) {
    // If fetch fails and we have nothing cached, re-throw so the caller
    // (browser or networkFirst) can handle it properly.
    // Previously we returned a 503 here, which the SW then cached — causing
    // stale error responses to persist.
    throw error;
  }
}

// Push notification handler — displays alert notification
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Shelter Route Alert';
  const options = {
    body: data.body || 'Alert in your area — seek shelter immediately!',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: data.tag || 'shelter-route-alert',
    requireInteraction: true,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing app window if one exists
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow('/');
    })
  );
});

// Notify clients about SW updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Limit tile cache size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // Delete oldest entries
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// Periodically trim the tile cache (called after tile fetches)
self.addEventListener('fetch', (event) => {
  if (isTileRequest(new URL(event.request.url))) {
    event.waitUntil(trimCache(TILE_CACHE, 500));
  }
});
