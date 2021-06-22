'use strict';

// To keep track of jobs.
self.jobs = {};

// Main entry point for web worker, a simple command dispatcher.
// Commands are responsible for replying with postmessage themselves because some of them are asynchronous.
// So, they don't return a value to this dispatcher that can be used to reply to main thread.
// The only exception are internal errors, of course.
self.addEventListener('message', event => {
    const {command, args} = event.data;
    const handler = `handle${command[0].toUpperCase()}${command.slice(1)}`;  // eslint-disable-line no-magic-numbers

    if (handler in self) {
        console.log('Got async command:', command, args);
        // Run the appropriate command.
        self[handler](args);
    } else {
        // Notify the internal error. Should not happen on production.
        self.postMessage({
            'reply': 'commandNotFound',
            'payload': {}
        });
    }
});


// This command creates a new file processing job, with the specified jobId, for
// the specified File object, assigning the necessary resources.
/* eslint-disable max-lines-per-function */
self.handleCreateJob = function handleCreateJob ([jobId, file]) {
    // This should not happen in production, but helps tracking weird errors.
    if (jobId in self.jobs) {
        self.postMessage({
            'reply': 'fileReadError',
            'payload': {
                jobId,
                'error': {
                    'name': 'ExistingFileError',
                    'message': 'Este fichero está siendo procesado',
                    'fileName': file.name
                }
            }
        });
    }

    // Store a reference for future use.
    const reader = new FileReader();
    self.jobs[jobId] = {
        reader,
        file
    };

    // Right now, mainly for testing purposes, to slow down the reading
    // process so the UI can be examined.
    reader.onprogress = event => {
        const DELAY = 500;
        const start = Date.now(); while (Date.now() - start < DELAY);  // Delay each reading operation.
        console.log(`${event.loaded} bytes read.`);
    };

    // Handle file reading errors.
    // This includes unsuccessful reads and discarded huge files.
    // The convoluted call to 'reject' is needed because Firefox can't clone an Error object.
    reader.onerror = event => self.postMessage({
        'reply': 'fileReadError',
        'payload': {
            jobId,
            'error': {
                'name': event.target.error.name,
                'message': event.target.error.message,
                'fileName': file.name
            }
        }
    });

    // Handle successful reads.
    reader.onload = event => self.postMessage({
        'reply': 'fileReadOK',
        'payload': {
            jobId,
            'data': new Uint8Array(event.target.result)[0]
        }
    });

    // Handle cancellation of reading process.
    reader.onabort = () => self.postMessage({
        'reply': 'jobCancelled',
        'payload': {
            jobId
        }
    });

    // Notify the operation was successful.
    self.postMessage({
        'reply': 'jobCreated',
        'payload': {
            jobId
        }
    });
};
/* eslint-enable max-lines-per-function */


// This command frees the resources associated with the job with the given
// jobId, so everything can be garbage collected at a later time.
self.handleDeleteJob = function handleDeleteJob (jobId) {
    const job = self.jobs[jobId];

    if (!job) return;

    // Cancel the job first.
    self.handleCancelJob(jobId);

    // Free resources.
    job.reader.onload = null;
    job.reader.onerror = null;
    job.reader.onabort = null;
    delete self.jobs[jobId];

    // Notify the operation was successful.
    self.postMessage({
        'reply': 'jobDeleted',
        'payload': {
            jobId
        }
    });
};


// This command processes the job with the specified jobId, reading the file and
// performing any other needed operation on that file or its contents.
//
// The file is read using the HTML5 File API.
self.handleProcessJob = function handleProcessJob (jobId) {
    const job = self.jobs[jobId];

    if (!job) return;


    // Refuse to process very large files.
    if (job.file.size > 9999 * 1024 * 1024) {  // Absolutely arbitrary maximum file size...
        self.postMessage({
            'reply': 'fileReadError',
            'payload': {
                jobId,
                'error': {
                    'name': 'FileTooLargeError',
                    'message': 'El fichero es demasiado grande para ser procesado',
                    'fileName': job.file.name
                }
            }
        });
    } else {
        // Read the file as ArrayBuffer.
        job.reader.readAsArrayBuffer(job.file);
    }
};


// This command cancels an in-progress job processing operation for the
// specified job. It is a nop if no job processing operation is currently
// happening.
//
// This is usually a successful operation, because the user actually requested
// the cancellation of the current job processing operation, so when it's
// aborted it actually IS a successful response to the request.
self.handleCancelJob = function handleCancelJob (jobId) {
    const job = self.jobs[jobId];

    if (!job) return;

    job.reader.abort();
};
