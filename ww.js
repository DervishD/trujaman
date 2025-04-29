import {version} from './version.js';
import {commands, replies} from './contracts.js';
import {MAX_FILE_SIZE_MIB, FILE_READING_DELAY_MILLISECONDS} from './constants.js';
import * as MSG from './strings.js';


let knownFormats = null;
const jobs = new Map();

let slowMode = Boolean(version.prerelease);  // Enabled by default on prereleases.
if (slowMode) postReply(replies.showSlowModeIndicator);

const handlers = {...commands};
Object.keys(handlers).forEach(command => { handlers[command] = null; });

globalThis.addEventListener('message', message => {
    const {command, payload} = message.data;
    console.debug(MSG.WW_RECEIVED_COMMAND(command), payload);  // eslint-disable-line new-cap

    if (handlers[command]) {
        handlers[command](payload);
    } else {
        postReply(replies.commandNotFound, command);
    }
});


function postReply (reply, payload) {
    console.debug(MSG.WW_SENDING_REPLY(reply), payload);  // eslint-disable-line new-cap
    globalThis.postMessage({reply, payload});
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


handlers.registerFormats = registerFormatsHandler;
function registerFormatsHandler (formats) {
    knownFormats = formats;
}


handlers.slowModeToggle = slowModeToggleHandler;
function slowModeToggleHandler () {
    slowMode = !slowMode;
    postReply(replies.slowModeState, slowMode);
}


handlers.createJob = createJobHandler;
function createJobHandler (file) {
    const job = {file, reader: null};
    const jobId = generateJobId.next().value;

    if (typeof jobId === 'undefined' || !knownFormats) {
        return;
    }

    job.reader = new FileReader();

    job.reader.onprogress = event => {
        const PERCENT_FACTOR = 100;
        const percent = event.total ? Math.floor(PERCENT_FACTOR * event.loaded / event.total) : PERCENT_FACTOR;

        if (slowMode) {
            const start = Date.now(); while (Date.now() - start < FILE_READING_DELAY_MILLISECONDS);
        }
        postReply(replies.bytesRead, {jobId, percent});
    };

    job.reader.onerror = event => {
        const error = {
            name: event.target.error.name,
            message: event.target.error.message,
            fileName: job.file.name,
        };
        postReply(replies.fileReadError, {jobId, error});
    };
    job.reader.onload = event => {
        const [contents] = new Uint8Array(event.target.result);
        postReply(replies.fileReadComplete, {jobId, contents});
    };
    job.reader.onabort = () => {
        postReply(replies.jobCancelled, jobId);
    };

    jobs.set(jobId, job);
    postReply(replies.jobCreated, {jobId, fileName: job.file.name});
}


handlers.processJob = processJobHandler;
handlers.retryJob = processJobHandler;
function processJobHandler (jobId) {
    const job = jobs.get(jobId);
    const KIB_MULTIPLIER = 1024;

    if (job.file.size > MAX_FILE_SIZE_MIB * KIB_MULTIPLIER * KIB_MULTIPLIER) {
        postReply(replies.fileTooLarge, jobId);
    } else {
        // The file is read using the HTML5 File API.
        // Read the file as ArrayBuffer.
        job.reader.readAsArrayBuffer(job.file);
    }
}


handlers.cancelJob = cancelJobHandler;
function cancelJobHandler (jobId) {
    const job = jobs.get(jobId);
    job.reader.abort();
}


handlers.deleteJob = deleteJobHandler;
function deleteJobHandler (jobId) {
    const job = jobs.get(jobId);
    job.reader.abort();
    job.reader.onload = null;
    job.reader.onerror = null;
    job.reader.onabort = null;
    jobs.delete(jobId);
    postReply(replies.jobDeleted, jobId);
}


console.info(MSG.SCRIPT_PROCESSED('Web Worker'));  // eslint-disable-line new-cap
