'use strict';


// Helper to print a debugging message within the "console" element of the main page.
function trujamanDebug (...things) {
    let message = things.reduce((output, thing) => {
        if (typeof thing === "object" && thing.toString === Object.prototype.toString)
            thing = JSON.stringify(thing);
        return output + thing + ' ';
    }, '').trim();

    let trujamanConsole = document.getElementById('trujaman_console');

    // This has to be calculated BEFORE inserting the new content...
    let mustScroll = trujamanConsole.scrollHeight - trujamanConsole.clientHeight - trujamanConsole.scrollTop <= 0;

    trujamanConsole.insertAdjacentHTML('beforeend', `<p>> ${message}</p>`);

    if (mustScroll) {
        // This has to be calculated AFTER inserting the new content...
        trujamanConsole.scrollTop = trujamanConsole.scrollHeight - trujamanConsole.clientHeight;
    }
}


// Helper for add arbitrary delays, for debugging.
function trujamanSleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));  // For debugging...
}


if (window.FileReader) {
    window.addEventListener('load', () => {
        // Show all needed page elements.
        document.querySelector('div#trujaman_fileloader').hidden = false;
        document.querySelector('div#trujaman_console').hidden = false;
        trujamanDebug('HTML5 File API is supported.');
    } else {
        document.querySelector('p#noFileAPI').hidden = false;
    });
    window.onerror = () => true;
    throw true;
}


// Register service worker.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        trujamanDebug('Service workers are supported.');

        // Indicate wether the page is currently controlled or not.
        trujamanDebug(`The page has${navigator.serviceWorker.controller?'':' not'} a controller.`);

        navigator.serviceWorker.ready
        .then(registration => {
            fetch('version')
            .then(response => response.text())
            .then(version => document.getElementById('trujaman_version').textContent = 'v' + version);
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', event => {
            trujamanDebug('The page has a new controller.');
            if (refreshing) return;
            refreshing = true;
            trujamanSleep(1000).then(() => window.location.reload());  // Debugging only, FIXME!
        });

        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();  // Prevent the default install handler to appear for now.
            // Indicate the PWA is installable.
            trujamanDebug('PWA trujamán seems installable.');
        });

        navigator.serviceWorker.register('sw.js')
        .then(registration => {
            trujamanDebug('Successful service worker registration.')

            trujamanDebug(`There is${registration.active?'':' not'} an active service worker.`);

            if (registration.waiting) trujamanDebug('There is a service worker waiting.');

            // Handle state changes for new service workers, including the first one.
            registration.addEventListener('updatefound', () => {
                trujamanDebug('Updated service worker found.');
                registration.installing.onstatechange = event => {
                    if (event.target.state == 'installed')
                        trujamanDebug('New service worker installed.');
                    if (event.target.state == 'activated')
                        trujamanDebug('New active service worker.');
                }
            });
        })
        .catch(error => {
            trujamanDebug('Service worker registration failed with', error);  // Only for debugging, FIXME!
            console.error('Service worker registration failed with', error);
        });

        let theInput = document.getElementsByTagName('input')[0];
        let theBrowseButton = document.querySelector('button#trujaman_browse');
        let theConvertButton = document.querySelector('button#trujaman_convert');

        theInput.addEventListener('change', event => {
            theConvertButton.disabled = false;
            theConvertButton.firstElementChild.innerText = `«${event.target.files[0].name}»`;
            theConvertButton.focus();
        });

        theBrowseButton.addEventListener('click', event => {
            theInput.click(event);
        });

        theConvertButton.addEventListener('click', event => {
            console.log('Must convert, aaagh.');
        });
    });
} else {
    // Indicate that there's no service worker (PWA) support.
    window.addEventListener('load', () => trujamanDebug('Service workers are NOT supported.'));
}