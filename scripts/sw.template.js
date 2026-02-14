const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = `AirshipOne-v${APP_VERSION}`;
const PRECACHE_URLS = __PRECACHE_LIST__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable();
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation) {
      const preload = await event.preloadResponse;
      if (preload) {
        cache.put('./index.html', preload.clone()).catch(() => {});
        return preload;
      }
      try {
        const network = await fetch(event.request, { cache: 'no-store' });
        if (network && network.ok) {
          cache.put('./index.html', network.clone()).catch(() => {});
          return network;
        }
      } catch {
      }
      const fallback = await cache.match('./index.html', { ignoreSearch: true });
      if (fallback) return fallback;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }

    try {
      const network = await fetch(event.request, { cache: 'no-store' });
      if (network && network.ok) {
        cache.put(event.request, network.clone()).catch(() => {});
      }
      return network;
    } catch {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      throw new Error('Resource unavailable offline');
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'airshipone-skip-waiting') {
    self.skipWaiting();
  }
});
