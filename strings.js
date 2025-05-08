export const SCRIPT_PROCESSED = script => `${script} script processed.`;

export const NOT_AVAILABLE = 'N/A';

export const TEXT_LOADING = 'Cargando…';
export const TEXT_DROPZONE = 'Arrastre y suelte aquí los ficheros';
export const TEXT_DEFAULT_CONTROL = 'Escoger ficheros';
export const TEXT_DOWNLOAD_DROPDOWN = 'Descargar en formato…';

export const DEFAULT_ERROR_NAME = 'Error desconocido';

export const FORMATS_NOT_FOUND = 'No se encontró el fichero con la lista de formatos';
export const CANNOT_PROCESS_FORMATS = 'No se pudo procesar la lista de formatos';

export const CANNOT_RUN_SW = 'No se pudo iniciar el service worker';
export const COOKIES_ARE_DISABLED = 'Las cookies están desactivadas';
export const SW_INSTALLING = version => `Installing service worker v${version}`;
export const SW_ACTIVATING = version => `Activating service worker v${version}`;
export const SW_FETCH_REQUEST = url => `Fetch request for ${url}`;
export const SW_FETCH_REQUEST_NON_GET = method => `Fetch request with non-GET method '${method}'`;
export const SW_FETCH_REQUEST_CROSS_ORIGIN = url => `Cross-origin fetch request for '${url}'`;

export const WW_SYNTAX = (line, column) => `Error de sintaxis en el web worker, línea ${line}, columna ${column}`;
export const CANNOT_RUN_WW = 'No se pudo iniciar el web worker';
export const WW_SENDING_COMMAND = command =>`Sending command '${command}'`;
export const WW_RECEIVED_COMMAND = command => `Received command '${command}'`;
export const UNKNOWN_WW_COMMAND = command => `El web worker no reconoce el comando «${command}»`;
export const WW_SENDING_REPLY = reply => `Sending reply '${reply}'`;
export const WW_RECEIVED_REPLY = reply => `Received reply '${reply}'`;
export const UNKNOWN_WW_REPLY = reply => `No se reconoce la respuesta del web worker «${reply}»`;

export const JOB_STATE_READING = percentage => `Leyendo el fichero (${percentage}%).`;
export const JOB_STATE_PROCESSED = 'El fichero se leyó correctamente.';
export const JOB_STATE_ERROR = errorMessage => `Error: ${errorMessage}.`;
export const JOB_DEBUG_INFO = (id, data) => {
    const HEX_RADIX = 16;
    const TARGET_LENGTH = 2;
    const PAD_STRING = '0';
    const info = typeof data === 'undefined' ? 'empty file' : `${data.length} bytes`;
    const marker = `data <0x${data[0].toString(HEX_RADIX).padStart(TARGET_LENGTH, PAD_STRING)}>`;
    return `<br><span class="monospaced">Id <${id}>, ${info}, ${marker}</span>`;
};

export const FILE_READ = error => `Error «${error.name}» leyendo el fichero «${error.fileName}»`;
export const FILE_TOO_LARGE = 'el fichero es muy grande';
export const FILE_NOT_FOUND = 'el fichero no existe';
export const FILE_NOT_READABLE = 'el fichero no se puede leer';
export const FILE_SECURITY_ERROR = 'el fichero no se puede leer de forma segura';

export const APP_STOPPED = '¡ERROR, la aplicación no puede funcionar!';
export const ERROR_MESSAGE = name => `${name ? `«${name}»` : DEFAULT_ERROR_NAME} sin gestionar`;
export const ERROR_LOCATION = (filename, line, column) => `En ${filename}, línea ${line}, columna ${column}`;
export const ERROR_SUBSTACK_SEPARATOR = '\n—\n';
export const ERROR_STACK_DUMP_SEPARATOR = '\n\n';
export const ERROR_STACK_DUMP_HEADER = 'Información de depurado:\n';
export const ERROR_STACK_DUMP_FRAME = frame => `    ${frame.trim()}\n`;
export const ERROR_FULL_STR = (message, location, details) => [message, location, details].filter(Boolean).join('\n\n');
