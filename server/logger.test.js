const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const logger = require('./logger');
const { captureLogs } = require('./testing/logs');
const { useMockTimers } = require('./testing/timers');

// Lines carry the time of this fixed clock.
function capture(t, level) {
    const logs = captureLogs(t, level);
    logger.configure({ now: () => new Date(2026, 0, 2, 3, 4, 5) });
    return logs;
}

describe('logger', () => {
    afterEach(() => logger.flush());

    describe('line format', () => {
        it('a line has the time, the level, the scope and the message', (t) => {
            const logs = capture(t, 'info');
            logger.info('screen', '%s/%s', 'system', 'HomeScreen');
            assert.deepEqual(logs.lines, ['03:04:05 INFO  screen        system/HomeScreen']);
        });

        it('the output also gets each line as data', (t) => {
            const logs = capture(t, 'debug');
            logger.success('gui', 'connected %d', 2);
            logger.error('mmui', 'broken');
            assert.deepEqual(logs.records, [
                { level: 'success', scope: 'gui', message: 'connected 2' },
                { level: 'error', scope: 'mmui', message: 'broken' }
            ]);
        });

        it('the banner frames its title and text', (t) => {
            const logs = capture(t, 'error');
            logger.banner('Open in your browser:', 'http://x/');
            assert.deepEqual(logs.records, [
                { level: 'banner', scope: null, message: 'Open in your browser: http://x/' }
            ]);
            assert.match(logs.lines[0], /║ Open in your browser: ║/);
        });
    });

    describe('levels', () => {
        it('debug lines are hidden at the info level and shown at debug', (t) => {
            const logs = capture(t, 'info');
            logger.debug('gui', 'hidden');
            logger.info('gui', 'shown');
            assert.deepEqual(
                logs.records.map((r) => r.message),
                ['shown']
            );

            logger.configure({ level: 'debug' });
            logger.debug('gui', 'now shown');
            assert.equal(logs.records.at(-1).message, 'now shown');
        });

        it('warnings and errors are shown at the warn level, info and success are not', (t) => {
            const logs = capture(t, 'warn');
            logger.info('gui', 'quiet');
            logger.success('gui', 'quiet too');
            logger.warn('gui', 'careful');
            logger.error('gui', 'broken');
            assert.deepEqual(
                logs.records.map((r) => r.level),
                ['warn', 'error']
            );
        });

        it('configure() returns the previous options, which put the logger back', (t) => {
            const logs = capture(t, 'info');
            const other = [];
            const previous = logger.configure({ level: 'error', out: (line) => other.push(line) });
            assert.equal(previous.level, 'info');

            const replaced = logger.configure(previous);
            assert.equal(replaced.level, 'error');
            logger.info('gui', 'back');
            assert.deepEqual(other, []);
            assert.equal(logs.records.at(-1).message, 'back');
        });
    });

    describe('repeats', () => {
        it('the same line repeated right away is printed once with a count', (t) => {
            const logs = capture(t, 'debug');
            for (let i = 0; i < 5; i++) {
                logger.debug('vehsettings', 'Sent safety state');
            }
            logger.info('gui', 'next');

            assert.equal(logs.lines.length, 3);
            assert.match(logs.lines[1], /repeated 4 more times/);
            assert.deepEqual(logs.records[1], {
                level: 'debug',
                scope: 'vehsettings',
                message: 'Sent safety state',
                repeats: 4
            });
            assert.match(logs.lines[2], /next$/);
        });

        it('the count is printed on its own after a quiet moment', (t) => {
            const timers = useMockTimers(t);
            const logs = capture(t, 'debug');
            logger.warn('gui', 'again');
            logger.warn('gui', 'again');
            assert.equal(logs.records.length, 1);

            timers.tick(200);
            assert.equal(logs.records.length, 2);
            assert.equal(logs.records[1].repeats, 1);
        });

        it('a different scope or level is not a repeat', (t) => {
            const logs = capture(t, 'debug');
            logger.info('a', 'same');
            logger.info('b', 'same');
            logger.warn('b', 'same');
            assert.equal(logs.records.length, 3);
        });
    });
});
