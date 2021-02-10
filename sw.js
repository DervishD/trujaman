self.addEventListener('install', async event => {
    console.debug('Installing service worker.');
    event.waitUntil(self.skipWaiting());  // Brutal, but effective for now.
});

self.addEventListener('activate', event => {
    console.debug('New service worker activated!');
    event.waitUntil(self.clients.claim());  // Brutal, but effective for now.
});

self.addEventListener('fetch', () => {});  // Just a placeholder for now.