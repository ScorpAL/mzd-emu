const { styleText } = require('node:util');

const ICONS = {
    debug: '·',
    info: 'ℹ️',
    success: '✅',
    warn: '⚠️',
    error: '❌'
};

function write(level, scope, message, ...args) {
    const color = {
        debug: 'gray',
        info: 'blue',
        success: 'green',
        warn: 'yellow',
        error: 'red'
    }[level];
    const icon = ICONS[level] || ICONS.info;
    const prefix = styleText(color, `${icon} [${scope}]`);
    console.log(`${prefix} ${message}`, ...args);
}

module.exports = {
    debug(scope, message, ...args) {
        write('debug', scope, message, ...args);
    },
    info(scope, message, ...args) {
        write('info', scope, message, ...args);
    },
    success(scope, message, ...args) {
        write('success', scope, message, ...args);
    },
    warn(scope, message, ...args) {
        write('warn', scope, message, ...args);
    },
    error(scope, message, ...args) {
        write('error', scope, message, ...args);
    }
};
