const test = require('node:test');
const assert = require('node:assert/strict');

const { ivfDurationMs } = require('../../../server/mmui/services/splashVideo');

test('ivfDurationMs measures the firmware boot video', () => {
    const ms = ivfDurationMs('TranLogo.ivf');
    assert.ok(ms >= 4900 && ms <= 5100, `unexpected duration ${ms}`);
});

test('ivfDurationMs returns null for missing or non-IVF files', () => {
    assert.equal(ivfDurationMs('DoesNotExist.ivf'), null);
    assert.equal(ivfDurationMs('Mazda.png'), null);
});
