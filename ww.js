'use strict';

// To keep track of File Readers used in different transactions.
self.fileReaders = {};


// Main entry point for web worker, a simple command dispatcher.
// Commands are responsible for replying with postmessage themselves because some of them are asynchronous.
// So, they don't return a value to this dispatcher that can be used to reply to main thread.
// The only exception are internal errors, of course.
self.addEventListener('message', event => {
    const {id, command, args} = event.data;
    if (command in self) {
        // Run the appropriate command. The response will be sent back by the command itself.
        return self[command](id, args);
    } else {
        // Notify the internal error. Should not happen on production.
        const message = {
            id: id,
            status: null,
            payload: {  // This is needed because Firefox can't clone an Error object.
                name: 'TypeError',
                message: 'No existe el comando',
                data: command
            }
        };
        return self.postMessage(message);
    }
});


// Read the file specified by the provided File object, using the HTML5 File API.
function readFile (id, args) {
    let file = args[0];

    // Create a new FileReader to handle this File.
    let reader = new FileReader();

    // Remember it for further handling.
    self.fileReaders[file.hash] = reader;

    reader.fileName = file.name;

    // Instead of having three separate handlers, one for successful reads,
    // another for unsuccessful reads and a third one for aborted reads,
    // it's easier to have a single one for the three possible conditions.
    reader.onloadend = event => {
        const message = {
            id: id,
            status: null,
            payload: null
        };

        // To handle the fake error used to filter out huge files.
        let error = reader.error || reader.fileTooLargeError;

        if (error) {
            // This includes unsuccessful reads, discarded huge files and aborted reads.
            message.status = false;
            message.payload = {  // This is needed because Firefox can't clone an Error object.
                name: error.name,
                message: error.message,
                data: reader.fileName
            };
            self.postMessage(message);
        } else {
            // Successful reads, return file contents as a Transferable object, for efficiency.
            message.status = true;
            message.payload = event.target.result;
            self.postMessage(message, [event.target.result]);
        }
    };

    if (file.size > 9999 * 1024 * 1024) {  // Absolutely arbitrary maximum file size...
        // Use a fake event to handle this 'error' so all error handling happens in one place.
        let event = new ProgressEvent('loadend', {loaded: 0, total: 0});
        reader.fileTooLargeError = new DOMException('', 'FileTooLargeError');  // Fake event, fake error...
        reader.dispatchEvent(event);
    } else {
        // Read the file as ArrayBuffer.
        reader.readAsArrayBuffer(file);
    }
}


// This command aborts an in-progress file reading operation for the given File.
// It is a nop if no file reading operation is currently happening.
// This works even though id is not used, because the correct FileReader is retrieved for this file.
// The aforementioned FileReader has an onloadend handler with the correct id for this transaction,
// and that handler will send the reply back to the main thread.
function abortRead (id, args) {
    let file = args[0];
    let reader = self.fileReaders[file.hash];  // FileReader for this File.
    if (reader) reader.abort();
}


// This command marks the resources associated with the given File as no longer needed.
// The event handlers are removed, too.
// So, everything can be garbage collected at a later time.
// It should always resolve successfully with a null payload,
// but if for some reason a FileReader is not found for the current File,
// it will reject with an error. That should never happen in production.
function forgetFile (id, args) {
    let file = args[0];
    let reader = self.fileReaders[file.hash];  // FileReader for this File.
    const message = {
        id: id,
        status: true,
        payload: null
    }

    if (reader) {
        // Free resources.
        reader.onloadend = null;
        reader = null;
        delete self.fileReaders[file.hash];
    } else {
        // This really should not happen in production, but it's better to be safe than sorry.
        message.status = false;
        message.payload = {
            name: 'TypeError',
            message: 'No existe un FileReader para el fichero',
            data: file.name
        };
    }
    self.postMessage(message);
}