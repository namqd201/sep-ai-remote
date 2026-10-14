// Service Worker for Sếp AI Remote PWA
const CACHE_NAME = 'sep-ai-remote-v6';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/manifest.json?v=3',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/app-avatar.png',
  '/favicon.png'
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

// Lắng nghe yêu cầu hiển thị thông báo hệ thống khi đang ở app khác / màn hình khóa
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, ttsText } = event.data;
    event.waitUntil(
      self.registration.showNotification(title || '🎉 Sếp AI: Đã xong việc!', {
        body: body || 'Antigravity đã hoàn thành task của Sếp.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [250, 100, 250, 100, 500],
        tag: 'sep-ai-task-notification',
        renotify: true,
        data: {
          url: '/',
          ttsText: ttsText
        },
        actions: [
          { action: 'play_voice', title: '🔊 Nghe báo cáo' },
          { action: 'open_app', title: '📱 Mở Sếp AI' }
        ]
      })
    );
  }
});

// Xử lý khi Sếp bấm vào thông báo trên màn hình khóa hoặc thanh trạng thái
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ttsText = event.notification.data?.ttsText || '';
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu có sẵn tab Sếp AI đang chạy ngầm, kích hoạt tab và phát giọng nói
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (ttsText) {
            client.postMessage({ type: 'PLAY_TTS', text: ttsText });
          }
          return;
        }
      }
      // Nếu app bị đóng hẳn, mở tab mới với tham số phát âm thanh tự động
      if (clients.openWindow) {
        const targetUrl = ttsText ? `${urlToOpen}?autoPlayText=${encodeURIComponent(ttsText)}` : urlToOpen;
        return clients.openWindow(targetUrl);
      }
    })
  );
});
