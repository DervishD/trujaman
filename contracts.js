function buildContractObject(object) {
    return Object.freeze(Object.fromEntries(Object.keys(object).map(key => [key, key])));
}


globalThis.unknownCommand = buildContractObject({unknownCommand: null}).unknownCommand;


globalThis.serviceWorkerCommands = buildContractObject({
    getVersion: null,
});


globalThis.serviceWorkerReplies = buildContractObject({
    versionReported: null,
});


globalThis.webWorkerCommands = buildContractObject({
    registerFormats: null,
    createJob: null,
    processJob: null,
    deleteJob: null,
});


globalThis.webWorkerReplies = buildContractObject({
    jobCreated: null,
    jobDeleted: null,
    bytesRead: null,
    fileReadError: null,
    fileReadComplete: null,
    fileTooLarge: null,
});


globalThis.customEvents = buildContractObject({
    jobDismissed: null,
    processingRequested: null,
    interactionHalted: null,
});
