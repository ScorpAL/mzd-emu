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

function banner(title, text) {
    const width = Math.max(title.length, text.length) + 4;
    const line = (content) => `║ ${content.padEnd(width - 4)} ║`;
    const lines = [
        `╔${'═'.repeat(width - 2)}╗`,
        line(title),
        line(text),
        `╚${'═'.repeat(width - 2)}╝`
    ];
    console.log(`\n${lines.map((l) => styleText(['green', 'bold'], l)).join('\n')}\n`);
}

module.exports = {
    banner,
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
