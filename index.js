'use strict';

/* eslint max-classes-per-file: ["error", 2] */

// This class encapsulates the user interface.
class UI {
    /* eslint-disable max-lines-per-function, max-statements */
    constructor () {
        // No observer wired right now.
        this.observer = null;

        // For keeping track of jobs. Indexed by job id.
        this.jobs = new Map();

        // Set up the file picker.
        this.filePicker = document.querySelector('#filepicker');
        this.filePicker.hidden = false;
        this.filePicker.querySelector('button').addEventListener('click', () => {
            this.filePicker.querySelector('input').click();  // Propagate the click.
        });

        // If the browser supports file drag and drop, enable it.
        //
        // This is entirely optional, and detection is performed by testing for
        // the existence of the drag and drop events used. This is not orthodox
        // but works for the needs of the application.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in window)) {
            const dropzone = document.querySelector('#dropzone');

            // Yes, this makes sense. The first statement enables the drop zone,
            // so it can work. The second sets the initial state as not visible.
            // That is, the drop zone ends up being active but not visible.
            dropzone.hidden = false;
            dropzone.dataset.state = 'hidden';

            // This is needed because the drag and drop overlay is HIDDEN, so it wouldn't get the event.
            window.addEventListener('dragenter', () => { dropzone.dataset.state = 'visible'; });

            // Prevent the browser from opening the file.
            dropzone.addEventListener('dragover', event => { event.preventDefault(); });

            // Hide the drag and drop overlay if the user didn't drop the file.
            dropzone.addEventListener('dragleave', () => { dropzone.dataset.state = 'hidden'; });

            dropzone.addEventListener('drop', event => {
                dropzone.dataset.state = 'dismissed';
                this.sendEvent('processFiles', event.dataTransfer.files);
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }

        // Create new file processor with the selected file.
        this.filePicker.firstElementChild.addEventListener('change', event => {
            this.sendEvent('processFiles', event.target.files);
            // Or the event won't be fired again if the user selects the same file...
            event.target.value = null;
        });

        // Show jobs container.
        this.jobsContainer = document.querySelector('#jobs');
        this.jobsContainer.hidden = false;

        // Store references to some DOM elements for later use.
        this.version = document.querySelector('#version');
        this.error = document.querySelector('#error');
    }
    /* eslint-enable max-lines-per-function, max-statements */

    // Send event to observer, if any.
    sendEvent (event, payload) {
        this.observer && this.observer.handleEvent(event, payload);
    }

    // Show version code on proper DOM element.
    showVersion (version) {
        this.version.hidden = false;
        this.version.textContent += `v${version}`;
    }

    // Show HTML error message on proper DOM element.
    //
    // The function accepts two parameters. The first one is the error message,
    // preferably a one-liner explaining (tersely) the main cause of the error.
    // The second one can be more verbose and contains the details of the error,
    // and will be rendered differently. Usually it's the stringified version of
    // the error as returned by the interpreter.
    showError (message, details) {
        // Don't overwrite currently shown message.
        if (!this.error.hidden) return;

        // First, clean and disable the user interface.
        for (const jobId of this.jobs.keys()) this.sendEvent('dismissJob', jobId); // Dismiss (delete) all jobs.
        this.filePicker.hidden = true;  // Hide the file picker, thus disabling the user interface.

        // Finally, show the error on the DOM element.
        this.error.hidden = false;
        this.error.querySelector('#error_message').innerText = message;
        this.error.querySelector('#error_details').innerText = details;
    }

    // Create a job user interface element with the specified job id.
    createJob (jobId) {
        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        const element = document.querySelector('#job_template').cloneNode(true);
        element.hidden = false;
        element.removeAttribute('id');

        // A dismiss button, to delete the current job.
        element.querySelector('.job_dismiss_button').addEventListener('click', () => {
            this.sendEvent('dismissJob', jobId);
        }, {'once': true});

        // A cancel button, to cancel the current job.
        element.querySelector('.job_cancel_button').addEventListener('click', () => {
            this.sendEvent('cancelJob', jobId);
        });

        // A retry button, to retry the current job.
        element.querySelector('.job_retry_button').addEventListener('click', () => {
            this.sendEvent('retryJob', jobId);
        });

        // A dropdown control, to choose the download format from a list.
        element.querySelector('.job_download_dropdown').addEventListener('click', () => {
            const formatsList = element.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        });

        // // For testing purposes.
        // element.querySelector('.job_filename').addEventListener('click', () => {
        //     this.sendEvent('processJob', jobId);
        // });

        this.jobsContainer.appendChild(element);
        this.jobs.set(jobId, element);
    }

    // Remove the job user interface element with the specified job id.
    removeJob (jobId) {
        this.jobsContainer.removeChild(this.jobs.get(jobId));
        this.jobs.delete(jobId);
    }

    // Set the file name for the specified job id.
    setJobFileName (jobId, fileName) {
        const job = this.jobs.get(jobId);
        job.querySelector('.job_filename').textContent = fileName;
    }

    // Set the status (HTML) for the specified job id.
    setJobStatus (jobId, status) {
        const job = this.jobs.get(jobId);
        job.querySelector('.job_status').innerHTML = status;
    }

    // Set the state for the specified job id.
    // A job can be in the following states:
    setJobState (jobId, state) {
        const job = this.jobs.get(jobId);
        switch (state) {
        case 'processing':
            job.querySelector('.job_retry_button').hidden = true;
            job.querySelector('.job_cancel_button').hidden = false;
            break;
        case 'processed':
            job.querySelector('.job_cancel_button').hidden = true;
            job.querySelector('.job_download_dropdown').hidden = false;
            break;
        case 'cancelled':
            job.querySelector('.job_cancel_button').hidden = true;
            job.querySelector('.job_retry_button').hidden = false;
            break;
        case 'error':
            job.querySelector('.job_cancel_button').hidden = true;
            job.querySelector('.job_retry_button').hidden = true;
            job.querySelector('.job_download_dropdown').hidden = true;
            break;
        }
    }
}


// This class encapsulates the event handling and nearly all business logic.
class Presenter {
    /* eslint-disable max-lines-per-function */
    constructor (view) {
        this.view = view;

        // Set up web worker.
        this.worker = new Worker('ww.js');

        // This error handler for the web worker only handles loading errors and syntax errors.
        this.worker.addEventListener('error', event => {
            if (event instanceof ErrorEvent) {
                // For syntax errors, that should not happen in production,
                // the event will be an ErrorEvent instance and will contain
                // information pertaining to the error.
                this.view.showError(
                    'Error inesperado en el gestor de tareas en segundo plano.',
                    `Error de sintaxis en línea ${event.lineno}\n(${event.message}).`
                );
            } else {
                // For loading errors the event will be Event.
                this.view.showError(
                    'No se pueden ejecutar tareas en segundo plano.',
                    'No se pudo iniciar el gestor de tareas en segundo plano.'
                );
            }
            // Prevent further processing of the event.
            event.preventDefault();
        });

        // This handles responses from the web worker.
        /* eslint-disable max-statements */
        this.worker.addEventListener('message', event => {
            const {reply, jobId, payload} = event.data;
            console.log('Got async reply:', reply, jobId, payload);

            switch (reply) {
            case 'commandNotFound':
                this.view.showError(
                    'Se solicitó un comando en segundo plano desconocido.',
                    `El comando «${payload.command}» no existe.`
                );
                break;
            case 'jobCreated':  // Job was successfully created.
                // Create the UI element for this job.
                this.view.createJob(jobId);
                this.view.setJobFileName(jobId, payload);
                this.processJob(jobId);
                break;
            case 'jobDeleted':  // Job was successfully deleted.
                this.view.removeJob(jobId);
                break;
            case 'jobCancelled':  // Job was successfully cancelled.
                this.view.setJobStatus(jobId, 'Lectura cancelada.');
                break;
            case 'fileReadOK': {  // Job was successfully processed.
                // eslint-disable-next-line no-magic-numbers
                const data = `<span class="monospaced">[${payload ? `0x${payload.toString(16)}` : '××'}]</span>`;
                this.view.setJobStatus(jobId, `El fichero se leyó correctamente. ${data}`);
                this.view.setJobState(jobId, 'processed');
                break;
            }
            case 'fileReadError': {
                const error = payload;
                const errorMessages = {
                    'FileTooLargeError': 'el fichero es muy grande',
                    'NotFoundError': 'el fichero no existe',
                    'NotReadableError': 'el fichero no tiene permisos de lectura',
                    'SecurityError': 'el fichero no se puede leer de forma segura'
                };
                this.view.setJobState(jobId, 'error');
                if (error.name in errorMessages) {
                    let status = `ERROR: ${errorMessages[error.name]}`;
                    status += ` <span class="monospaced">(${error.name})</span>.`;
                    this.view.setJobStatus(jobId, status);
                } else {
                    // Unexpected error condition that should not happen in production.
                    // So, it is notified differently, by using view.showError().
                    this.view.showError(
                        'Ocurrió un error inesperado leyendo un fichero.',
                        `Ocurrió un error «${error.name}» leyendo el fichero «${error.fileName}».\n` +
                        `${error.message}.`
                    );
                }
                break;
            }
            }
        });
        /* eslint-disable max-statements */
    }

    // Handle events received from view.
    handleEvent (event, payload) {
        // This is a bit unorthodox, because a real event handling mechanism is
        // not used, but for this application needs this is enough and it works.
        // Right now, a full featured event handling system, like the one which
        // EventTarget provides, would be overkill.
        this[event](payload);
    }

    // Process a list of files.
    processFiles (files) {
        for (let i = 0; i < files.length; i++) {
            // Create the job in the web worker.
            this.asyncDo('createJob', files[i]);
        }
    }

    // Do an operation (command) asynchronously, by sending it to the web worker.
    asyncDo (command, args) {
        this.worker.postMessage({
            command,
            args
        });
    }

    // Process a job.
    processJob (jobId) {
        this.view.setJobStatus(jobId, 'Leyendo el fichero…');
        this.view.setJobState(jobId, 'processing');
        this.asyncDo('processJob', jobId);
    }

    // Cancel a job.
    cancelJob (jobId) {
        this.view.setJobStatus(jobId, 'Cancelando el fichero…');
        this.view.setJobState(jobId, 'cancelled');
        this.asyncDo('cancelJob', jobId);
    }

    // Retry a job.
    retryJob (jobId) {
        this.processJob(jobId);
    }

    // Dismiss a job.
    dismissJob (jobId) {
        this.asyncDo('deleteJob', jobId);
    }
}


window.addEventListener('load', () => {
    // First step is setting up the user interface.
    const ui = new UI();
    ui.observer = new Presenter(ui);  // Register as observer of the view (UI).

    // Show version number.
    navigator.serviceWorker.ready
    .then(() => {
        fetch('version')
        .then(response => response.text())
        .then(version => version && ui.showVersion(version));
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
        ui.showError(navigator.cookieEnabled ? 'Falló una parte esencial.' : 'Las cookies están desactivadas.', error);
        return Promise.reject(new Error('BreakPromiseChainError'));  // To break the Promise chain.
    })
    // Service worker successfully registered, proceed with setting up the app.
    .then(() => fetch('formats.json'))
    .then(response => response.json().catch(error => {
        ui.showError('No se pudo procesar la lista de formatos.', error);
        return Promise.reject(new Error('BreakPromiseChainError'));  // To break the Promise chain.
    }))
    .then(formats => {  // Set up the core of the application and the UI.
        // Update job template with the list of formats.
        const formatListTemplate = document.querySelector('#job_template .job_formats_list');
        for (const format in formats) {
            const aParagraph = document.createElement('p');
            aParagraph.innerText = format;
            formatListTemplate.appendChild(aParagraph);
        }
    })
    .catch(error => {  // For unhandled errors.
        if (error === 'BreakPromiseChainError') return;
        ui.showError('Se produjo un error inesperado.', error);
    });
});
