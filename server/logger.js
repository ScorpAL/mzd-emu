const { format, styleText } = require('node:util');

// One line per event:  HH:MM:SS LEVEL scope     message
//
// What is shown depends on the level (MZD_LOG_LEVEL=debug|info|warn|error, default info):
//   info   what a person watching the emulator wants to see: servers starting, a GUI connecting,
//          every screen change, saved settings, the boot sequence, warnings and errors
//   debug  protocol detail: every event received, every message sent to the GUI
// Under `node --test` the default is warn so test output stays readable.
const LEVELS = { debug: 10, info: 20, success: 20, warn: 30, error: 40 };
const STYLES = {
    debug: { label: 'DEBUG', color: 'gray' },
    info: { label: 'INFO', color: 'blue' },
    success: { label: 'OK', color: 'green' },
    warn: { label: 'WARN', color: 'yellow' },
    error: { label: 'ERROR', color: 'red' }
};
const SCOPE_WIDTH = 13; // the longest scope is audiosettings
// Column where the message starts: time, level, scope and the separators.
const MESSAGE_COLUMN = 8 + 1 + 5 + 1 + SCOPE_WIDTH + 1;
// An identical line repeated right away is printed once, followed by a count.
const REPEAT_FLUSH_MS = 200;

function defaultLevel(env) {
    const name = String(env.MZD_LOG_LEVEL || '').toLowerCase();
    if (name === 'success' || !(name in LEVELS)) {
        return env.NODE_TEST_CONTEXT ? 'warn' : 'info';
    }
    return name;
}

const state = {
    threshold: LEVELS[defaultLevel(process.env)],
    out: (line) => console.log(line),
    now: () => new Date(),
    last: null, // { key, repeats }
    timer: null
};

function clock() {
    const d = state.now();
    const two = (n) => String(n).padStart(2, '0');
    return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
}

function flushRepeats() {
    clearTimeout(state.timer);
    state.timer = null;
    if (state.last && state.last.repeats > 0) {
        const times = state.last.repeats;
        state.out(styleText('gray', `${' '.repeat(MESSAGE_COLUMN)}↳ repeated ${times} more times`));
    }
    state.last = null;
}

function write(level, scope, message, args) {
    if (LEVELS[level] < state.threshold) {
        return;
    }
    const text = format(message, ...args);
    const key = `${level}|${scope}|${text}`;
    if (state.last && state.last.key === key) {
        state.last.repeats += 1;
        return;
    }
    flushRepeats();
    const style = STYLES[level];
    state.out(
        [
            styleText('gray', clock()),
            styleText(style.color, style.label.padEnd(5)),
            styleText('cyan', scope.padEnd(SCOPE_WIDTH)),
            text
        ].join(' ')
    );
    state.last = { key, repeats: 0 };
    state.timer = setTimeout(flushRepeats, REPEAT_FLUSH_MS);
    state.timer.unref();
}

function banner(title, text) {
    flushRepeats();
    const width = Math.max(title.length, text.length) + 4;
    const line = (content) => `║ ${content.padEnd(width - 4)} ║`;
    const lines = [
        `╔${'═'.repeat(width - 2)}╗`,
        line(title),
        line(text),
        `╚${'═'.repeat(width - 2)}╝`
    ];
    state.out(`\n${lines.map((l) => styleText(['green', 'bold'], l)).join('\n')}\n`);
}

// For tests: change where lines go, the level and the clock.
function configure(options) {
    flushRepeats();
    if (options.level) {
        state.threshold = LEVELS[options.level];
    }
    if (options.out) {
        state.out = options.out;
    }
    if (options.now) {
        state.now = options.now;
    }
}

process.on('exit', flushRepeats);

module.exports = {
    banner,
    configure,
    flush: flushRepeats,
    debug: (scope, message, ...args) => write('debug', scope, message, args),
    info: (scope, message, ...args) => write('info', scope, message, args),
    success: (scope, message, ...args) => write('success', scope, message, args),
    warn: (scope, message, ...args) => write('warn', scope, message, args),
    error: (scope, message, ...args) => write('error', scope, message, args)
};
