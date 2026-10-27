const test = require('node:test');
const assert = require('node:assert/strict');

const { stripVTControlCharacters } = require('node:util');
const logger = require('../server/logger');

function capture(level) {
    const lines = [];
    logger.configure({
        level: level,
        out: (line) => lines.push(stripVTControlCharacters(line)),
        now: () => new Date(2026, 0, 2, 3, 4, 5)
    });
    return lines;
}

test.afterEach(() => {
    logger.flush();
    logger.configure({ level: 'warn', out: () => {} });
});

test('a line has the time, the level, the scope and the message', () => {
    const lines = capture('info');
    logger.info('screen', '%s/%s', 'system', 'HomeScreen');
    assert.deepEqual(lines, ['03:04:05 INFO  screen        system/HomeScreen']);
});

test('debug lines are hidden at the info level and shown at debug', () => {
    const lines = capture('info');
    logger.debug('gui', 'hidden');
    logger.info('gui', 'shown');
    assert.equal(lines.length, 1);

    const all = capture('debug');
    logger.debug('gui', 'now shown');
    assert.equal(all.length, 1);
});

test('warnings and errors are shown at the warn level, info is not', () => {
    const lines = capture('warn');
    logger.info('gui', 'quiet');
    logger.warn('gui', 'careful');
    logger.error('gui', 'broken');
    assert.deepEqual(
        lines.map((line) => line.split(' ')[1]),
        ['WARN', 'ERROR']
    );
});

test('the same line repeated right away is printed once with a count', () => {
    const lines = capture('debug');
    for (let i = 0; i < 5; i++) {
        logger.debug('vehsettings', 'Sent safety state');
    }
    logger.info('gui', 'next');

    assert.equal(lines.length, 3);
    assert.match(lines[1], /repeated 4 more times/);
    assert.match(lines[2], /next$/);
});
