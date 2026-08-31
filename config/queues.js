// config/queues.js

// O limite de jogadores por fila é sempre 2
const LIMITE_PESSOAS = 2;

const limitesFila = {
    '1x1': LIMITE_PESSOAS,
    '2x2': LIMITE_PESSOAS,
    '3x3': LIMITE_PESSOAS,
    '4x4': LIMITE_PESSOAS
};

// Filas de Mobile
const filasMobile = {
    '1x1': [],
    '2x2': [],
    '3x3': [],
    '4x4': []
};

// Filas de Emulador
const filasEmu = {
    '1x1': [],
    '2x2': [],
    '3x3': [],
    '4x4': []
};

// Filas Mistas
const filasMistas = {
    '2x2-misto': [],
    '3x3-misto': [],
    '4x4-misto': []
};

module.exports = {
    LIMITE_PESSOAS,
    limitesFila,
    filasMobile,
    filasEmu,
    filasMistas
};
