const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const startup = require('./startup');
const settings = require('./settings');
const { createMockWs, msgIds, payloadOf } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

describe('startup', () => {
    useCleanState();

    it('the startup settings carry region, language, units and vehicle identity', () => {
        const ws = createMockWs();
        startup.sendStartupSettings(ws);
        for (const msgId of [
            'Region',
            'KeyboardLanguage',
            'TimeFormat',
            'Temperature',
            'Distance',
            'VehicleType',
            'Destination',
            'LanguageSupported'
        ]) {
            assert.ok(msgIds(ws).includes(msgId), msgId);
        }
        assert.equal(payloadOf(ws, 'Region').RegionValue, settings.HARDWARE_CONFIG.region);
    });

    describe('the clock', () => {
        it('sends the current epoch moved by clockOffsetSeconds', (t) => {
            t.mock.method(Date, 'now', () => 1_700_000_000_000);
            settings.currentSettings.clockOffsetSeconds = 3600;
            const ws = createMockWs();
            startup.sendCurrentTimeEpoch(ws);
            assert.deepEqual(msgIds(ws), ['SendCurrentTimeEpoch']);
            assert.equal(payloadOf(ws, 'SendCurrentTimeEpoch').u32TimestampSec, 1_700_003_600);
        });

        it('is refreshed as often as the firmware refreshes it', () => {
            assert.equal(startup.CLOCK_SYNC_INTERVAL_MS, 60000);
        });
    });
});
