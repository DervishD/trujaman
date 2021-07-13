'use strict';

/* eslint max-classes-per-file: ["error", 2] */

// This class encapsulates the user interface.
class UI {
    /* eslint-disable max-lines-per-function, max-statements */
    constructor () {
        // For the event publish/subscribe pattern.
        // The dictionary below contains the handlers for different events.
        this.eventSubscribers = {};

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
                this.emit('processFiles', event.dataTransfer.files);
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }

        // Create new file processor with the selected file.
        this.filePicker.firstElementChild.addEventListener('change', event => {
            this.emit('processFiles', event.target.files);
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

    // Notify subscribers about an event.
    emit (event, payload) {
        this.eventSubscribers[event] && this.eventSubscribers[event](payload);
    }

    // Subscribe to an event (register a handler/callback).
    on (event, handler) {
        this.eventSubscribers[event] = handler;
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

        // First, clean and disable the user interface, by dismissing (deleting)
        // all jobs and then hiding the file picker, thus effectively disabling
        // the user interface.
        for (const job of this.jobsContainer.querySelectorAll('.job:not([hidden])')) {
            job.querySelector('.job_dismiss_button').click();
        }
        this.filePicker.hidden = true;

        // Finally, show the error on the DOM element.
        this.error.hidden = false;
        this.error.querySelector('#error_message').innerText = message;
        this.error.querySelector('#error_details').innerText = details;
    }

    // Create a job user interface element and returns a job id for it.
    createJob () {
        // Create the UI elements for the job by copying the existing template.
        // That way, this code can be more agnostic about the particular layout of the UI elements.
        const element = document.querySelector('#job_template').cloneNode(true);
        element.hidden = false;
        element.removeAttribute('id');

        // In the future, a job id may be another type entirely.
        // For now this is enough and works perfectly.
        // This variable is not strictly needed, but improves readability.
        const jobId = element;

        // A dismiss button, to delete the current job.
        element.querySelector('.job_dismiss_button').addEventListener('click', () => {
            this.emit('dismissJob', jobId);
        }, {'once': true});

        // A cancel button, to cancel the current job.
        element.querySelector('.job_cancel_button').addEventListener('click', () => {
            this.emit('cancelJob', jobId);
        });

        // A retry button, to retry the current job.
        element.querySelector('.job_retry_button').addEventListener('click', () => {
            this.emit('retryJob', jobId);
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
        return jobId;
    }

    // Remove the specified job user interface element.
    removeJob (jobId) {
        this.jobsContainer.removeChild(jobId);
    }

    // Set the file name for the specified job.
    /* eslint-disable-next-line class-methods-use-this */
    setJobFileName (jobId, fileName) {
        jobId.querySelector('.job_filename').textContent = fileName;
    }

    // Set the status (HTML) for the specified job.
    /* eslint-disable-next-line class-methods-use-this */
    setJobStatus (jobId, status) {
        jobId.querySelector('.job_status').innerHTML = status;
    }

    // Set the state for the specified job.
    /* eslint-disable-next-line class-methods-use-this */
    setJobState (jobId, state) {
        switch (state) {
        case 'processing':
            jobId.querySelector('.job_retry_button').hidden = true;
            jobId.querySelector('.job_cancel_button').hidden = false;
            break;
        case 'processed':
            jobId.querySelector('.job_cancel_button').hidden = true;
            jobId.querySelector('.job_download_dropdown').hidden = false;
            break;
        case 'cancelled':
            jobId.querySelector('.job_cancel_button').hidden = true;
            jobId.querySelector('.job_retry_button').hidden = false;
            break;
        case 'error':
            jobId.querySelector('.job_cancel_button').hidden = true;
            jobId.querySelector('.job_retry_button').hidden = true;
            jobId.querySelector('.job_download_dropdown').hidden = true;
            break;
        }
    }
}


// This class encapsulates the event handling and nearly all business logic.
class Presenter {
    /* eslint-disable max-lines-per-function */
    constructor (view) {
        this.view = view;

        // For keeping track of jobs.
        //
        // Since the Presenter has to keep a bijection map between job ids as
        // returned by the View and job ids as returned by the web worker, to
        // convert between them as needed, it would be necessary to keep two
        // different maps. BUT, since it's impossible that a View job id will
        // collide with a web worker job id, BOTH of them can be added to the
        // same Map() and that way it will work as a bijection.
        //
        // This has an additional advantage: since all ids will be in the same
        // Map(), when getting a value, if the key is a View job id the value
        // will be a web worker job id, and viceversa, without the need to have
        // two different ways of getting one kind of id from the other.
        this.jobs = new Map();

        // Subscribe to UI events.
        view.on('processFiles', this.handleProcessFiles.bind(this));
        view.on('dismissJob', this.handleDismissJob.bind(this));
        view.on('cancelJob', this.handleCancelJob.bind(this));
        view.on('retryJob', this.handleRetryJob.bind(this));

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
            let {jobId} = event.data;
            const {reply, payload} = event.data;
            console.log('Got async reply:', reply, jobId, payload);

            switch (reply) {
            case 'commandNotFound':
                this.view.showError(
                    'Se solicitó un comando en segundo plano desconocido.',
                    `El comando «${payload.command}» no existe.`
                );
                break;
            case 'jobCreated': { // Job was successfully created.
                // Create the UI element for this job.
                const newJobId = this.view.createJob();
                this.jobs.set(newJobId, jobId);
                this.jobs.set(jobId, newJobId);
                this.view.setJobFileName(newJobId, payload);
                this.processJob(jobId);
                break;
            }
            case 'jobDeleted':  // Job was successfully deleted.
                this.view.removeJob(this.jobs.get(jobId));
                this.jobs.delete(this.jobs.get(jobId));
                this.jobs.delete(jobId);
                break;
            case 'jobCancelled':  // Job was successfully cancelled.
                jobId = this.jobs.get(jobId);
                this.view.setJobStatus(jobId, 'Lectura cancelada.');
                break;
            case 'bytesLoaded':
                jobId = this.jobs.get(jobId);
                this.view.setJobStatus(jobId, `Leyendo el fichero (${payload}%).`);
                break;
            case 'fileReadOK': {  // Job was successfully processed.
                // eslint-disable-next-line no-magic-numbers
                let data = typeof payload === 'undefined' ? '××' : `0x${payload.toString(16).padStart(2, 0)}`;
                data = `<span class="monospaced">[${data}]</span>`;
                jobId = this.jobs.get(jobId);
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
                jobId = this.jobs.get(jobId);
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
        this.view.setJobState(this.jobs.get(jobId), 'processing');
        this.asyncDo('processJob', jobId);
    }

    // Process a list of files.
    handleProcessFiles (files) {
        for (let i = 0; i < files.length; i++) {
            // Create the job in the web worker.
            this.asyncDo('createJob', files[i]);
        }
    }

    // Dismiss a job.
    handleDismissJob (jobId) {
        this.asyncDo('deleteJob', this.jobs.get(jobId));
    }

    // Cancel a job.
    handleCancelJob (jobId) {
        this.view.setJobStatus(jobId, 'Cancelando el fichero…');
        this.view.setJobState(jobId, 'cancelled');
        this.asyncDo('cancelJob', this.jobs.get(jobId));
    }

    // Retry a job.
    handleRetryJob (jobId) {
        this.processJob(this.jobs.get(jobId));
    }
}


window.addEventListener('load', () => {
    // First step is setting up the user interface.
    const ui = new UI();
    new Presenter(ui);  // Register as observer of the view (UI).

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
