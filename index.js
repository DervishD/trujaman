'use strict';


// Helper to print a message ("say things") on the main page, within the "console" HTML element.
function trujamanSay (...things) {
    let message = things.reduce((output, thing) => {
        if (typeof thing === "object" && thing.toString === Object.prototype.toString)
            thing = JSON.stringify(thing);
        return output + thing + ' ';
    }, '').trim();

    let trujamanConsole = document.getElementById('trujaman_console');

    // This has to be calculated BEFORE inserting the new content...
    let mustScroll = trujamanConsole.scrollHeight - trujamanConsole.clientHeight - trujamanConsole.scrollTop <= 0;

    trujamanConsole.insertAdjacentHTML('beforeend', `<p>· ${message}</p>`);

    if (mustScroll) {
        // This has to be calculated AFTER inserting the new content...
        trujamanConsole.scrollTop = trujamanConsole.scrollHeight - trujamanConsole.clientHeight;
    }
}


// Helper for add arbitrary delays, for debugging.
function trujamanSleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));  // For debugging...
}


// Register service worker.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        trujamanSay('Service workers are supported.');

        // Indicate wether the page is currently controlled or not.
        trujamanSay(`The page has${navigator.serviceWorker.controller?'':' not'} a controller.`);

        navigator.serviceWorker.ready
        .then(registration => {
            fetch('version')
            .then(response => response.text())
            .then(version => document.getElementById('trujaman_version').textContent = 'v' + version);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', event => {
            trujamanSay('The page has a new controller.');
            if (refreshing) return;
            refreshing = true;
            trujamanSleep(1000).then(() => window.location.reload());  // Debugging only, FIXME!
        });

        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();  // Prevent the default install handler to appear for now.
            // Indicate the PWA is installable.
            trujamanSay('PWA trujamán seems installable.');
        });

        navigator.serviceWorker.register('sw.js')
        .then(registration => {
            trujamanSay('Successful service worker registration.')

            trujamanSay(`There is${registration.active?'':' not'} an active service worker.`);

            if (registration.waiting) trujamanSay('There is a service worker waiting.');

            // Handle state changes for new service workers, including the first one.
            registration.addEventListener('updatefound', () => {
                trujamanSay('Updated service worker found.');
                registration.installing.onstatechange = event => {
                    if (event.target.state == 'installed')
                        trujamanSay('New service worker installed.');
                    if (event.target.state == 'activated')
                        trujamanSay('New active service worker.');
                }
            });
        })
        .catch(error => {
            trujamanSay('Service worker registration failed with', error);  // Only for debugging, FIXME!
            console.error('Service worker registration failed with', error);
        });

        let theInput = document.getElementsByTagName('input')[0];
        let theButton = document.getElementsByTagName('button')[0];

        theInput.addEventListener('change', event => {
            theButton.innerText += ' ' + event.target.files[0].name;
        });

        theButton.addEventListener('click', () => {
            console.debug('Conversion requested of file', theInput.files[0]);
        });
    });
} else {
    // Indicate that there's no service worker (PWA) support.
    window.addEventListener('load', () => trujamanSay('Service workers are NOT supported.'));
}