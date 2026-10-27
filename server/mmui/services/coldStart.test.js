const test = require('node:test');
const assert = require('node:assert/strict');

const coldStart = require('./coldStart');

function createWs() {
    return { once: () => {} };
}

test('waitForBoot waits for the configured boot time', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const saved = coldStart.config.bootDelayMs;
    coldStart.config.bootDelayMs = 3000;
    try {
        const calls = [];
        coldStart.waitForBoot(createWs(), () => calls.push('booted'));

        t.mock.timers.tick(2999);
        assert.deepEqual(calls, []);
        t.mock.timers.tick(1);
        assert.deepEqual(calls, ['booted']);
    } finally {
        coldStart.config.bootDelayMs = saved;
    }
});

test('a boot time of 0 runs the step at once', () => {
    const saved = coldStart.config.bootDelayMs;
    coldStart.config.bootDelayMs = 0;
    try {
        const calls = [];
        coldStart.waitForBoot(createWs(), () => calls.push('booted'));
        assert.deepEqual(calls, ['booted']);
    } finally {
        coldStart.config.bootDelayMs = saved;
    }
});

test('waitForIntroEnd takes the length of the boot video and cancel stops it', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const ws = createWs();
    const calls = [];

    coldStart.waitForIntroEnd(ws, () => calls.push('ended'));
    t.mock.timers.tick(4999);
    assert.deepEqual(calls, []);
    t.mock.timers.tick(1);
    assert.deepEqual(calls, ['ended']);

    coldStart.waitForIntroEnd(ws, () => calls.push('again'));
    coldStart.cancel(ws);
    t.mock.timers.tick(10000);
    assert.deepEqual(calls, ['ended']);
});
