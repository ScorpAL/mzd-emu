const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const coldStart = require('./coldStart');
const { createMockWs } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');
const { useMockTimers } = require('../../testing/timers');

describe('coldStart', () => {
    useCleanState();

    describe('waitForBoot', () => {
        it('waits for the configured boot time', (t) => {
            const timers = useMockTimers(t);
            coldStart.config.bootDelayMs = 3000;
            const calls = [];
            coldStart.waitForBoot(createMockWs(), () => calls.push('booted'));

            timers.tick(2999);
            assert.deepEqual(calls, []);
            timers.tick(1);
            assert.deepEqual(calls, ['booted']);
        });

        it('a boot time of 0 runs the step at once', () => {
            coldStart.config.bootDelayMs = 0;
            const calls = [];
            coldStart.waitForBoot(createMockWs(), () => calls.push('booted'));
            assert.deepEqual(calls, ['booted']);
        });

        it('a GUI that disconnects during the boot time gets nothing', (t) => {
            const timers = useMockTimers(t);
            coldStart.config.bootDelayMs = 3000;
            const ws = createMockWs();
            const calls = [];
            coldStart.waitForBoot(ws, () => calls.push('booted'));
            ws.close();
            timers.tick(10000);
            assert.deepEqual(calls, []);
        });
    });

    describe('waitForIntroEnd', () => {
        it('takes the length of the boot video, and cancel stops it', (t) => {
            const timers = useMockTimers(t);
            const ws = createMockWs();
            const calls = [];

            coldStart.waitForIntroEnd(ws, () => calls.push('ended'));
            timers.tick(4999);
            assert.deepEqual(calls, []);
            timers.tick(1);
            assert.deepEqual(calls, ['ended']);

            coldStart.waitForIntroEnd(ws, () => calls.push('again'));
            coldStart.cancel(ws);
            timers.tick(10000);
            assert.deepEqual(calls, ['ended']);
        });

        it('each GUI connection has its own timers', (t) => {
            const timers = useMockTimers(t);
            const first = createMockWs();
            const second = createMockWs();
            const calls = [];
            coldStart.waitForIntroEnd(first, () => calls.push('first'));
            coldStart.waitForIntroEnd(second, () => calls.push('second'));
            coldStart.cancel(first);
            timers.tick(5000);
            assert.deepEqual(calls, ['second']);
        });
    });
});
