export const commands = {
    registerFormats: '',
    setSlowMode: '',
    createJob: '',
    processJob: '',
    retryJob: '',
    cancelJob: '',
    deleteJob: '',
};
Object.keys(commands).forEach(key => { commands[key] = key; });
Object.freeze(commands);


export const customEvents = {
    jobDismiss: null,
    jobCancel: null,
    jobRetry: null,
    slowModeToggle: null,
    processFiles: null,
};
Object.keys(customEvents).forEach(key => { customEvents[key] = `custom:${key}`; });
Object.freeze(customEvents);


console.info('Contracts script processed.');
