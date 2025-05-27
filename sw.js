globalThis.importScripts('./version.js');  /* global version */
globalThis.importScripts('./contracts.js');  /* global serviceWorkerCommands, serviceWorkerReplies */


const landingPage = '.';  // Maybe: "new URL(globalThis.registration.scope).pathname"???
const cachePrefix = `trujaman@${globalThis.registration.scope}`;


globalThis.addEventListener('message', event => {
    if (event.data.command === serviceWorkerCommands.getVersion) {
        event.source.postMessage({reply: serviceWorkerReplies.versionReported, payload: version});
    }
});


globalThis.addEventListener('install', event => {
    console.debug(`Installing service worker v${version.tag}`);
});


globalThis.addEventListener('activate', event => {
    console.debug(`Activating service worker v${version.tag}`);
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
