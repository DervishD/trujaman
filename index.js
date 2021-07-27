'use strict';

/* eslint max-classes-per-file: ["error", 2] */

// This class encapsulates the user interface.
class UI {
    constructor () {
        // For the event publish/subscribe pattern.
        // The dictionary below contains the handlers for different events.
        this.eventSubscribers = {};

        // For tracking the event listeners registered to each job button, so
        // they can be removed later, when the job is destroyed.
        this.jobEventListeners = new Map();

        // Store needed references to DOM elements for later use.
        this.filePicker = document.querySelector('#filepicker');
        this.jobsContainer = document.querySelector('#jobs');
        this.version = document.querySelector('#version');
        this.errorTemplate = document.querySelector('#error_template');
        this.lastError = null;
        this.formatListTemplate = document.querySelector('#job_template .job_formats_list');
    }

    // Activate and render the user interface.
    render () {
        // Set up file picker.
        this.filePicker.hidden = false;

        this.filePicker.querySelector('button').addEventListener('click', () => {
            this.filePicker.querySelector('input').click();  // Propagate the click.
        });

        // Create new file processor with the selected file.
        this.filePicker.firstElementChild.addEventListener('change', event => {
            this.emit('processFiles', event.target.files);
            // Or the event won't be fired again if the user selects the same file...
            event.target.value = null;
        });

        // Set up jobs container.
        this.jobsContainer.hidden = false;

        // Set up drag and drop support.
        this.initDragAndDrop();
    }

    // Notify subscribers about an event.
    emit (event, payload) {
        this.eventSubscribers[event] && this.eventSubscribers[event](payload);
    }

    // Subscribe to an event (register a handler/callback).
    on (event, handler) {
        this.eventSubscribers[event] = handler;
    }

    // Initialize drag and drop support, if available.
    initDragAndDrop () {
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
    }

    // Initialize the list of formats for the dropdown menu.
    initFormatList (formats) {
        for (const format in formats) {
            const paragraph = document.createElement('p');
            paragraph.innerText = format;
            this.formatListTemplate.appendChild(paragraph);
        }
    }

    // Show version code on proper DOM element.
    showVersion (version) {
        this.version.hidden = false;
        this.version.textContent += `v${version}`;
    }

    // Show a detailed error message.
    //
    // The function accepts two parameters. The first one is the error message,
    // preferably a one-liner explaining (tersely) the main cause of the error.
    // The second one can be more verbose and contains the details of the error,
    // and will be rendered differently. Usually it's the stringified version of
    // the error as returned by the interpreter.
    //
    // New DOM elements showing errors are created for each call to this function.
    showError (message, details) {
        // If no error is currently shown, dismiss (delete) all jobs and then
        // hide the file picker, thus effectively disabling the user interface.
        if (!this.lastError) {
            // Dismiss the existing jobs.
            for (const job of this.jobsContainer.querySelectorAll('.job:not([hidden])')) {
                job.querySelector('.job_dismiss_button').click();
            }
            // Disable the file picker.
            this.filePicker.hidden = true;
            // Use the hidden template as insertion point.
            this.lastError = this.errorTemplate;
        }

        // Create a new error DOM element.
        const error = this.errorTemplate.cloneNode(true);
        error.querySelector('.error_message').innerText = message;
        error.querySelector('.error_details').innerText = details;

        // Finally, show the error on the DOM element.
        // Error are shown in a first-happenned, first-shown manner.
        this.lastError.parentNode.insertBefore(error, this.lastError.nextSibling);
        error.hidden = false;
        this.lastError = error;
    }

    // Create a job user interface element and returns a job id for it.
    // eslint-disable-next-line max-statements, max-lines-per-function
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
        const handleDismissClicked = function handleDismissClicked () { this.emit('dismissJob', jobId); }.bind(this);
        const dismissButton = element.querySelector('.job_dismiss_button');
        dismissButton.addEventListener('click', handleDismissClicked, {'once': true});

        // A cancel button, to cancel the current job.
        const handleCancelClicked = function handleCancelClicked () { this.emit('cancelJob', jobId); }.bind(this);
        const cancelButton = element.querySelector('.job_cancel_button');
        cancelButton.addEventListener('click', handleCancelClicked);

        // A retry button, to retry the current job.
        const handleRetryClicked = function handleRetryClicked () { this.emit('retryJob', jobId); }.bind(this);
        const retryButton = element.querySelector('.job_retry_button');
        retryButton.addEventListener('click', handleRetryClicked);

        // A dropdown control, to choose the download format from a list.
        const handleDownloadClicked = function handleDownloadClicked () {
            const formatsList = element.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        };
        const downloadButton = element.querySelector('.job_download_dropdown');
        downloadButton.addEventListener('click', handleDownloadClicked);

        // Store event listeners so they can be removed when the job is destroyed.
        this.jobEventListeners.set(element, [
            [dismissButton, handleDismissClicked],
            [cancelButton, handleCancelClicked],
            [retryButton, handleRetryClicked],
            [downloadButton, handleDownloadClicked]
        ]);

        // // For testing purposes.
        // element.querySelector('.job_filename').addEventListener('click', () => {
        //     this.sendEvent('processJob', jobId);
        // });

        this.jobsContainer.appendChild(element);
        return jobId;
    }

    // Remove the specified job user interface element.
    removeJob (jobId) {
        // Remove event listeners first.
        // Not really needed, apparently, but it's the Tao.
        for (const [element, eventListener] of this.jobEventListeners.get(jobId)) {
            element.removeEventListener('click', eventListener);
        }
        // Then remove the DOM element.
        this.jobsContainer.removeChild(jobId);
    }

    // Set the file name for the specified job.
    // eslint-disable-next-line class-methods-use-this
    setJobFileName (jobId, fileName) {
        jobId.querySelector('.job_filename').textContent = fileName;
    }

    // Set the status (HTML) for the specified job.
    // eslint-disable-next-line class-methods-use-this
    setJobStatus (jobId, status) {
        jobId.querySelector('.job_status').innerHTML = status;
    }

    // Set the state for the specified job.
    // eslint-disable-next-line class-methods-use-this
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
    constructor () {
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
    }

    // Run the Presenter.
    async run () {
        // Show version number when service worker is ready.
        navigator.serviceWorker.ready
        .then(() => {
            fetch('version')
            .then(response => response.text())
            .then(version => version && this.view.showVersion(version));
        });

        // Handle controlling service worker change.
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });

        // Handle PWA installation offers.
        // For now, just prevent the default install handler to appear.
        window.addEventListener('beforeinstallprompt', event => event.preventDefault());

        try {
            this.initView();
            await this.initServiceWorker('sw.js');
            await this.initFormats('formats.json');
            this.initWebWorker('ww.js');
        } catch (error) {  // For handling unexpected errors.
            this.view.showError('Se produjo un error inesperado.', error);
        }
    }


    // Initialize the user interface.
    initView () {
        this.view = new UI();  // Create the user interface.

        // Subscribe to UI events.
        this.view.on('processFiles', this.handleProcessFiles.bind(this));
        this.view.on('dismissJob', this.handleDismissJob.bind(this));
        this.view.on('cancelJob', this.handleCancelJob.bind(this));
        this.view.on('retryJob', this.handleRetryJob.bind(this));

        this.view.render();  // Enable user interface.
    }

    // Activate the service worker.
    async initServiceWorker (serviceWorker) {
        try {
            await navigator.serviceWorker.register(serviceWorker);  // Register service worker.
        } catch (error) {
            // Service workers are considered site data ('cookies'...), so cookies
            // have to be enabled for the application to work. If cookies are not
            // enabled, that's probably the reason why the service worker cannot be
            // registered. If they are, in fact, enabled, the reason is different
            // and a generic error message is displayed instead.
            if (navigator.cookieEnabled) {
                this.view.showError('Falló una parte esencial.', error);
            } else {
                this.view.showError('Las cookies están desactivadas.', error);
            }
        }
    }

    // Process the format list.
    async initFormats (formatsFile) {
        try {
            const response = await fetch(formatsFile);
            if (response.ok) {
                const formats = await response.json();
                // Update job template with the list of formats.
                this.view.initFormatList(formats);
            } else {
                this.view.showError(
                    'No se encontró la lista de formatos.',
                    'El fichero conteniendo la lista de formatos no se encuentra disponible.'
                );
            }
        } catch (error) {
            this.view.showError('No se pudo procesar la lista de formatos.', error);
        }
    }

    // Initialize web worker.
    initWebWorker (webWorker) {
        this.worker = new Worker(webWorker);

        // This error handler for the web worker only handles loading errors and syntax errors.
        this.worker.addEventListener('error', event => this.handleWebWorkerError(event));

        // This handles responses from the web worker.
        this.worker.addEventListener('message', event => this.handleWebWorkerMessages(event.data));
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

    // Handle loading and syntax errors from the web worker.
    handleWebWorkerError (error) {
        if (error instanceof ErrorEvent) {
            // For syntax errors, that should not happen in production,
            // the event will be an ErrorEvent instance and will contain
            // information pertaining to the error.
            this.view.showError(
                'Error inesperado en el gestor de tareas en segundo plano.',
                `Error de sintaxis en línea ${error.lineno}\n(${error.message}).`
            );
        } else {
            // For loading errors the event will be Event.
            this.view.showError(
                'No se pueden ejecutar tareas en segundo plano.',
                'No se pudo iniciar el gestor de tareas en segundo plano.'
            );
        }
        // Prevent further processing of the event.
        error.preventDefault();
    }

    handleWebWorkerMessages (message) {
        const {reply, jobId, payload} = message;
        console.log('Got async reply:', reply, jobId, payload);

        // eslint-disable-next-line no-magic-numbers
        const handler = `handle${reply[0].toUpperCase()}${reply.slice(1)}`;
        if (handler in this) {
            this[handler](jobId, payload);
        } else {
            this.view.showError(
                'Se recibió una respuesta en segundo plano desconocida.',
                `La respuesta «${reply}» no pudo ser manejada.`
            );
        }
    }

    // Show an error when a command is not supported by the web worker.
    handleCommandNotFound (_jobId, command) {
        this.view.showError(
            'Se solicitó un comando en segundo plano desconocido.',
            `El comando «${command}» no existe.`
        );
    }

    // A job was successfully created by the web worker, create the necessary UI
    // elements so the user can interact with it, and process the job.
    handleJobCreated (jobId, fileName) {
        // Create the UI element for this job.
        const newJobId = this.view.createJob();
        this.jobs.set(newJobId, jobId);
        this.jobs.set(jobId, newJobId);
        this.view.setJobFileName(newJobId, fileName);
        this.processJob(jobId);
    }

    // The web worker successfully deleted a job. Remove the associated UI elements.
    handleJobDeleted (jobId) {
        this.view.removeJob(this.jobs.get(jobId));
        this.jobs.delete(this.jobs.get(jobId));
        this.jobs.delete(jobId);
    }

    // The web worker successfully cancelled (paused) a job. Notify the user.
    handleJobCancelled (jobId) {
        this.view.setJobStatus(this.jobs.get(jobId), 'Lectura cancelada.');
    }

    // The web worker did successfully read a bunch of bytes. Notify the user.
    handleBytesLoaded (jobId, percent) {
        this.view.setJobStatus(this.jobs.get(jobId), `Leyendo el fichero (${percent}%).`);
    }

    // The web worker did successfully read the entire file. Notify the user.
    handleFileReadOK (jobId, data) {
        // eslint-disable-next-line no-magic-numbers
        let marker = typeof data === 'undefined' ? '××' : `0x${data.toString(16).padStart(2, 0)}`;
        marker = `<span class="monospaced">[${marker}]</span>`;
        this.view.setJobStatus(this.jobs.get(jobId), `El fichero se leyó correctamente. ${marker}`);
        this.view.setJobState(this.jobs.get(jobId), 'processed');
    }

    // The web worker had problems reading the file. Handle the situation.
    handleFileReadError (jobId, error) {
        const errorMessages = {
            'FileTooLargeError': 'el fichero es muy grande',
            'NotFoundError': 'el fichero no existe',
            'NotReadableError': 'el fichero no tiene permisos de lectura',
            'SecurityError': 'el fichero no se puede leer de forma segura'
        };
        this.view.setJobState(this.jobs.get(jobId), 'error');
        if (error.name in errorMessages) {
            let status = `ERROR: ${errorMessages[error.name]}`;
            status += ` <span class="monospaced">(${error.name})</span>.`;
            this.view.setJobStatus(this.jobs.get(jobId), status);
        } else {
            // Unexpected error condition that should not happen in production.
            // So, it is notified differently, by using view.showError().
            this.view.showError(
                'Ocurrió un error inesperado leyendo un fichero.',
                `Ocurrió un error «${error.name}» leyendo el fichero «${error.fileName}».\n` +
                `${error.message}.`
            );
        }
    }

    // Create jobs for all files selected by the user.
    handleProcessFiles (files) {
        for (const file of files) {
            // Create the job in the web worker.
            this.asyncDo('createJob', file);
        }
    }

    // The user dismissed a job, tell the web worker to remove it.
    handleDismissJob (jobId) {
        this.asyncDo('deleteJob', this.jobs.get(jobId));
    }

    // The user cancelled a job, tell the web worker to stop it.
    handleCancelJob (jobId) {
        this.view.setJobStatus(jobId, 'Cancelando el fichero…');
        this.view.setJobState(jobId, 'cancelled');
        this.asyncDo('cancelJob', this.jobs.get(jobId));
    }

    // The user retried a job, tell the web worker to process it again.
    handleRetryJob (jobId) {
        this.processJob(this.jobs.get(jobId));
    }
}


window.addEventListener('load', () => {
    // Create and run the Presenter.
    const presenter = new Presenter();
    presenter.run();
});
