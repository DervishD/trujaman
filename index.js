'use strict';


// Change to 'false' in production.
let DEBUG = true;


// Helper to print a message for the end user on the main page.
// The message is added in the HTML element whose selector is 'where'.
// The message is added within a '<p>' element of class 'mark'.
function trujamanPrint (where, mark, message) {

    let theConsole = document.querySelector(where);

    // This has to be calculated BEFORE inserting the new content...
    let mustScroll = theConsole.scrollHeight - theConsole.clientHeight - theConsole.scrollTop <= 0;

    // New content is inserted at the end...
    theConsole.insertAdjacentHTML('beforeend', `<p${`${mark?` class="${mark}"`:''}`}>${message}</p>`);

    // This has to be calculated AFTER inserting the new content...
    if (mustScroll) theConsole.scrollTop = theConsole.scrollHeight - theConsole.clientHeight;
}


// Helper to print log messages to "stdlog".
function trujamanLog (message) {
    if (DEBUG) trujamanPrint('div#trujaman_stdlog', 'trujaman_logmsg', '$ ' + message);
}


// Helper to print normal messages to "stdtty".
function trujamanSay (message) {
    trujamanPrint('div#trujaman_stdtty', 'trujaman_stdmsg', message);
}


// Helper to print error messages to "stdtty" and terminate execution.
function trujamanDie (message) {
    trujamanPrint('div#trujaman_stdtty', 'trujaman_errmsg', '⚠<br>' + message);
    // One of the many ways of stopping execution. This is terse and effective.
    window.onerror=()=>true;
    throw true;
}


// Helper for add arbitrary delays, for debugging.
function trujamanSleep (milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));  // For debugging...
}


window.addEventListener('load', () => {
    // Show logging console during development.
    if (DEBUG) document.querySelector('div#trujaman_stdlog').hidden = false;

    // Feature detection
    if (!window.FileReader)  // HTML5 File API.
        trujamanDie('Lo siento, trujamán no funcionará porque el navegador no es compatible con File API.');

    if (!'serviceWorker' in navigator)   // Service workers (PWA support).
        trujamanDie('Service workers are NOT supported.')

    trujamanLog('HTML5 File API is supported.');
    trujamanLog('Service workers are supported.');
    trujamanLog(`The page has${navigator.serviceWorker.controller?'':' not'} a controller.`);

    // Show all needed page elements.
    document.querySelector('div#trujaman_fileloader').hidden = false;

    // Show version number.
    navigator.serviceWorker.ready
    .then(registration => {
        fetch('version')
        .then(response => response.text())
        .then(version => document.getElementById('trujaman_version').textContent = 'v' + version);
    });

    // Handle controller change.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', event => {
        trujamanLog('The page has a new controller.');
        if (refreshing) return;
        refreshing = true;
        trujamanSleep(1000).then(() => window.location.reload());  // Debugging only, FIXME!
    });

    // Handle PWA installation offers.
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();  // Prevent the default install handler to appear for now.
        // Indicate the PWA is installable.
        trujamanLog('PWA trujamán seems installable.');
    });

    // Register service worker.
    navigator.serviceWorker.register('sw.js')
    .then(registration => {
        trujamanLog('Successful service worker registration.')

        trujamanLog(`There is${registration.active?'':' not'} an active service worker.`);

        if (registration.waiting) trujamanLog('There is a service worker waiting.');

        // Handle state changes for new service workers, including the first one.
        registration.addEventListener('updatefound', () => {
            trujamanLog('Updated service worker found.');
            registration.installing.onstatechange = event => {
                if (event.target.state == 'installed')
                    trujamanLog('New service worker installed.');
                if (event.target.state == 'activated')
                    trujamanLog('New active service worker.');
            }
        });
    })
    .catch(error => {
        trujamanLog('Service worker registration failed with', error);  // Only for debugging, FIXME!
        console.error('Service worker registration failed with', error);
    });

    // Set up the file loader.
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