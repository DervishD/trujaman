import {SCRIPT_PROCESSED} from './strings.js';


export const commands = Object.freeze(Object.fromEntries(Object.keys({
    registerFormats: null,
    slowModeToggle: null,
    createJob: null,
    processJob: null,
    retryJob: null,
    cancelJob: null,
    deleteJob: null,
}).map(key => [key, key])));


export const replies = Object.freeze(Object.fromEntries(Object.keys({
    commandNotFound: null,
    showSlowModeIndicator: null,
    slowModeState: null,
    jobCreated: null,
    jobCancelled: null,
    jobDeleted: null,
    bytesRead: null,
    fileReadError: null,
    fileReadComplete: null,
    fileTooLarge: null,
}).map(key => [key, key])));


export const customEvents = Object.freeze(Object.fromEntries(Object.keys({
    jobDismiss: null,
    jobCancel: null,
    jobRetry: null,
    slowModeToggle: null,
    processFiles: null,
}).map(key => [key, key])));


console.info(SCRIPT_PROCESSED('Constants'));  // eslint-disable-line new-cap
