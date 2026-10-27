const spawn = require('child_process').spawn;
const path = require('path');
const logger = require('./logger');

const KILL_TIMEOUT_MS = 3000;
let stopping = false;

const children = [
    { name: 'mmui', script: path.join(__dirname, 'mmui-server.js') },
    { name: 'ui', script: path.join(__dirname, 'ui-server.js') }
].map(function (entry) {
    const child = spawn(process.execPath, [entry.script], {
        stdio: 'inherit',
        env: { ...process.env, MZD_OPEN_BROWSER: process.env.MZD_OPEN_BROWSER || '1' }
    });
    child.on('error', function (error) {
        logger.error('launcher', '%s failed to start: %s', entry.name, error.message);
        process.exitCode = 1;
        shutdown();
    });
    child.on('exit', function (code, signal) {
        logger.info('launcher', '%s exited (code=%s, signal=%s)', entry.name, code, signal);
        if (!stopping) {
            process.exitCode = code || 0;
        }
        shutdown();
        if (children.every(isDone)) {
            process.exit(process.exitCode || 0);
        }
    });
    return { name: entry.name, proc: child };
});

function isDone(entry) {
    return entry.proc.exitCode !== null || entry.proc.signalCode !== null;
}

// Stops the children, waits for them to exit, and force-kills any that hang.
function shutdown() {
    if (stopping) {
        return;
    }
    stopping = true;
    children.filter((entry) => !isDone(entry)).forEach((entry) => entry.proc.kill());
    setTimeout(function () {
        children
            .filter((entry) => !isDone(entry))
            .forEach(function (entry) {
                logger.warn('launcher', '%s did not stop in time, killing it', entry.name);
                entry.proc.kill('SIGKILL');
            });
    }, KILL_TIMEOUT_MS).unref();
}

logger.info('launcher', 'Started MMUI and UI servers');

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
