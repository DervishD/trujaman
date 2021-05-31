'use strict';


// Function for showing an HTML error message within
// the DOM element whose id is 'trujaman_error_body'.
//
// The function accepts two parameters. The first one is the error message,
// preferably a one-liner explaining (tersely) the main cause of the error.
// The second one can be more verbose and contains the details of the error,
// and will be rendered differently. Usually it's the stringified version of
// the error as returned by the interpreter.
//
// Advanced features can't be used here because this function is used by
// the feature detection system itself, and it is possible that some
// advanced feature used in this function is missing, making impossible
// to properly report the missing feature!
function trujamanError (errorMessage, errorDetails) {
    // Show the DOM element for error notifications, hide the remaining ones.
    var errorContainer = document.querySelector('#trujaman_error');
    errorContainer.hidden = false;
    errorContainer.querySelector('#trujaman_error_message').innerText = errorMessage;
    errorContainer.querySelector('#trujaman_error_details').innerText = errorDetails;
    var elementToHide = errorContainer.nextElementSibling;
    while (elementToHide) {
        elementToHide.hidden = true;
        elementToHide = elementToHide.nextElementSibling;
    }
}


// Function for getting the list of missing features.
function trujamanGetMissingFeatures () {
    // Can't use 'let' because that's still an undetected feature.
    var trujamanMissingFeatures = [];

    try {
        eval('var f = x => x');
    } catch (e) {
        trujamanMissingFeatures.push('Arrow functions');
    }

    try {
        eval('class X {}');
    } catch (e) {
        trujamanMissingFeatures.push('Classes');
    }

    try {
        eval('let x = true');
    } catch (e) {
        trujamanMissingFeatures.push('let statement');
    }

    try {
        eval('const x = true');
    } catch (e) {
        trujamanMissingFeatures.push('const statement');
    }

    try {
        eval('let x = `x`');
    } catch (e) {
        trujamanMissingFeatures.push('Template strings');
    }

    try {
        eval('function f (x=1) {}');
    } catch (e) {
        trujamanMissingFeatures.push('Default function parameters');
    }

    try {
        eval('async function f() {}');
    } catch (e) {
        trujamanMissingFeatures.push('async functions');
    }

    if (typeof Promise === 'undefined') {
        trujamanMissingFeatures.push('Promises');
    }

    if ('ArrayBuffer' in window === false) {
        trujamanMissingFeatures.push('ArrayBuffer');
    }

    if ('serviceWorker' in navigator === false) {
        trujamanMissingFeatures.push('Service workers');
    }

    if ('Worker' in window === false) {
        trujamanMissingFeatures.push('Web workers');
    }

    try {
        eval('\
            var w = new Worker(URL.createObjectURL(new Blob(["var x = null"], {type: "text/javascript"})));\
            w.onerror = function () {throw "";};\
            var b = new ArrayBuffer(1);\
            w.postMessage(b, [b]);\
            if (b.byteLength !== 0) throw "";\
            w.terminate();\
        ')
    } catch (e) {
        trujamanMissingFeatures.push('Transferables');
    }

    if (!navigator.cookieEnabled) {
        trujamanMissingFeatures.push('Cookies');
    }

    if ('caches' in window === false) {
        trujamanMissingFeatures.push('Cache storage');
    }

    if (!('File' in window && 'Blob' in window && 'FileReader' in window && 'FileList' in window)) {
        trujamanMissingFeatures.push('File API');
    }

    return trujamanMissingFeatures;
}


window.addEventListener('load', function () {
    // If there are missing features, notify the user and stop.
    const trujamanMissingFeatures = trujamanGetMissingFeatures();
    if (trujamanMissingFeatures.length) {
        // Show the list of missing features.
        var message = 'Este navegador no es compatible con:';
        var details = '';
        trujamanMissingFeatures.forEach(function (feature) {details += feature + '\n';});
        trujamanError(message, details);
        return;
    }

    // From this point on, advanced features can be used.

    // Show version number.
    navigator.serviceWorker.ready
    .then(() => {
        fetch('version')
        .then(response => response.text())
        .then(version => {
            let trujamanVersion = document.querySelector('#trujaman_version');
            trujamanVersion.hidden = false;
            trujamanVersion.textContent += 'v' + version;
        });
    });

    // Handle controller change.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    // Handle PWA installation offers.
    // For now, just prevent the default install handler to appear.
    window.addEventListener('beforeinstallprompt', event => event.preventDefault());

    // Register service worker.
    navigator.serviceWorker.register('sw.js')
    .catch(error => {
        trujamanError('Falló una parte esencial.', error);
        return Promise.reject(null);
    })
    // Service worker successfully registered, proceed with setting up the app.
    .then(() => fetch('formats.json'))
    .then(response => response.json().catch(error => {
        trujamanError('No se pudo procesar la lista de formatos.', error);
        return Promise.reject(null);
    }))
    .then(formats => {  // Set up the core of the application and the UI.
        // Update job template with the list of formats.
        const formatListTemplate = document.querySelector('#trujaman_job_template .trujaman_job_formats_list');
        for (const format in formats) {
            let aParagraph = document.createElement('p');
            aParagraph.innerText = format;
            formatListTemplate.appendChild(aParagraph);
        }

        // Set up file picker.
        const filePicker = document.querySelector('#trujaman_filepicker');
        filePicker.hidden = false;
        filePicker.querySelector('#trujaman_filepicker_button').addEventListener('click', () => {
            // Propagate the click.
            filePicker.querySelector('#trujaman_filepicker_input').click();
        });

        // Set up web worker.
        const webWorker = new TrujamanWebWorker('ww.js');

        // Show jobs container.
        const jobsContainer = document.querySelector('#trujaman_jobs');
        jobsContainer.hidden = false;

        // Function to create a bunch of jobs.
        const trujamanCreateJobs = function (iterable) {
            for (let i = 0; i < iterable.length; i++) {
                const file = iterable[i];

                // There's a problem with File objects: they don't have paths, only names.
                // So, there's no way of telling if two user-selected files are the same or not,
                // because they may have the same name but come from different directories.
                //
                // Best effort here is to create a kind of hash from the file name, the file size
                // and the last modification time. This is not bulletproof, as the user may have
                // and select to different files from different directores whose names are equal,
                // their sizes and modification times too, but still have different contents.
                //
                // Still, this minimizes the possibility of leaving the user unable to add a file
                // just because it has the same name than one previously selected, if they come
                // from different folders. The chances of both files having the exact same size
                // and modification time are quite reduced. Hopefully.
                file.hash = `${file.name}.${file.size}.${file.lastModified}`;

                // Do not add duplicate jobs, using the previously calculated hash.
                let existingJobs = Array.from(document.querySelectorAll('.trujaman_job_id').values());
                existingJobs = existingJobs.map(element => element.textContent);
                if (existingJobs.includes(file.hash)) continue;

                // Create a new job.
                file.readFile = () => webWorker.do('readFile', [file]);
                file.abortRead = () => webWorker.do('abortRead', [file]);
                file.forgetFile = () => webWorker.do('forgetFile', [file]);
                const newJob = new TrujamanJob(file);

                // Store the job id.
                newJob.element.querySelector('.trujaman_job_id').textContent = file.hash;

                // Add the job to the web page.
                jobsContainer.appendChild(newJob.element);
            }
        }

        // If the browser supports file drag and drop, enable it for creating jobs.
        // This is not tested in feature detection because this is entirely optional.
        if (('draggable' in filePicker) || ('ondragstart' in filePicker && 'ondrop' in filePicker)) {
            const theDropzone = document.querySelector('#trujaman_dropzone');
            theDropzone.dataset.state = 'hidden';
            theDropzone.hidden = false;

            // This is needed because the drag and drop overlay is HIDDEN, so it wouldn't get the event.
            window.ondragenter = () => theDropzone.dataset.state = 'visible';

            // Prevent the browser from opening the file.
            theDropzone.ondragenter = event => event.preventDefault();  // FIXME: is this needed?
            theDropzone.ondragover = event => event.preventDefault();

            // Hide the drag and drop overlay if the user didn't drop the file.
            theDropzone.ondragleave = () => theDropzone.dataset.state = 'hidden';

            theDropzone.ondrop = event => {
                event.preventDefault();  // Prevent the browser from opening the file.
                theDropzone.dataset.state = 'dismissed';
                trujamanCreateJobs(event.dataTransfer.files);
            };
        }

        // Create new file processor with the selected file.
        filePicker.firstElementChild.addEventListener('change', event => {
            // Create the needed jobs.
            trujamanCreateJobs(event.target.files);
            // Or the event won't be fired again if the user selects the same file...
            event.target.value = null;
        });
    })
    .catch(error => {  // For unhandled errors.
        if (error === null) return;
        trujamanError('Se produjo un error inesperado.', error);
    });
});


// This class encapsulates the web worker for background tasks.
class TrujamanWebWorker {
    constructor (script) {
        this.settlers = [];  // For settling the appropriate Promise for a transaction.
        this.currentId = 0;  // Current transaction identifier.

        // Create the web worker.
        this.worker = new Worker(script);

        // This error handler only handles loading errors and syntax errors.
        this.worker.onerror = event => {
            let details = '';
            if (event instanceof ErrorEvent) {
                // For syntax errors, that should not happen in production,
                // the event will be an ErrorEvent instance and will contain
                // information pertaining to the error.
                details += `Error de sintaxis en línea ${event.lineno}\n(${event.message}).`;
            } else {
                // For loading errors the event will be Event.
                details += `No se pudo iniciar el gestor de tareas en segundo plano.`;
            }
            trujamanError('No se pueden ejecutar tareas en segundo plano.', details);
        }

        // This handles responses from the web worker.
        this.worker.addEventListener('message', event => {
            const {id, status, payload} = event.data;

            // Internal error in web worker.
            if (status === null) {
                const details = `${payload.message} «${payload.data}».`;
                trujamanError('No existe el comando en segundo plano solicitado.', details);
            } else {
                // Response from web worker.
                // Settle the promise according to the returned status
                // and call the settler registered for this transaction
                // to resolve or reject the Promise.
                if (status) {
                    this.settlers[id].resolve(payload);
                } else {
                    this.settlers[id].reject(payload);
                }
            }
            // Clean callbacks that are no longer needed.
            delete this.settlers[id];
        });
    }

    // Method to execute a command on the web worker and promisify the response.
    do (command, args) {
        // This builds a new Promise around the message sent to the web worker,
        // so the replies from the web worker will settle that Promise, making
        // the asynchronous interaction code much cleaner and easier to follow.
        //
        // Commands are arbitrary, they are send as-is to the web worker.
        // If they are unimplemented the web worker will reply with an internal error.
        return new Promise((resolve, reject) => {
            // Store the Promise settlers for use inside onmessage event handler.
            this.settlers[this.currentId] = {'resolve': resolve, 'reject': reject};
            // Send message to web worker.
            this.worker.postMessage({id: this.currentId++, command: command, args: args});
        })
    }
}


// This class encapsulates the user interface for a file job.
// That includes reading the file, cancelling and retrying file reads,
// removing jobs, downloading conversion results, etc.
class TrujamanJob {
    constructor (file) {
        this.file = file;

        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        this.element = document.querySelector('#trujaman_job_template').cloneNode(true);
        this.element.hidden = false;
        this.element.removeAttribute('id');
        this.element.querySelector('.trujaman_job_filename').textContent = this.file.name;

        // A status area, to keep the end user informed.
        this.status = this.element.querySelector('.trujaman_job_status');

        // A cancel button, to cancel current loading operation.
        this.cancelButton = this.element.querySelector('.trujaman_job_cancel_button');
        this.cancelButton.onclick = () => {
            this.file.abortRead()
            .then(() => {
                this.cancelButton.hidden = true;
                this.retryButton.hidden = false;
                this.status.textContent = 'Lectura cancelada.';
            });
        }

        // A retry button, to retry current loading operation, if previously aborted.
        this.retryButton = this.element.querySelector('.trujaman_job_retry_button');
        this.retryButton.onclick = () => this.readFile();

        // A dropdown control, to choose the download format from a list.
        this.formatsList = this.element.querySelector('.trujaman_job_formats_list');
        this.downloadDropdown = this.element.querySelector('.trujaman_job_download_dropdown');
        this.downloadDropdown.onclick = () => this.formatsList.hidden = !this.formatsList.hidden;

        // A dismiss button, to delete the current job.
        this.element.querySelector('.trujaman_job_dismiss_button').addEventListener('click', event => {
            // Remove job UI element.
            const currentJob = event.target.closest('.trujaman_job');
            currentJob.parentNode.removeChild(currentJob);

            // Abort file reading, just in case, and free resources for the file.
            this.file.abortRead().then(() => this.file.forgetFile());
        }, {once: true});

        // Finally, read the file.
        this.readFile();
    }

    // Read the file associated with this job.
    readFile () {
        // Show needed UI elements.
        this.retryButton.hidden = true;
        this.cancelButton.hidden = false;
        // Do the actual file read.
        this.file.readFile()
        .then(payload => {
            this.cancelButton.hidden = true;
            this.status.textContent = `El fichero se leyó correctamente.`;
            this.downloadDropdown.hidden = false;
            console.log(new Uint8Array(payload, 0, 10));
        })
        .then(() => this.file.forgetFile())  // For cleaning up no longer needed resources.
        .catch(error => {
            // Something went wrong.
            this.cancelButton.hidden = true;
            this.retryButton.hidden = false;
            let errorMessage = 'ERROR: ';
            switch (error.name) {
                case 'AbortError':
                    errorMessage += 'lectura cancelada';
                    break;
                case 'FileTooLargeError':
                    errorMessage += 'el fichero es muy grande';
                    break;
                case 'NotFoundError':
                    errorMessage += 'el fichero no existe';
                    break;
                case 'NotReadableError':
                    errorMessage += 'el fichero no tiene permisos de lectura';
                    break;
                case 'SecurityError':
                    errorMessage += 'el fichero no se puede leer de forma segura';
                    break;
                default:
                    // Unexpected error condition that should not happen in production.
                    // So, it is notified differently, by using trujamanError.
                    let details = `Se produjo un error «${error.name}» leyendo el fichero «${error.data}».`;
                    trujamanError('Ocurrió un error inesperado leyendo un fichero.', details);
                    // Notify in the file's status area, too...
                    errorMessage += 'el fichero no pudo ser leído';
                    break;
            }
            this.status.innerHTML = `${errorMessage} <span class="trujaman_tty">(${error.name})</span>.`;
        });
    }
}