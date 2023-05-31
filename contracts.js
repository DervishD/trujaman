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


console.info('Contracts script processed.');
