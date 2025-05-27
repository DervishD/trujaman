export const NOT_AVAILABLE = 'N/A';

export const TEXT_LOADING = 'Cargando…';
export const TEXT_DROPZONE = 'Arrastre y suelte aquí los ficheros';
export const TEXT_DEFAULT_CONTROL = 'Escoger ficheros';
export const TEXT_DOWNLOAD_DROPDOWN = 'Descargar en formato…';

export const FORMATS_NOT_FOUND = 'No se encontró el fichero con la lista de formatos';
export const CANNOT_PROCESS_FORMATS = 'No se pudo procesar la lista de formatos';

export const WW_TAG = 'web worker';
export const SW_TAG = 'service worker';

export const CANNOT_RUN_SW = `No se pudo iniciar el ${SW_TAG}`;
export const COOKIES_ARE_DISABLED = 'Las cookies están desactivadas';

export const WW_SYNTAX = (line, column) => `Error de sintaxis en el ${WW_TAG}, línea ${line}, columna ${column}`;
export const CANNOT_RUN_WW = `No se pudo iniciar el ${WW_TAG}`;

export const UNKNOWN_COMMAND = command => `Comando desconocido: «${command}»`;
export const UNKNOWN_REPLY = reply => `Respuesta desconocida: «${reply}»`;

export const JOB_STATE_READING = percentage => `Leyendo el fichero (${percentage}%).`;
export const JOB_STATE_PROCESSED = 'El fichero se leyó correctamente.';
export const JOB_STATE_ERROR = errorMessage => `Error: ${errorMessage}.`;
export const JOB_DEBUG_INFO = (id, data) => {
    const HEX_RADIX = 16;
    const TARGET_LENGTH = 2;
    const PAD_STRING = '0';
    const info = typeof data === 'undefined' ? 'empty file' : `${data.length} bytes`;
    const marker = `data <0x${data[0].toString(HEX_RADIX).padStart(TARGET_LENGTH, PAD_STRING)}>`;
    return `Id <${id}>, ${info}, ${marker}`;
};

export const FILE_READ = error => `Error «${error.name}» leyendo el fichero «${error.fileName}»`;
export const FILE_TOO_LARGE = 'el fichero es muy grande';
export const FILE_NOT_FOUND = 'el fichero no existe';
export const FILE_NOT_READABLE = 'el fichero no se puede leer';
export const FILE_SECURITY_ERROR = 'el fichero no se puede leer de forma segura';

export const APP_STOPPED = '¡ERROR, la aplicación no puede funcionar!';

export const ERROR_UNKNOWN = 'Error desconocido';
export const ERROR_DEFAULT_MESSAGE = 'sin gestionar';
export const ERROR_FORMATTED_NAME = name => `${name}()`;
export const ERROR_LOCATION = (filename, line, column) => `En ${filename}, línea ${line}, columna ${column}`;
export const ERROR_SUBSTACKDUMP_SEPARATOR = '\n—\n';
export const ERROR_STACKDUMP_HEADER = 'Información de depurado:\n';
export const ERROR_STACKDUMP_FRAMELINE = frame => `    ${frame.trim()}\n`;
export const ERROR_CONSOLE_SECTION_SEPARATOR = '\n\n';
