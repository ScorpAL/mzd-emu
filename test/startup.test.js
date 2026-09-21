const test = require('node:test');
const assert = require('node:assert/strict');

const startup = require('../server/mmui/startup');
const settings = require('../server/mmui/settings');
const { createMockWs } = require('./helpers/mockWs');

test('sendStartupSettings sends region, language, units and vehicle identity', () => {
    const ws = createMockWs();

    startup.sendStartupSettings(ws);

    const msgIds = ws.messages.map((m) => m.msgId);
    assert.ok(msgIds.includes('Region'));
    assert.ok(msgIds.includes('KeyboardLanguage'));
    assert.ok(msgIds.includes('TimeFormat'));
    assert.ok(msgIds.includes('Temperature'));
    assert.ok(msgIds.includes('Distance'));
    assert.ok(msgIds.includes('VehicleType'));
    assert.ok(msgIds.includes('Destination'));
    assert.ok(msgIds.includes('LanguageSupported'));

    const region = ws.messages.find((m) => m.msgId === 'Region');
    assert.equal(region.params.payload.RegionValue, settings.HARDWARE_CONFIG.region);
});

test('sendCurrentTimeEpoch sends a msg with an epoch offset by clockOffsetSeconds', () => {
    const ws = createMockWs();
    const before = Math.round(Date.now() / 1000);

    startup.sendCurrentTimeEpoch(ws);

    assert.equal(ws.messages.length, 1);
    assert.equal(ws.messages[0].msgId, 'SendCurrentTimeEpoch');
    const sentTimestamp = ws.messages[0].params.payload.u32TimestampSec;
    assert.ok(sentTimestamp >= before + settings.currentSettings.clockOffsetSeconds - 1);
});

test('CLOCK_SYNC_INTERVAL_MS matches the firmware clock refresh interval', () => {
    assert.equal(startup.CLOCK_SYNC_INTERVAL_MS, 60000);
});
