'use strict';


importScripts('version.js');  /* global DEBUG */


globalThis.jobs = {};

// eslint-disable-next-line no-magic-numbers
globalThis.MAX_FILE_SIZE_BYTES = 9999 * 1024 * 1024;

// For delaying for file reading operations so the UI can be tested better.
// Only used in debug mode, set to 0 to disable any delay EVEN in debug mode.
globalThis.FILE_READING_DELAY_MILLISECONDS = 500;


globalThis.addEventListener('message', event => {
    const {command, args} = event.data;

    if (command in globalThis) {
        globalThis[command](args);
    } else {
        globalThis.postReply('commandNotFound', '', command);
    }
});


// Helper for building the object needed in calls to postMessage().
globalThis.postReply = function postReply (reply, jobId, payload) {
    globalThis.postMessage({reply, jobId, payload});
};


globalThis.createJob = function createJob (file) {
    // There's a problem with File objects: they don't have paths, only names.
    // So, there's no way of telling if two user-selected files are the same or
    // not, because they may have the same name but come from different dirs.
    //
    // Best effort here is to create a kind of hash from the file name, size and
    // the last modification time. This is not bulletproof, as the user may own
    // and select for upload different files from different directories whose
    // names, sizes and modification times are equal, but STILL have different
    // contents.
    //
    // Anyway, this minimizes the possibility of leaving the user unable to add
    // a file just because it has the same name than one previously selected, if
    // they come from different folders. The chances of both files having the
    // exact same size and modification time are quite reduced. Hopefully.
    const job = {
        'id': `${file.name}_${file.size}_${file.lastModified}`,
        file,
        'reader': null
    };

    if (job.id in globalThis.jobs) return;
    globalThis.jobs[job.id] = job;

    job.reader = new FileReader();

    job.reader.onprogress = event => {
        if (DEBUG && globalThis.FILE_READING_DELAY_MILLISECONDS) {
            // Delay each reading operation in debug mode so the UI can be examined.
            const start = Date.now(); while (Date.now() - start < globalThis.FILE_READING_DELAY_MILLISECONDS);
        }
        // eslint-disable-next-line no-magic-numbers
        const percent = event.total ? Math.floor(100 * event.loaded / event.total) : 100;
        globalThis.postReply('bytesRead', job.id, percent);
    };

    job.reader.onerror = event => {
        const error = {
            'name': event.target.error.name,
            'message': event.target.error.message,
            'fileName': job.file.name
        };
        globalThis.postReply('fileReadError', job.id, error);
    };
    job.reader.onload = event => globalThis.postReply('fileReadOK', job.id, new Uint8Array(event.target.result)[0]);
    job.reader.onabort = () => globalThis.postReply('jobCancelled', job.id);

    globalThis.postReply('jobCreated', job.id, job.file.name);
};


globalThis.deleteJob = function deleteJob (jobId) {
    const job = globalThis.jobs[jobId];

    globalThis.handleCancelJob(jobId);

    job.onload = null;
    job.onerror = null;
    job.onabort = null;
    delete globalThis.jobs[jobId];

    globalThis.postReply('jobDeleted', jobId);
};


globalThis.processJob = function processJob (jobId) {
    const job = globalThis.jobs[jobId];

    if (job.file.size > globalThis.MAX_FILE_SIZE_BYTES) {
        const error = {
            'name': 'FileTooLargeError',
            'message': 'El fichero es demasiado grande para ser procesado',
            'fileName': job.file.name
        };
        globalThis.postReply('fileReadError', job.id, error);
    } else {
        // The file is read using the HTML5 File API.
        // Read the file as ArrayBuffer.
        job.reader.readAsArrayBuffer(job.file);
    }
};


globalThis.cancelJob = function cancelJob (jobId) {
    globalThis.jobs[jobId].reader.abort();
};
