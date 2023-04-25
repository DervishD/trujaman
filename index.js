'use strict';


// Very crude default function for showing errors to the end user.
//
// Works even if the page is not fully loaded, so it is a last resort.
const errorHeader = '¡ERROR, la aplicación no puede funcionar!';
globalThis.showError = function showError (reason, details) {
    globalThis.stop();
    alert(`${errorHeader}\n${reason}\n${details}`);  // eslint-disable-line no-alert
};


// Default handler for unhandled errors which should not happen in production.
globalThis.unexpectedErrorHandler = function unexpectedErrorHandler (event) {  // eslint-disable-line max-statements
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    let location = '';
    if (event.filename) {
        try {
            location = new URL(event.filename).pathname.substring(1);  // eslint-disable-line no-magic-numbers
        } catch (exc) {
            if (exc instanceof TypeError) {
                location = event.filename;
            } else throw exc;
        }
        location = `En ${location}, línea ${event.lineno}, columna ${event.colno}.`;
    }

    let reason = '';
    let error = '';
    if (event instanceof PromiseRejectionEvent) {
        error = event.reason;
        reason = 'PromiseRejectionEvent';
    } else {  // For ErrorEvent events.
        ({error} = event);
        reason = 'ErrorEvent';
    }

    reason += `${error && error.name ? `(${error.name})` : ''} sin gestionar.`;

    let details = '';
    if (error) {
        details += `[${error}]`;
        details += location ? `\n${location}` : '';
        if (error.stack) {
            details += '\nInformación de depurado:\n';
            for (const line of error.stack.trim().split('\n')) {
                details += `    ${line.trim()}\n`;
            }
        }
    }

    globalThis.showError(reason, details);
};


globalThis.addEventListener('error', globalThis.unexpectedErrorHandler);
globalThis.addEventListener('unhandledrejection', globalThis.unexpectedErrorHandler);


// This class encapsulates the user interface.
class UI {
    constructor () {
        this.eventSubscribers = {};
        this.jobEventListeners = new Map();
        this.filePicker = document.querySelector('#filepicker');
        this.filePickerInput = this.filePicker.querySelector('input');
        this.filePickerButton = this.filePicker.querySelector('button');
        this.jobsContainer = document.querySelector('#jobs');
        this.version = document.querySelector('#version');
        this.errorTemplate = document.querySelector('#error_template');
        this.formatsDropdown = document.querySelector('#job_template').content.querySelector('.job_formats_list');
        this.lastError = null;
    }

    // Activates and renders the user interface.
    render () {
        this.filePicker.hidden = false;
        this.filePickerButton.focus();
        this.filePickerButton.addEventListener('click', () => {
            this.filePickerInput.click();
        });
        this.filePickerInput.addEventListener('change', event => {
            this.emit('processFiles', event.target.files);
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        this.jobsContainer.hidden = false;

        this.initDragAndDrop();
    }

    // Notifies subscribers about an event.
    emit (event, payload) {
        this.eventSubscribers[event] && this.eventSubscribers[event](payload);
    }

    // Registers a handler for an event.
    on (event, handler) {
        this.eventSubscribers[event] = handler;
    }

    // Initializes drag and drop support, if available.
    initDragAndDrop () {
        // This feature is entirely optional.
        // Detection is performed by testing for the existence of the drag and
        // drop events used. This is not orthodox but works well enough.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in globalThis)) {
            const dropzone = document.querySelector('#dropzone');

            dropzone.hidden = false;
            dropzone.dataset.state = 'hidden';

            globalThis.addEventListener('dragenter', () => { dropzone.dataset.state = 'visible'; });
            dropzone.addEventListener('dragleave', () => { dropzone.dataset.state = 'hidden'; });

            // This is needed because otherwise the page is NOT a valid drop target,
            // and when the file is dropped the default action is performed by the browser.
            dropzone.addEventListener('dragover', event => { event.preventDefault(); });

            dropzone.addEventListener('drop', event => {
                dropzone.dataset.state = 'dismissed';
                this.emit('processFiles', event.dataTransfer.files);
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }
    }

    // Stores the list of formats for the download dropdown menu.
    setFormatsList (formats) {
        for (const format in formats) {
            const paragraph = document.createElement('p');
            paragraph.innerText = format;
            this.formatsDropdown.append(paragraph);
        }
    }

    // Shows version code on proper DOM element.
    showVersion (version) {
        this.version.hidden = false;
        this.version.textContent += `v${version}`;
    }

    // Shows a detailed error message.
    //
    // The function accepts two parameters:
    //  1: The error reason, preferably a one-liner explaining (tersely) the main cause of the error.
    //  2: The details of the error, verbosely explaining the information about the error.
    showError (reason, details) {
        if (!this.lastError) {
            for (const job of this.jobsContainer.querySelectorAll('.job:not([hidden])')) {
                job.querySelector('.job_dismiss_button').click();
            }

            // Disable UI interaction by removing the file picker.
            this.filePicker.remove();
            delete this.filePicker;

            // At this point no further interaction with the page is possible so the
            // application is effectively stopped, even though it is still running…

            // Use the hidden template as insertion point.
            this.lastError = this.errorTemplate;
        }

        const errorElement = this.errorTemplate.cloneNode(true);

        errorElement.querySelector('.error_header').innerText = errorHeader;
        errorElement.querySelector('.error_reason').innerText = reason;
        errorElement.querySelector('.error_details').innerText = details;

        // Errors are shown in a first-happenned, first-shown manner.
        this.lastError.nextSibling.before(errorElement);
        errorElement.hidden = false;
        this.lastError = errorElement;
    }

    // Creates a job user interface element and returns a job id for it.
    createJob () {
        const newJob = document.getElementById('job_template').content.firstElementChild.cloneNode(true);

        const handleDismissClicked = function handleDismissClicked () { this.emit('dismissJob', newJob); }.bind(this);
        const dismissButton = newJob.querySelector('.job_dismiss_button');
        dismissButton.addEventListener('click', handleDismissClicked, {'once': true});

        const handleCancelClicked = function handleCancelClicked () { this.emit('cancelJob', newJob); }.bind(this);
        const cancelButton = newJob.querySelector('.job_cancel_button');
        cancelButton.addEventListener('click', handleCancelClicked);

        const handleRetryClicked = function handleRetryClicked () { this.emit('retryJob', newJob); }.bind(this);
        const retryButton = newJob.querySelector('.job_retry_button');
        retryButton.addEventListener('click', handleRetryClicked);

        const handleDownloadClicked = function handleDownloadClicked () {
            const formatsList = newJob.querySelector('.job_formats_list');
            formatsList.hidden = !formatsList.hidden;
        };
        const downloadButton = newJob.querySelector('.job_download_dropdown');
        downloadButton.addEventListener('click', handleDownloadClicked);

        this.jobEventListeners.set(newJob, [
            [dismissButton, handleDismissClicked],
            [cancelButton, handleCancelClicked],
            [retryButton, handleRetryClicked],
            [downloadButton, handleDownloadClicked]
        ]);

        // // For testing purposes.
        // element.querySelector('.job_filename').addEventListener('click', () => {
        //     this.sendEvent('processJob', jobId);
        // });

        this.jobsContainer.append(newJob);
        return newJob;
    }

    // Removes the specified job user interface element.
    removeJob (job) {
        // Remove event listeners first.
        // Not really needed, apparently, but it's the Tao.
        for (const [element, eventListener] of this.jobEventListeners.get(job)) {
            element.removeEventListener('click', eventListener);
        }
        job.remove();
    }

    // Sets the file name for the specified job.
    // eslint-disable-next-line class-methods-use-this
    setJobFileName (job, fileName) {
        job.querySelector('.job_filename').textContent = fileName;
    }

    // Sets the status for the specified job.
    // eslint-disable-next-line class-methods-use-this
    setJobStatus (job, status) {
        job.querySelector('.job_status').innerHTML = status;
    }

    // Sets the state for the specified job.
    // eslint-disable-next-line class-methods-use-this
    setJobState (job, state) {
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
    constructor () {
        // For keeping track of jobs.
        //
        // Since the Presenter has to keep a bijection map between job objects
        // as returned by the View and job ids as returned by the web worker,
        // for converting between them as needed, it would be necessary to keep
        // two different maps. BUT, since it's impossible that a View object
        // will collide with a web worker job id, BOTH of them can be added to
        // the same Map() and that way it will work as a bijection.
        this.jobs = new Map();
    }

    // Runs the Presenter.
    async run () {
        navigator.serviceWorker.ready
        .then(() => {
            fetch('version')
            .then(response => response.text())
            .then(version => version && this.view.showVersion(version));
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            globalThis.location.reload();
        });

        // For now, just prevent the default install handler to appear.
        globalThis.addEventListener('beforeinstallprompt', event => event.preventDefault());

        this.initView();

        // Now that the UI is up and running, a new error printing function
        // which shows the errors on the main web page can be set.
        globalThis.showError = this.view.showError.bind(this.view);

        await this.initServiceWorker('sw.js');
        await this.loadFormats('formats.json');
        this.initWebWorker('ww.js');
    }


    // Initializes the user interface.
    initView () {
        this.view = new UI();

        this.view.on('processFiles', this.handleProcessFiles.bind(this));
        this.view.on('dismissJob', this.handleDismissJob.bind(this));
        this.view.on('cancelJob', this.handleCancelJob.bind(this));
        this.view.on('retryJob', this.handleRetryJob.bind(this));

        this.view.render();
    }

    // Activates the service worker.
    async initServiceWorker (serviceWorker) {
        try {
            await navigator.serviceWorker.register(serviceWorker);
        } catch (error) {
            // Service workers are considered site data, so cookies have to be
            // enabled for the application to work.
            if (navigator.cookieEnabled) {
                this.view.showError('Falló una parte esencial.', error);
            } else {
                this.view.showError('Las cookies están desactivadas.', error);
            }
        }
    }

    // Loads and processes the format list.
    async loadFormats (formatsFile) {
        try {
            const response = await fetch(formatsFile);
            if (response.ok) {
                const formats = await response.json();
                // Update job template with the list of formats.
                this.view.setFormatsList(formats);
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

    // Initializes web worker.
    initWebWorker (webWorker) {
        this.worker = new Worker(webWorker);
        this.worker.addEventListener('error', event => this.handleWebWorkerError(event));
        this.worker.addEventListener('message', event => this.handleWebWorkerMessages(event.data));
    }

    // Carries an operation (command) asynchronously, by sending it to the web worker.
    asyncDo (command, args) {
        this.worker.postMessage({
            command,
            args
        });
    }

    // Processes a job.
    processJob (jobId) {
        this.view.setJobState(this.jobs.get(jobId), 'processing');
        this.asyncDo('processJob', jobId);
    }

    // Handles loading and syntax errors from the web worker.
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
    }

    // Handles messages coming from the web worker.
    handleWebWorkerMessages (message) {
        const {reply, jobId, payload} = message;

        // eslint-disable-next-line no-magic-numbers
        const handler = `handle${reply[0].toUpperCase()}${reply.slice(1)}`;
        if (handler in this) {
            this[handler](jobId, payload);
        } else {
            this.view.showError(
                'Se recibió un mensaje desconocido del web worker.',
                `El mensaje «${reply}» no pudo ser gestionado.`
            );
        }
    }

    // Shows an error when a command is not supported by the web worker.
    handleCommandNotFound (__, command) {
        this.view.showError(
            'Se envió un comando desconocido al web worker.',
            `El comando «${command}» no existe.`
        );
    }

    // Handles successful creation of a job by the web worker.
    handleJobCreated (jobId, fileName) {
        const newJob = this.view.createJob();
        this.jobs.set(newJob, jobId);
        this.jobs.set(jobId, newJob);
        this.view.setJobFileName(newJob, fileName);
        this.processJob(jobId);
    }

    // Handles successful removal of a job by the web worker.
    handleJobDeleted (jobId) {
        this.view.removeJob(this.jobs.get(jobId));
        this.jobs.delete(this.jobs.get(jobId));
        this.jobs.delete(jobId);
    }

    // Handless successful cancellation of a job by the web worker.
    handleJobCancelled (jobId) {
        this.view.setJobStatus(this.jobs.get(jobId), 'Lectura cancelada.');
    }

    // Handles successful file reads by the web worker.
    handleBytesRead (jobId, percent) {
        this.view.setJobStatus(this.jobs.get(jobId), `Leyendo el fichero (${percent}%).`);
    }

    // Handles a successful COMPLETE file read by the web worker.
    handleFileReadOK (jobId, data) {
        // eslint-disable-next-line no-magic-numbers
        let marker = typeof data === 'undefined' ? '××' : `0x${data.toString(16).padStart(2, 0)}`;
        marker = `<span class="monospaced">[${marker}]</span>`;
        this.view.setJobStatus(this.jobs.get(jobId), `El fichero se leyó correctamente. ${marker}`);
        this.view.setJobState(this.jobs.get(jobId), 'processed');
    }

    // Handles web worker file reading errors.
    handleFileReadError (jobId, error) {
        const errorMessages = {
            'FileTooLargeError': 'el fichero es muy grande',
            'NotFoundError': 'el fichero no existe',
            'NotReadableError': 'el fichero no se puede leer',
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
                'Error inesperado leyendo un fichero.',
                `Ocurrió un error «${error.name}» leyendo el fichero «${error.fileName}».\n` +
                `${error.message}.`
            );
        }
    }

    // Handles job creation for files selected by the user.
    handleProcessFiles (files) {
        for (const file of files) {
            // Create the job in the web worker.
            this.asyncDo('createJob', file);
        }
    }

    // Handles job dismissions by the user.
    handleDismissJob (jobId) {
        this.asyncDo('deleteJob', this.jobs.get(jobId));
    }

    // Handles job cancellations by the user.
    handleCancelJob (jobId) {
        this.view.setJobStatus(jobId, 'Cancelando el fichero…');
        this.view.setJobState(jobId, 'cancelled');
        this.asyncDo('cancelJob', this.jobs.get(jobId));
    }

    // Handles job retries.
    handleRetryJob (jobId) {
        this.processJob(this.jobs.get(jobId));
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});
