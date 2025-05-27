globalThis.importScripts('./version.js');  /* global version */
globalThis.importScripts('./contracts.js');  /* global serviceWorkerCommands, serviceWorkerReplies */
globalThis.importScripts('./assets.js');  /* global assets */

const landingPage = '.';  // Maybe: "new URL(globalThis.registration.scope).pathname"???
const serviceWorkerVersion = version.semver;
const currentCacheName = `v${serviceWorkerVersion}`;


function cacheAssets(cacheName) {
    return caches.open(cacheName).then(cache => cache.addAll(assets))
}


function deleteOldCaches(lastCacheName) {
    return caches.keys()
    .then(cacheNames => Promise.all(
        cacheNames
        .filter(cacheName => cacheName !== lastCacheName)
        .map(cacheName => caches.delete(cacheName))
    ));
}


globalThis.addEventListener('message', event => {
    if (event.data.command === serviceWorkerCommands.getVersion) {
        event.source.postMessage({reply: serviceWorkerReplies.versionReported, payload: version});
    }
});


globalThis.addEventListener('install', event => {
    console.debug(`Installing service worker ${serviceWorkerVersion}`);
    event.waitUntil(cacheAssets(currentCacheName).then(globalThis.skipWaiting()));
    // Brutal, but effective for now.
});


globalThis.addEventListener('activate', event => {
    console.debug(`Activating service worker ${serviceWorkerVersion}`);
    event.waitUntil(deleteOldCaches(currentCacheName).then(globalThis.clients.claim()));
    // Brutal, but effective for now.
});


// A 'cache-only' caching strategy is used for now.
// This makes sure the PWA fully works when offline,
// and it's perfect for the core assets.
globalThis.addEventListener('fetch', event => {
    console.debug(`Fetch request for ${event.request.url}, ${event.request.method} method`);

    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(globalThis.location.origin)) return;

    caches.open(currentCacheName).then(cache =>
        cache.match(event.request).then(response => {
            if (response) {
                console.debug(`Cached response found for ${event.request.url}`);
            } else {
                console.debug(`Retrieving ${event.request.url} from network`);
                cache.keys().then(keys => {
                    console.debug('Cached assets:\n%o', keys);
                });
            }
        })
    );

    // This is TEMPORARY!
    // This is needed to be able to test changes fast and at the same time having offline functionality.
    event.respondWith((() => fetch(event.request).catch(async () => {
        const cache = await caches.open(currentCacheName);
        const response = await cache.match(event.request);
        return response || cache.match(landingPage);
    }))());
});
