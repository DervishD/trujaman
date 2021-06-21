'use strict';


// This class encapsulates the user interface.
class UI {
    constructor () {
        // No observer wired right now.
        this.observer = null;

        // For keeping track of jobs. Indexed by job id.
        this.jobs = new Map();

        // Set up the file picker.
        const filePicker = document.querySelector('#filepicker');
        filePicker.hidden = false;
        filePicker.querySelector('button').addEventListener('click', () => {
            filePicker.querySelector('input').click();  // Propagate the click.
        });

        // If the browser supports file drag and drop, enable it.
        //
        // This is entirely optional, and detection is performed by testing for
        // the existence of the drag and drop events used. This is not orthodox
        // but works for the needs of the application.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => 'on' + event in window)) {
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
        filePicker.firstElementChild.addEventListener('change', event => {
            this.sendEvent('processFiles', event.target.files);
            // Or the event won't be fired again if the user selects the same file...
            event.target.value = null;
        });

        // Show jobs container.
        this.jobsContainer = document.querySelector('#jobs');
        this.jobsContainer.hidden = false;
    }

    // Send event to observer, if any.
    sendEvent (event, payload) {
        this.observer && this.observer.handleEvent(event, payload);
    }

    // Show version code on proper DOM element.
    showVersion (version) {
        const versionElement = document.querySelector('#version');
        versionElement.hidden = false;
        versionElement.textContent += 'v' + version;
    }

    // Show HTML error message on proper DOM element.
    //
    // The function accepts two parameters. The first one is the error message,
    // preferably a one-liner explaining (tersely) the main cause of the error.
    // The second one can be more verbose and contains the details of the error,
    // and will be rendered differently. Usually it's the stringified version of
    // the error as returned by the interpreter.
    showError (message, details) {
        // Show the error on the DOM element.
        const errorElement = document.querySelector('#error');
        errorElement.hidden = false;
        errorElement.querySelector('#error_message').innerText = message;
        errorElement.querySelector('#error_details').innerText = details;

        // Hide the DOM elements following the error one.
        // This effectively disables the user interface.
        let element = document.querySelector('#error');
        while (element = element.nextElementSibling) element.hidden = true;

        // FIXME: cancel jobs and hide filePicker instead. And REFACTOR!
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
        }, {once: true});

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
        if (!job) return;
        job.querySelector('.job_filename').textContent = fileName;
    }

    // Set the status (HTML) for the specified job id.
    setJobStatus (jobId, status) {
        const job = this.jobs.get(jobId);
        if (!job) return;
        job.querySelector('.job_status').innerHTML = status;
    }

    // Set the state for the specified job id.
    // A job can be in the following states:
    setJobState (jobId, state) {
        const job = this.jobs.get(jobId);
        if (!job) return;
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
    constructor (view) {
        this.view = view;
        this.view.observer = this;  // Register as observer of the view (UI).

        // For keeping track of jobs. Indexed by job id.
        this.jobs = new Map();

        // Set up web worker.
        this.worker = new WebWorker('ww.js', view);
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
            const jobId = `${files[i].name}_${files[i].size}_${files[i].lastModified}`;

            // Do not add duplicate jobs.
            if (this.jobs.has(jobId)) continue;
            this.jobs.set(jobId, files[i]);

            // Create the UI element for this job.
            this.view.createJob(jobId);
            this.view.setJobFileName(jobId, files[i].name);

            // Process the job.
            this.processJob(jobId);
        }
    }

    // Process a job.
    processJob (jobId) {
        const file = this.jobs.get(jobId);

        this.view.setJobStatus(jobId, 'Leyendo el fichero…');
        this.view.setJobState(jobId, 'processing');

        this.worker.do('readFile', file)
        .then(payload => {
            payload = payload ? `0x${payload.toString(16)}` : '××';
            payload = `<span class="monospaced">[${payload}]</span>`;
            this.view.setJobStatus(jobId, `El fichero se leyó correctamente. ${payload}`);
            this.view.setJobState(jobId, 'processed');
            console.log(`El fichero se leyó correctamente. ${payload}`);
        })
        .then(() => this.worker.do('forgetFile', file))  // For cleaning up no longer needed resources.
        .catch(error => {
            // Something went wrong.
            this.view.setJobState(jobId, 'error');
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
                    // So, it is notified differently, by using ui.showError().
                    return this.view.showError(
                        'Ocurrió un error inesperado leyendo un fichero.',
                        `Ocurrió un error «${error.name}» leyendo el fichero «${error.fileName}».\n${error.message}.`
                    );
            }
            this.view.setJobStatus(jobId, `${errorMessage} <span class="monospaced">(${error.name})</span>.`);
        });

    }

    // Cancel a job.
    cancelJob (jobId) {
        const file = this.jobs.get(jobId);

        this.worker.do('abortRead', file)
        .then(() => {
            this.view.setJobState(jobId, 'cancelled');
            this.view.setJobStatus(jobId, 'Lectura cancelada.');
        });
    }

    // Retry a job.
    retryJob (jobId) {
        this.processJob(jobId);
    }

    // Dismiss a job.
    dismissJob (jobId) {
        const file = this.jobs.get(jobId);

        this.view.removeJob(jobId);
        this.jobs.delete(jobId);

        this.worker.do('abortRead', file)
        .then(() => {
            this.worker.do('forgetFile', file);
        });
    }
}


window.addEventListener('load', () => {
    // First step is setting up the user interface.
    const ui = new UI();
    new Presenter(ui);

    // Show version number.
    navigator.serviceWorker.ready
    .then(() => {
        fetch('version')
        .then(response => response.text())
        .then(version => ui.showVersion(version));
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
        ui.showError(navigator.cookieEnabled ? 'Falló una parte esencial.' : 'Las cookies están desactivadas.' , error);
        return Promise.reject(null);
    })
    // Service worker successfully registered, proceed with setting up the app.
    .then(() => fetch('formats.json'))
    .then(response => response.json().catch(error => {
        ui.showError('No se pudo procesar la lista de formatos.', error);
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
    })
    .catch(error => {  // For unhandled errors.
        if (error === null) return;
        ui.showError('Se produjo un error inesperado.', error);
    });
});


// This class encapsulates the web worker for background tasks.
class WebWorker {
    constructor (script, ui) {
        this.settlers = [];  // For settling the appropriate Promise for a transaction.
        this.currentId = 0;  // Current transaction identifier.

        // Create the web worker.
        this.worker = new Worker(script);

        // This error handler only handles loading errors and syntax errors.
        this.worker.addEventListener('error', event => {
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
            ui.showError('No se pueden ejecutar tareas en segundo plano.', details);

            // Prevent further processing of the event.
            event.preventDefault();
        });

        // This handles responses from the web worker.
        this.worker.addEventListener('message', event => {
            const {id, status, payload} = event.data;

            // Internal error in web worker.
            if (status === null) {
                const details = `${payload.message} «${payload.command}».`;
                ui.showError('No existe el comando en segundo plano solicitado.', details);
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