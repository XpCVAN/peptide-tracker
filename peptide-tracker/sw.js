const CACHE_NAME = 'peptai-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/icon-192.png',
    '/icon-512.png'
];

// ============ INSTALL ============
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// ============ ACTIVATE ============
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ============ FETCH (Network-first, cache fallback) ============
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('generativelanguage.googleapis.com')) return;
    if (event.request.url.includes('fonts.googleapis.com')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// ============ NOTIFICATIONS from app ============
// The app sends a message to the SW to show a notification.
// This lets the notification fire even if the page is in the background.
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag, icon } = event.data;
        self.registration.showNotification(title, {
            body,
            icon: icon || '/icon-192.png',
            badge: '/icon-192.png',
            tag,
            requireInteraction: false,
            vibrate: [200, 100, 200],
            data: { url: '/' }
        });
    }
});

// ============ NOTIFICATION CLICK ============
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If app is already open, focus it
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            // Otherwise open it
            return clients.openWindow('/');
        })
    );
});
