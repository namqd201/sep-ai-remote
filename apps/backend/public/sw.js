// Service Worker for Sếp AI Remote PWA
const CACHE_NAME = 'sep-ai-remote-v3';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/ws') || event.request.url.includes('/api/')) {
    return;
  }
  
  const headers = new Headers(event.request.headers);
  headers.set('ngrok-skip-browser-warning', 'true');
  const modReq = new Request(event.request.url, {
    method: event.request.method,
    headers: headers,
    mode: 'cors',
    credentials: event.request.credentials
  });

  event.respondWith(
    fetch(modReq)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match('/')))
  );
});

