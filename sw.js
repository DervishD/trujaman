self.addEventListener('install', async event => {
    console.debug('Installing service worker.');
    event.waitUntil(self.skipWaiting());  // Brutal, but effective for now.
});

self.addEventListener('activate', event => {
    console.debug('New service worker activated!');
    event.waitUntil(self.clients.claim());  // Brutal, but effective for now.
});


// As a first step, a 'pass-through' fetch handler is implemented.
// This is ABSOLUTELY discouraged, for a whole variety of reasons, but here it's just used as a starting point.
self.addEventListener('fetch', event => {
    console.debug('Fetching', event.request.url);
    event.respondWith(fetch(event.request));
});