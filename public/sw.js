// AIM-8 Sonic Studio — Service Worker
const CACHE_NAME = 'aim8-v1';
const OFFLINE_URL = '/offline.html';

// App shell files to cache on install
const APP_SHELL = [
    '/',
    '/index.html',
    '/index.css',
    '/offline.html',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// Install — cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL).catch(() => {
                // Some files might not exist yet, that's ok
                return cache.addAll(['/']);
            });
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch — network first with cache fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and external API calls
    if (request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;

    // For navigation, try network first
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match(OFFLINE_URL) || caches.match('/');
            })
        );
        return;
    }

    // For assets, use stale-while-revalidate
    event.respondWith(
        caches.match(request).then((cached) => {
            const fetchPromise = fetch(request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});

// Push notification handler
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title = data.notification?.title || 'AIM·8 Sonic Studio';
    const options = {
        body: data.notification?.body || 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: { url: data.fcmOptions?.link || '/' },
        actions: [{ action: 'open', title: 'Open' }],
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window' }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(url) && 'focus' in client) return client.focus();
            }
            return self.clients.openWindow(url);
        })
    );
});
