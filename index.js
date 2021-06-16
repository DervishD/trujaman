'use strict';


// Function for showing an HTML error message
// within the DOM element whose id is 'error'.
//
// The function accepts two parameters. The first one is the error message,
// preferably a one-liner explaining (tersely) the main cause of the error.
// The second one can be more verbose and contains the details of the error,
// and will be rendered differently. Usually it's the stringified version of
// the error as returned by the interpreter.
function errorize (errorMessage, errorDetails) {
    // Show the DOM element for error notifications, hide the remaining ones.
    let errorContainer = document.querySelector('#error');
    errorContainer.hidden = false;
    errorContainer.querySelector('#error_message').innerText = errorMessage;
    errorContainer.querySelector('#error_details').innerText = errorDetails;
    let element = errorContainer;
    while (element = element.nextElementSibling) element.hidden = true;
}


window.addEventListener('load', function () {
    // Show version number.
    navigator.serviceWorker.ready
    .then(() => {
        fetch('version')
        .then(response => response.text())
        .then(version => {
            let appVersion = document.querySelector('#version');
            appVersion.hidden = false;
            appVersion.textContent += 'v' + version;
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
        // Service workers are considered site data ('cookies'...), so cookies
        // have to be enabled for the application to work. If cookies are not
        // enabled, that's probably the reason why the service worker cannot be
        // registered. If they are, in fact, enabled, the reason is different
        // and a generic error message is displayed instead.
        errorize(navigator.cookieEnabled ? 'Falló una parte esencial.' : 'Las cookies están desactivadas.' , error);
        return Promise.reject(null);
    })
    // Service worker successfully registered, proceed with setting up the app.
    .then(() => fetch('formats.json'))
    .then(response => response.json().catch(error => {
        errorize('No se pudo procesar la lista de formatos.', error);
        return Promise.reject(null);
    }))
    .then(formats => {  // Set up the core of the application and the UI.
        // Update job template with the list of formats.
        const formatListTemplate = document.querySelector('#job_template .job_formats_list');
        for (const format in formats) {
            let aParagraph = document.createElement('p');
            aParagraph.innerText = format;
            formatListTemplate.appendChild(aParagraph);
        }

        // Set up file picker.
        const filePicker = document.querySelector('#filepicker');
        filePicker.hidden = false;
        filePicker.querySelector('#filepicker > button').addEventListener('click', () => {
            // Propagate the click.
            filePicker.querySelector('#filepicker > input').click();
        });

        // Set up web worker.
        const webWorker = new WebWorker('ww.js');

        // Show jobs container.
        const jobsContainer = document.querySelector('#jobs');
        jobsContainer.hidden = false;

        // Function to create a bunch of jobs.
        const createJobs = function (iterable) {
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
                const jobId = `${iterable[i].name}_${iterable[i].size}_${iterable[i].lastModified}`;

                // Do not add duplicate jobs, using the previously calculated hash.
                let existingJobs = Array.from(document.querySelectorAll('.job_id').values());
                existingJobs = existingJobs.map(element => element.textContent);
                if (existingJobs.includes(jobId)) continue;

                // Create a new job.
                file.readFile = () => webWorker.do('readFile', file);
                file.abortRead = () => webWorker.do('abortRead', file);
                file.forgetFile = () => webWorker.do('forgetFile', file);
                const newJob = new Job(file);

                // Store the job id.
                newJob.element.querySelector('.job_id').textContent = jobId;

                // Add the job to the web page.
                jobsContainer.appendChild(newJob.element);
            }
        }

        // If the browser supports file drag and drop, enable it for creating jobs.
        // This is not tested in feature detection because this is entirely optional.
        if (('draggable' in filePicker) || ('ondragstart' in filePicker && 'ondrop' in filePicker)) {
            const dropzone = document.querySelector('#dropzone');
            dropzone.dataset.state = 'hidden';
            dropzone.hidden = false;

            // This is needed because the drag and drop overlay is HIDDEN, so it wouldn't get the event.
            window.ondragenter = () => dropzone.dataset.state = 'visible';

            // Prevent the browser from opening the file.
            dropzone.ondragenter = event => event.preventDefault();  // FIXME: is this needed?
            dropzone.ondragover = event => event.preventDefault();

            // Hide the drag and drop overlay if the user didn't drop the file.
            dropzone.ondragleave = () => dropzone.dataset.state = 'hidden';

            dropzone.ondrop = event => {
                event.preventDefault();  // Prevent the browser from opening the file.
                dropzone.dataset.state = 'dismissed';
                createJobs(event.dataTransfer.files);
            };
        }

        // Create new file processor with the selected file.
        filePicker.firstElementChild.addEventListener('change', event => {
            // Create the needed jobs.
            createJobs(event.target.files);
            // Or the event won't be fired again if the user selects the same file...
            event.target.value = null;
        });
    })
    .catch(error => {  // For unhandled errors.
        if (error === null) return;
        errorize('Se produjo un error inesperado.', error);
    });
});


// This class encapsulates the web worker for background tasks.
class WebWorker {
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
            errorize('No se pueden ejecutar tareas en segundo plano.', details);
        }

        // This handles responses from the web worker.
        this.worker.addEventListener('message', event => {
            const {id, status, payload} = event.data;

            // Internal error in web worker.
            if (status === null) {
                const details = `${payload.message} «${payload.command}».`;
                errorize('No existe el comando en segundo plano solicitado.', details);
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
class Job {
    constructor (file) {
        this.file = file;

        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        this.element = document.querySelector('#job_template').cloneNode(true);
        this.element.hidden = false;
        this.element.removeAttribute('id');
        this.element.querySelector('.job_filename').textContent = this.file.name;

        // A status area, to keep the end user informed.
        this.status = this.element.querySelector('.job_status');

        // A cancel button, to cancel current loading operation.
        this.cancelButton = this.element.querySelector('.job_cancel_button');
        this.cancelButton.onclick = () => {
            this.file.abortRead()
            .then(() => {
                this.cancelButton.hidden = true;
                this.retryButton.hidden = false;
                this.status.textContent = 'Lectura cancelada.';
            });
        }

        // A retry button, to retry current loading operation, if previously aborted.
        this.retryButton = this.element.querySelector('.job_retry_button');
        this.retryButton.onclick = () => this.readFile();

        // A dropdown control, to choose the download format from a list.
        this.formatsList = this.element.querySelector('.job_formats_list');
        this.downloadDropdown = this.element.querySelector('.job_download_dropdown');
        this.downloadDropdown.onclick = () => this.formatsList.hidden = !this.formatsList.hidden;

        // A dismiss button, to delete the current job.
        this.element.querySelector('.job_dismiss_button').addEventListener('click', event => {
            // Remove job UI element.
            const currentJob = event.target.closest('.job');
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
        this.status.textContent = 'Leyendo el fichero…';
        // Do the actual file read.
        this.file.readFile()
        .then(payload => {
            this.cancelButton.hidden = true;
            payload = payload ? `0x${payload.toString(16)}` : '××';
            payload = `<span class="monospaced">[${payload}]</span>`;
            this.status.innerHTML = `El fichero se leyó correctamente. ${payload}`;
            this.downloadDropdown.hidden = false;
        })
        .then(() => this.file.forgetFile())  // For cleaning up no longer needed resources.
        .catch(error => {
            // Something went wrong.
            this.cancelButton.hidden = true;
            let errorMessage = 'ERROR: ';
            switch (error.name) {
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
                    // So, it is notified differently, by using errorize().
                    return errorize(
                        'Ocurrió un error inesperado leyendo un fichero.',
                        `Ocurrió un error «${error.name}» leyendo el fichero «${error.fileName}».\n${error.message}.`
                    );
            }
            this.status.innerHTML = `${errorMessage} <span class="monospaced">(${error.name})</span>.`;
        });
    }
}