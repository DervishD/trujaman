export const ERRMSG = {
    FORMATS_NOT_FOUND: 'No se encontró el fichero con la lista de formatos',
    CANNOT_PROCESS_FORMATS: 'No se pudo procesar el fichero con la lista de formatos',
    CANNOT_RUN_SW: 'No se pudo iniciar el service worker',
    COOKIES_ARE_DISABLED: 'Las cookies están desactivadas',
    WW_SYNTAX: lineno => `Error de sintaxis en el web worker, línea ${lineno}`,
    CANNOT_RUN_WW: 'No se pudo iniciar el web worker',
    UNKNOWN_WW_COMMAND: command => `El web worker no reconoce el comando «${command}»`,
    UNKNOWN_WW_REPLY: reply => `No se reconoce la respuesta del web worker «${reply}»`,
    FILE_READ: error => `Error «${error.name}» leyendo el fichero «${error.fileName}»`,
    FILE_TOO_LARGE: 'el fichero es muy grande',
    FILE_NOT_FOUND: 'el fichero no existe',
    FILE_NOT_READABLE: 'el fichero no se puede leer',
    FILE_SECURITY: 'el fichero no se puede leer de forma segura',
}


export const MSG = {
    NO_INFORMATION: 'No hay información.',
    JOB_STATE_PROCESSING: 'Leyendo el fichero…',
    JOB_STATE_READING: 'Leyendo el fichero ',
    JOB_STATE_PROCESSED: 'El fichero se leyó correctamente.',
    JOB_STATE_RETRYING: 'Reintentando…',  // cspell:disable-line
    JOB_STATE_CANCELLING: 'Cancelando el fichero…',
    JOB_STATE_CANCELLED: 'Lectura cancelada.',
    JOB_STATE_ERROR: 'Error: ',
    JOB_DEBUGMARKER: contents => {
        const HEX_RADIX = 16;
        const TARGET_LENGTH = 2;
        const PAD_STRING = '0';
        const marker = `data <0x${contents.toString(HEX_RADIX).padStart(TARGET_LENGTH, PAD_STRING)}>`;
        return typeof contents === 'undefined' ? 'empty file' : marker;
    },
}


export const STR = {
    UPLOAD_MODE_SLOW: '⊖',
    UPLOAD_MODE_FAST: '⊕',
}


export const LOG = {
    WW_SENDING_COMMAND: command =>`Sending command '${command}'`,
    WW_RECEIVED_COMMAND: command => `Received command '${command}'`,
    WW_SENDING_REPLY: reply => `Sending reply '${reply}'`,
    WW_RECEIVED_REPLY: reply => `Received reply '${reply}'`,
    SCRIPT_PROCESSED: script => `${script} script processed.`,
    SW_INSTALLING: version => `Installing service worker v${version}`,
    SW_ACTIVATING: version => `Activating service worker v${version}`,
    SW_FETCH_REQUEST: url => `Fetch request for ${url}`,
    SW_FETCH_REQUEST_NON_GET: method => `Fetch request with non-GET method '${method}'`,
    SW_FETCH_REQUEST_CROSS_ORIGIN: url => `Cross-origin fetch request for '${url}'`,
}
