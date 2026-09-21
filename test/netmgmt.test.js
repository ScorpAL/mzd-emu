const test = require('node:test');
const assert = require('node:assert/strict');

const netmgmtApp = require('../server/mmui/netmgmtApp');
const settings = require('../server/mmui/settings');
const { createMockWs } = require('./helpers/mockWs');

function withStubbedSave(fn) {
    const originalSave = settings.saveUserSettings;
    settings.saveUserSettings = () => {};
    try {
        fn();
    } finally {
        settings.saveUserSettings = originalSave;
    }
}

test.afterEach(() => {
    settings.currentSettings.wifiMode = 1;
});

test('sendWifiState reports mode, status and empty network lists', () => {
    const ws = createMockWs();
    settings.currentSettings.wifiMode = 1;

    netmgmtApp.sendWifiState(ws);

    const msgIds = ws.messages.map((m) => m.msgId);
    assert.deepEqual(msgIds, [
        'WifiMode',
        'WifiStatus',
        'ScannedNetworksList',
        'RememberedNetworksList'
    ]);
    assert.equal(ws.messages[1].params.payload.onOffState, 1);
});

test('handleSetWifiConnection persists the requested on/off state', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        netmgmtApp.handleSetWifiConnection(ws, { payload: { offOn: 0 } });
        assert.equal(settings.currentSettings.wifiMode, 0);

        netmgmtApp.handleSetWifiConnection(ws, { payload: { offOn: 1 } });
        assert.equal(settings.currentSettings.wifiMode, 1);
    });
});

test('handleSelectWifiMode updates and re-sends state when a mode is provided', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        netmgmtApp.handleSelectWifiMode(ws, { payload: { wifiMode: 0 } });
        assert.equal(settings.currentSettings.wifiMode, 0);
        assert.ok(ws.messages.some((m) => m.msgId === 'WifiMode'));
    });
});

test('handleSelectNetworkManagement picks the AP-off context when wireless CarPlay is unavailable', () => {
    const ws = createMockWs();
    const original = settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable;
    settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable = 'Off';

    netmgmtApp.handleSelectNetworkManagement(ws);

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'NetworkOptions');
    settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable = original;
});
