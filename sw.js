const trujaman = {
    staticCache: 'trujaman-v0',
}

// Precache assets and take control (for now)
self.addEventListener('install', event => {
    console.debug('Installing service worker.');
    self.skipWaiting();  // Brutal, but effective for now.
    event.waitUntil(
        caches.open(trujaman.staticCache).then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/index.css',
                '/index.js',
                '/manifest.json',
                '/appicon.png',
                '/favicon.ico',
          ]);
        }),
    );
});

self.addEventListener('activate', event => {
    console.debug('New service worker activated!');
    event.waitUntil(self.clients.claim());  // Brutal, but effective for now.
});


// As a first step, a 'pass-through' fetch handler is implemented.
// This is ABSOLUTELY discouraged, for a whole variety of reasons, but here it's just used as a starting point.
self.addEventListener('fetch', event => {
    console.debug('Fetching', event.request.url);
    event.respondWith(
        caches.open(trujaman.staticCache).then(cache =>
            cache.match(event.request).then(response => {
                // For now, just detect uncached assets, but always fetch from network.
                if (!response) console.error('UNCACHED request for', event.request.url);
                return fetch(event.request);
            })
        )
    );
});