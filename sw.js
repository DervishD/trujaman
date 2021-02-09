self.addEventListener('install', async event => {
    console.debug('Installing service worker.');
});


self.addEventListener('activate', event => {
    console.debug('New service worker activated!');
});
