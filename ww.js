import {commands, replies} from './contracts.js';
import {MAX_FILE_SIZE, PERCENT_FACTOR} from './constants.js';


const handlers = Object.fromEntries(Object.keys(commands).map(command => [command, null]));

const jobRegistry = new Map();

let knownFormats = null;


globalThis.addEventListener('message', message => {
    const {command, payload} = message.data;
    console.debug(`Received command '${command}' from main thread\nPayload: %o`, payload);

    if (handlers[command]) {
        handlers[command](payload);
    } else {
        postReply(replies.commandNotFound, command);
    }
});


function postReply (reply, payload, transferables = []) {
    console.debug(`Sending reply '${reply}' to main thread\nPayload: %o\nTransferables: %o`, payload, transferables);

    globalThis.postMessage({reply, payload}, transferables);
}


handlers.registerFormats = registerFormatsHandler;
function registerFormatsHandler (formats) {
    knownFormats = formats;
}


const generateJobId = (function *generateJobId () {
    // According to ECMA-262 Number.MAX_SAFE_INTEGER is (2^53)-1. So, even in an
    // scenario where 1000 jobs are added each millisecond, which is, in fact, a
    // bit optimistic, jobs could be added at that rate for a bit over 285 years
    // for the test below to be true.
    //
    // So, it is perfectly safe to end the generator in that case.
    let id = 0;
    while (Number.isSafeInteger(id)) {
        yield id++;
    }
}());


class Job {
    constructor (file, callbacks) {
        this.file = file;
        this.callbacks = callbacks;

        this.reader = new FileReader();
        this.reader.onload = event => this.callbacks.onComplete(event.target.result);
        this.reader.onprogress = event => this.callbacks.onBytesRead(event.loaded);
        this.reader.onerror = event => {
            const error = {
                name: event.target.error.name,
                message: event.target.error.message,
                fileName: this.file,
            };
            this.callbacks.onError(error);
        }
    }

    readFile () {
        this.reader.readAsArrayBuffer(this.file);
    }

    delete () {
        this.file = null;
        this.reader.abort();
        this.reader.onload = null;
        this.reader.onerror = null;
        this.reader.onprogress = null;
        this.reader = null;
        this.callbacks = null;
    }
}


handlers.createJob = createJobHandler;
function createJobHandler (file) {
    const jobId = generateJobId.next().value;

    if (typeof jobId === 'undefined' || !knownFormats) return;

    const job = new Job(file, {
        onError: error => {
            postReply(replies.fileReadError, {jobId, error});
        },
        onBytesRead: bytesRead => {
            const percent = file.size ? Math.floor(PERCENT_FACTOR * bytesRead / file.size) : PERCENT_FACTOR;
            postReply(replies.bytesRead, {jobId, percent});
        },
        onComplete: contents => {
            postReply(replies.fileReadComplete, {jobId, contents}, [contents]);
        },
    });

    jobRegistry.set(jobId, job);

    postReply(replies.jobCreated, {jobId, fileName: job.file.name});
}


handlers.processJob = processJobHandler;
function processJobHandler (jobId) {
    const job = jobRegistry.get(jobId);

    if (typeof job === 'undefined') return;

    if (job.file.size > MAX_FILE_SIZE) {
        postReply(replies.fileTooLarge, jobId);
        return;
    }

    job.readFile();
}


handlers.deleteJob = deleteJobHandler;
function deleteJobHandler (jobId) {
    const job = jobRegistry.get(jobId);
    if (typeof job === 'undefined') return;

    job.delete();

    jobRegistry.delete(jobId);

    postReply(replies.jobDeleted, jobId);
}
