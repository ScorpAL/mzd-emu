const spawn = require('child_process').spawn;
const path = require('path');
const logger = require('./logger');

const children = [
    { name: 'mmui', script: path.join(__dirname, 'mmui-server.js') },
    { name: 'ui', script: path.join(__dirname, 'ui-server.js') }
].map(function (entry) {
    const child = spawn(process.execPath, [entry.script], { stdio: 'inherit' });
    child.on('error', function (error) {
        logger.error('launcher', '%s failed to start: %s', entry.name, error.message);
        stopAll();
        process.exitCode = 1;
    });
    child.on('exit', function (code, signal) {
        logger.info('launcher', '%s exited (code=%s, signal=%s)', entry.name, code, signal);
        stopAll();
        process.exit(code || 0);
    });
    return { name: entry.name, proc: child };
});

function stopAll() {
    children.forEach(function (entry) {
        if (!entry.proc.killed) {
            entry.proc.kill();
        }
    });
}

logger.info('launcher', 'Started MMUI and UI servers');

process.on('SIGINT', function () {
    stopAll();
    process.exit(0);
});
process.on('SIGTERM', function () {
    stopAll();
    process.exit(0);
});
