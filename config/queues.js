// ============================================================================
// CONFIGURAÇÃO DE FILAS
// ============================================================================

const LIMITE_PESSOAS = 2;

const limitesFila = {
    '1x1': LIMITE_PESSOAS,
    '2x2': LIMITE_PESSOAS,
    '3x3': LIMITE_PESSOAS,
    '4x4': LIMITE_PESSOAS
};

const filasMobile = {
    '1x1': [],
    '2x2': [],
    '3x3': [],
    '4x4': []
};

const filasEmu = {
    '1x1': [],
    '2x2': [],
    '3x3': [],
    '4x4': []
};

// Filas Mistas estruturadas com formato e valor padrão
const filasMistas = {
    '2x2-misto': {
        formato: '2x2 Misto',
        valor: 5.00,
        emus: []
    },
    '3x3-misto': {
        formato: '3x3 Misto',
        valor: 5.00,
        emus: []
    },
    '4x4-misto': {
        formato: '4x4 Misto',
        valor: 5.00,
        emus: []
    }
};

module.exports = {
    LIMITE_PESSOAS,
    limitesFila,
    filasMobile,
    filasEmu,
    filasMistas
};
