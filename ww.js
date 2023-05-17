'use strict';


console.info('Web worker loaded');

globalThis.jobs = new Map();
globalThis.currentJobId = 0;

globalThis.MAX_FILE_SIZE_BYTES = 99 * 1024 * 1024;

// For delaying for file reading operations so the UI can be tested better, in "slow mode".
globalThis.FILE_READING_DELAY_MILLISECONDS = 500;
globalThis.slowModeEnabled = false;


globalThis.postReply = function postReply (reply, ...args) {
    console.debug(`Sending reply '${reply}'`, args);
    globalThis.postMessage({reply, args});
};


globalThis.addEventListener('message', message => {
    const {command, args} = message.data;
    const [jobId] = args;  // Needed for most of the commands, so…
    const job = globalThis.jobs.get(args[0]);  // Idem…
    console.debug(`Received command '${command}'`, args);

    switch (command) {
    case 'slowModeToggle':
        globalThis.slowModeEnabled = !globalThis.slowModeEnabled;
        globalThis.postReply('slowModeStatus', globalThis.slowModeEnabled);
        break;
    case 'createJob': {
        const newJob = {'file': args[0]};
        const newJobId = globalThis.currentJobId++;  // eslint-disable-line no-plusplus

        // According to ECMA-262 which says that Number.MAX_SAFE_INTEGER equals
        // (2^53)-1, and considering a scenario where 1000 jobs are added each
        // millisecond, which is a bit optimistic, jobs could be added at that
        // rate for a bit over 285 years for the test below to be true.
        //
        // So, it is safe to just silently fail here.
        if (!Number.isSafeInteger(newJobId)) {
            break;
        }

        newJob.reader = new FileReader();

        newJob.reader.onprogress = event => {
            if (globalThis.slowModeEnabled && globalThis.FILE_READING_DELAY_MILLISECONDS) {
                const start = Date.now(); while (Date.now() - start < globalThis.FILE_READING_DELAY_MILLISECONDS);
            }
            const percent = event.total ? Math.floor(100 * event.loaded / event.total) : 100;
            globalThis.postReply('bytesRead', newJobId, percent);
        };

        newJob.reader.onerror = event => {
            const error = {
                'name': event.target.error.name,
                'message': event.target.error.message,
                'fileName': newJob.file.name
            };
            globalThis.postReply('fileReadError', newJobId, error);
        };
        newJob.reader.onload = event => {
            const [marker] = new Uint8Array(event.target.result);
            globalThis.postReply('fileReadOK', newJobId, marker);
        };
        newJob.reader.onabort = () => {
            globalThis.postReply('jobCancelled', newJobId);
        };

        globalThis.jobs.set(newJobId, newJob);
        globalThis.postReply('jobCreated', newJobId, newJob.file.name);
        break;
    }
    case 'processJob':
    case 'retryJob': {
        if (job.file.size > globalThis.MAX_FILE_SIZE_BYTES) {
            const error = {
                'name': 'FileTooLargeError',
                'fileName': job.file.name
            };
            globalThis.postReply('fileReadError', jobId, error);
        } else {
            // The file is read using the HTML5 File API.
            // Read the file as ArrayBuffer.
            job.reader.readAsArrayBuffer(job.file);
        }
        break;
    }
    case 'cancelJob':
        job.reader.abort();
        break;
    case 'deleteJob': {
        job.reader.abort();
        job.reader.onload = null;
        job.reader.onerror = null;
        job.reader.onabort = null;
        globalThis.jobs.delete(args);

        globalThis.postReply('jobDeleted', jobId);
        break;
    }
    default:
        globalThis.postReply('commandNotFound', command);
    }
});
