import './contracts.js';  /* global customEvents, webWorkerCommands, serviceWorkerCommands, unknownCommand */
import * as MSG from './strings.js';
import * as C from './constants.js';


class FatalError extends Error {
    constructor (message, details = '') {
        super(message);
        this.details = details;
        this.name = new.target.name;
    }
}


function ensureTrailingPeriod (string) {
    if (typeof string !== 'string') return string;

    let outputString = string.trim();
    if (!outputString) return '';
    outputString += outputString.endsWith('.') ? '' : '.';
    return outputString
}


function mungeErrorInfo (errorInfo) {
    let {name, message, filename, line, column, details, stack} = errorInfo;
    let consoleErrorMessage = MSG.APP_STOPPED + MSG.ERROR_CONSOLE_SECTION_SEPARATOR;

    name = name ? MSG.ERROR_FORMATTED_NAME(name) : '';

    message = message.trim();
    if (!message) {
        message = name ? MSG.ERROR_DEFAULT_MESSAGE : MSG.ERROR_UNKNOWN;
    }
    message = ensureTrailingPeriod(message);
    consoleErrorMessage += message && message + MSG.ERROR_CONSOLE_SECTION_SEPARATOR;

    let location = '';
    if (filename) {
        try {
            const FROM_SLASH = 1;
            filename = new URL(filename).pathname.substring(FROM_SLASH);
        } catch (exc) {
            if (!(exc instanceof TypeError)) throw exc;
        }
        if (typeof line !== 'number') line = MSG.NOT_AVAILABLE;
        if (typeof column !== 'number') column = MSG.NOT_AVAILABLE;

        location = MSG.ERROR_LOCATION(filename, line, column);
    }
    consoleErrorMessage += location && location + MSG.ERROR_CONSOLE_SECTION_SEPARATOR;

    details = ensureTrailingPeriod(details);
    consoleErrorMessage += details && details + MSG.ERROR_CONSOLE_SECTION_SEPARATOR;

    stack &&= MSG.ERROR_STACKDUMP_HEADER + stack
    .replace(C.SUBSTACKDUMP_SEPARATOR, MSG.ERROR_SUBSTACKDUMP_SEPARATOR)
    .split('\n')
    .map(frameLine => MSG.ERROR_STACKDUMP_FRAMELINE(frameLine))
    .join('');
    consoleErrorMessage += stack && stack + MSG.ERROR_CONSOLE_SECTION_SEPARATOR;
    consoleErrorMessage = consoleErrorMessage.trimEnd();

    return {name, message, location, details, stack, consoleErrorMessage};
}


function reportError(errorInfo) {
    const {consoleErrorMessage, ...mungedErrorInfo} = mungeErrorInfo(errorInfo);
    const errorTemplate = document.querySelector(C.S_ERROR_TEMPLATE);
    const errorElement = errorTemplate.content.firstElementChild.cloneNode(true);

    errorElement.querySelector(C.S_ERROR_HEADER).textContent = MSG.APP_STOPPED;

    for (const [key, value] of Object.entries(mungedErrorInfo)) {
        if (!value) continue;  // eslint-disable-line no-continue
        const element = errorElement.querySelector(C[`S_ERROR_${key.toUpperCase()}`]);
        element.textContent = value;
        element.hidden = false;
    }

    errorTemplate.before(errorElement);

    console.error(consoleErrorMessage);
}


// Default handler for errors which should not happen in production.
globalThis.addEventListener('error', event => {
    event.preventDefault();

    globalThis.dispatchEvent(new Event(customEvents.interactionHalted));
    // At this point no further interaction with the page is possible so the
    // application is effectively stopped, even though it is still running…

    const errorInfo = {
        name: '',
        message: '',
        filename: '',
        line: '',
        column: '',
        details: '',
        stack: '',
    };

    if (event instanceof ErrorEvent) {
        errorInfo.name = event.error.name;
        errorInfo.details = event.error.message;
        errorInfo.stack = event.error.stack;

        if (event.filename) {
            errorInfo.filename = event.filename;
            errorInfo.line = event.lineno;
            errorInfo.column = event.colno;
        }
    }

    if (event.error instanceof FatalError) {
        errorInfo.name = '';
        errorInfo.message = event.error.message;
        errorInfo.details = event.error.details.message || '';
        errorInfo.stack += event.error.details.stack ? C.SUBSTACKDUMP_SEPARATOR + event.error.details.stack : '';
    }

    reportError(errorInfo);
});


globalThis.addEventListener('unhandledrejection', event => {
    event.preventDefault();
    globalThis.reportError(event.reason);
});


class UI {
    constructor () {
        this.halted = false;

        this.versionText = document.querySelector(C.S_VERSION_TEXT);
        this.versionText.textContent = MSG.TEXT_LOADING;

        this.formatsList = document.querySelector(C.S_JOB_TEMPLATE).content.querySelector(C.S_JOB_FORMATS_LIST);

        this.defaultControl = document.querySelector(C.S_DEFAULT_CONTROL);

        this.filePicker = document.querySelector(C.S_FILEPICKER);
        this.filePicker.addEventListener('click', () => {
            this.filePicker.querySelector(C.S_FILEPICKER_INPUT).click();
        });
        this.filePicker.addEventListener('change', event => {
            globalThis.dispatchEvent(new CustomEvent(customEvents.processingRequested, {detail: event.target.files}));
            event.target.value = null;  // Otherwise the event won't be fired again if the user selects the same file…
        });

        // This feature is entirely optional.
        // Detection is performed by testing for the existence of the drag and drop events used.
        // This is not orthodox but works well enough.
        if (['dragenter', 'dragover', 'dragleave', 'drop'].every(event => `on${event}` in globalThis)) {
            this.dropZone = document.querySelector(C.S_DROPZONE);
            globalThis.addEventListener('dragenter', () => {
                this.dropZone.dataset.state = C.DROPZONE_STATE_VISIBLE;
            });
            this.dropZone.addEventListener('dragleave', () => {
                this.dropZone.dataset.state = C.DROPZONE_STATE_HIDDEN;
            });

            // This is needed because otherwise the page is NOT a valid drop target,
            // and when the file is dropped the default action is performed by the browser.
            this.dropZone.addEventListener('dragover', event => { event.preventDefault(); });

            this.dropZone.addEventListener('drop', event => {
                this.dropZone.dataset.state = C.DROPZONE_STATE_DISMISSED;
                const {files} = event.dataTransfer;
                globalThis.dispatchEvent(new CustomEvent(customEvents.processingRequested, {detail: files}));
                event.preventDefault();  // Prevent the browser from opening the file.
            });
        }
    }

    show () {
        if (this.halted) return;

        document.querySelector(C.S_DROPZONE_TEXT).textContent = MSG.TEXT_DROPZONE;
        document.querySelector(C.S_DEFAULT_CONTROL_TEXT).textContent = MSG.TEXT_DEFAULT_CONTROL;

        this.filePicker.hidden = false;
        this.defaultControl.focus();

        if (this.dropZone) {
            this.dropZone.hidden = false;
            this.dropZone.dataset.state = C.DROPZONE_STATE_HIDDEN;
        }
        document.querySelector(C.S_LOGO).dataset.state = C.APP_STATE_RUNNING;
    }

    halt () {
        this.halted = true;
        this.filePicker.remove();
        this.dropZone.remove();
        document.querySelector(C.S_JOBS_CONTAINER).hidden = true;
    }

    set formats (formats) {
        const template = document.querySelector(C.S_DOWNLOADABLE_FORMAT_TEMPLATE).content.firstElementChild;
        formats.forEach(format => {
            const element = template.cloneNode(true);
            element.querySelector(C.S_DOWNLOADABLE_FORMAT_NAME_TEXT).textContent = format;
            this.formatsList.append(element);
        });
    }
}


class Job {
    static states = {
        reading: Symbol(C.JOB_STATE_READING),
        processed: Symbol(C.JOB_STATE_PROCESSED),
        error: Symbol(C.JOB_STATE_ERROR),
    };

    static errors = {
        FileTooLargeError: MSG.FILE_TOO_LARGE,
        NotFoundError: MSG.FILE_NOT_FOUND,
        NotReadableError: MSG.FILE_NOT_READABLE,
        SecurityError: MSG.FILE_SECURITY_ERROR,
    };

    constructor (fileName) {
        this.progressString = '';
        this.errorName = '';

        this.element = document.querySelector(C.S_JOB_TEMPLATE).content.firstElementChild.cloneNode(true);
        this.element.querySelector(C.S_JOB_FILENAME_TEXT).textContent = fileName;

        this.message = this.element.querySelector(C.S_JOB_MESSAGE_TEXT);

        this.debugInfoElement = this.element.querySelector(C.S_JOB_DEBUG_INFO);
        this.debugInfoText = this.element.querySelector(C.S_JOB_DEBUG_INFO_TEXT);

        this.jobDismissControl = this.element.querySelector(C.S_JOB_DISMISS);
        this.downloadDropdown = this.element.querySelector(C.S_JOB_DOWNLOAD_DROPDOWN);
        this.downloadDropdown.querySelector(C.S_JOB_DOWNLOAD_DROPDOWN_TEXT).textContent = MSG.TEXT_DOWNLOAD_DROPDOWN;

        this.jobDismissControl.addEventListener('click', event => {
            event.target.dispatchEvent(new CustomEvent(customEvents.jobDismissed, {detail: this, bubbles: true}));
        }, {once: true});

        this.downloadDropdown.addEventListener('click', this.downloadDropdownEventListener = () => {
            const formatsList = this.element.querySelector(C.S_JOB_FORMATS_LIST);
            formatsList.hidden = !formatsList.hidden;
        });

        document.querySelector(C.S_JOBS_CONTAINER).append(this.element);
    }

    remove () {
        // Remove event listeners before removing the DOM element.
        // Not really needed, apparently, but it's the Tao.
        this.downloadDropdown.removeEventListener('click', this.downloadDropdownEventListener);
        this.element.remove();
    }

    set progress (progress) {
        this.progressString = progress;
    }

    set error (error) {
        this.errorName = error;
    }

    set debugInfo (debugInfo) {
        if (!debugInfo) {
            this.debugInfoElement.hidden = true;
            return;
        }
        this.debugInfoElement.hidden = false;
        this.debugInfoText.textContent = debugInfo;
    }

    set state (state) {
        switch (state) {
        case Job.states.reading:
            this.message.textContent = MSG.JOB_STATE_READING(this.progressString);
            break;
        case Job.states.processed:
            this.message.textContent = MSG.JOB_STATE_PROCESSED;
            this.downloadDropdown.hidden = false;
            break;
        case Job.states.error:
            this.message.textContent = MSG.JOB_STATE_ERROR(Job.errors[this.errorName]);
            this.downloadDropdown.hidden = true;
            break;
        default:
        }
    }
}


class Presenter {
    constructor () {
        this.jobRegistry = new Map();
        this.UI = new UI();
        this.channelDebugTags = new WeakMap();
    }

    run () {
        this.initServiceWorker(C.SERVICE_WORKER_URL);
        this.initWebWorker(C.WEB_WORKER_URL);
        this.initCustomEventHandlers();

        fetch(C.FORMATS_URL)
        .then(response => {
            if (!response.ok) {
                throw new FatalError(MSG.FORMATS_NOT_FOUND);
            }
            return response.json();
        })
        .then(formats => {
            this.sendCommand(this.webWorker, webWorkerCommands.registerFormats, formats);
            this.UI.formats = Object.keys(formats);
        })
        .catch(error => {
            throw new FatalError(MSG.CANNOT_PROCESS_FORMATS, error);
        });
    }

    initServiceWorker (serviceWorker) {
        let refreshing = false;
        this.serviceWorker = null;

        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            globalThis.location.reload();
            refreshing = true;
        });

        // For now, just prevent the default install handler to appear.
        globalThis.addEventListener('beforeinstallprompt', event => event.preventDefault());

        navigator.serviceWorker.ready.then(() => {
            this.serviceWorker = navigator.serviceWorker.controller;
            this.channelDebugTags.set(this.serviceWorker, MSG.SW_TAG);
            navigator.serviceWorker.addEventListener('message', event => {
                const {reply, payload} = event.data;
                this.handleReply(this.serviceWorker, reply, payload)
            });
            this.sendCommand(this.serviceWorker, serviceWorkerCommands.getVersion);
        });

        navigator.serviceWorker.register(serviceWorker)
        .catch(error => {
            // Service workers are considered site data, so cookies have to be enabled for the application to work.
            if (navigator.cookieEnabled) {
                throw new FatalError(MSG.CANNOT_RUN_SW, error);
            } else {
                throw new FatalError(MSG.COOKIES_ARE_DISABLED, error);
            }
        });
    }

    initWebWorker (webWorkerURL) {
        this.webWorker = new Worker(webWorkerURL, {type: 'module'});
        this.channelDebugTags.set(this.webWorker, MSG.WW_TAG);

        this.webWorker.addEventListener('message', event => {
            const {reply, payload} = event.data;
            this.handleReply(this.webWorker, reply, payload);
        });
        this.webWorker.addEventListener('error', event => {
            event.preventDefault();
            if (event instanceof ErrorEvent) {
                // For syntax errors, that should not happen in production,
                // the event will be an ErrorEvent instance and will contain
                // information pertaining to the error.
                const error = new Error(event.message);
                throw new FatalError(MSG.WW_SYNTAX(event.lineno, event.colno), error);
            } else {
                // For loading errors the error will be an Event.
                throw new FatalError(MSG.CANNOT_RUN_WW);
            }
        });
    }

    initCustomEventHandlers () {
        globalThis.addEventListener(customEvents.processingRequested, event => {
            const files = event.detail;
            for (const file of files) {
                this.sendCommand(this.webWorker, webWorkerCommands.createJob, file);
            }
        });

        globalThis.addEventListener(customEvents.jobDismissed, event => {
            const job = event.detail;
            const jobId = this.jobRegistry.get(job);
            this.sendCommand(this.webWorker, webWorkerCommands.deleteJob, jobId);
        });

        globalThis.addEventListener(customEvents.interactionHalted, () => {
            this.UI.halt();
            for (const job of this.jobRegistry.values()) {
                if (typeof job !== 'object') {
                    this.sendCommand(this.webWorker, webWorkerCommands.deleteJob, job);
                }
            }
        });
    }

    sendCommand(channel, command, payload) {
        console.debug(`Sending command '${command}' to ${this.channelDebugTags.get(channel)}\nPayload: %o`, payload);
        channel.postMessage({command, payload});
    }

    handleReply (channel, reply, payload) {
        console.debug(`Received reply '${reply}' from ${this.channelDebugTags.get(channel)}\nPayload: %o`, payload);

        if (reply === unknownCommand) {
            const command = payload;
            throw new FatalError(MSG.UNKNOWN_COMMAND(command));
        }

        const handler = `${reply}Handler`;
        if (handler in this) {
            this[handler](payload);
            return;
        }
        throw new FatalError(MSG.UNKNOWN_REPLY(reply));
    }

    versionReportedHandler (version) {
        this.UI.versionText.textContent = `v${version}`;
        this.UI.show();
    }

    jobCreatedHandler ({jobId, fileName}) {
        const job = new Job(fileName);
        this.jobRegistry.set(jobId, job);
        this.jobRegistry.set(job, jobId);
        job.progress = 0;
        job.state = Job.states.reading;
        this.sendCommand(this.webWorker, webWorkerCommands.processJob, jobId);
    }

    jobDeletedHandler (jobId) {
        const job = this.jobRegistry.get(jobId);
        job.remove();
        this.jobRegistry.delete(job);
        this.jobRegistry.delete(jobId);
    }

    bytesReadHandler ({jobId, percent}) {
        const job = this.jobRegistry.get(jobId);
        job.progress = percent;
        job.state = Job.states.reading;
    }

    fileReadCompleteHandler ({jobId, contents}) {
        const job = this.jobRegistry.get(jobId);
        const data = new Uint8Array(contents);
        console.debug(contents);
        if (version.isPrerelease()) job.debugInfo = MSG.JOB_DEBUG_INFO(jobId, data);
        job.state = Job.states.processed;
    }

    fileTooLargeHandler (jobId) {
        const job = this.jobRegistry.get(jobId);
        job.error = Object.keys(Job.errors).find(property => Job.errors[property] === Job.errors.FileTooLargeError);
        job.state = Job.states.error;
    }

    fileReadErrorHandler ({jobId, error}) {
        const job = this.jobRegistry.get(jobId);
        if (error.name in Job.errors) {
            job.error = error.name;
            job.state = Job.states.error;
        } else {
            // Unexpected error condition that should not happen in production.
            throw new FatalError(MSG.FILE_READ(error), new Error(error.message));
        }
    }
}


globalThis.addEventListener('load', () => {
    const presenter = new Presenter();
    presenter.run();
});
