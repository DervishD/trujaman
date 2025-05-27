

const landingPage = '.';  // Maybe: "new URL(globalThis.registration.scope).pathname"???
const cachePrefix = `trujaman@${globalThis.registration.scope}`;
const currentCacheName = `${cachePrefix} v${version}`;
const assets = [
    landingPage,
    'index.css',
    'font_sans_r_400.woff2',
    'font_sans_r_700.woff2',
    'font_mono_r_400.woff2',
    'index.js',
    'formats.json',
    'ww.js',
    'manifest.webmanifest',
    'appicon.png',
    'favicon.ico',
];


globalThis.addEventListener('install', event => {
    console.debug(`Installing service worker v${version}`);
    event.waitUntil(
        caches.open(currentCacheName)
        .then(cache => cache.addAll(assets))
        .then(globalThis.skipWaiting())  // Brutal, but effective for now.
    );
});


globalThis.addEventListener('activate', event => {
    console.debug(`Activating service worker v${version}`);
    event.waitUntil(
        caches.keys()
        .then(keys => Promise.all(
            keys
            .filter(key => key.startsWith(cachePrefix))
            .filter(key => key !== currentCacheName)
            .map(key => caches.delete(key))
        ))
        .then(globalThis.clients.claim())  // Brutal, but effective for now.
    );
});


// A 'cache-only' caching strategy is used for now.
// This makes sure the PWA fully works when offline,
// and it's perfect for the core assets.
globalThis.addEventListener('fetch', event => {
    console.debug(`Fetch request for ${event.request.url}, ${event.request.method} method`);

    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(globalThis.location.origin)) return;

    // This is TEMPORARY!
    // This is needed to be able to test changes fast and at the same time having offline functionality.
    event.respondWith((() => fetch(event.request).catch(async () => {
        const cache = await caches.open(currentCacheName);
        const response = await cache.match(event.request);
        return response || cache.match(landingPage);
    }))());
});
