const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const netmgmtApp = require('./netmgmtApp');
const settings = require('../services/settings');
const { createMockWs, contexts, msgIds, payloadOf } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

const current = settings.currentSettings;

describe('netmgmtApp', () => {
    const fixture = useCleanState();

    it('the Wi-Fi state reports the mode, the status and empty network lists', () => {
        current.wifiMode = 1;
        const ws = createMockWs();
        netmgmtApp.sendWifiState(ws);
        assert.deepEqual(msgIds(ws), [
            'WifiMode',
            'WifiStatus',
            'ScannedNetworksList',
            'RememberedNetworksList'
        ]);
        assert.equal(payloadOf(ws, 'WifiStatus').onOffState, 1);
    });

    it('SetWifiConnection saves the requested on/off state', () => {
        const ws = createMockWs();
        netmgmtApp.handleSetWifiConnection(ws, { payload: { offOn: 0 } });
        assert.equal(current.wifiMode, 0);
        netmgmtApp.handleSetWifiConnection(ws, { payload: { offOn: 1 } });
        assert.equal(current.wifiMode, 1);
        assert.equal(fixture.saves, 2);
    });

    it('SelectWifiMode saves a given mode and sends the state again', () => {
        current.wifiMode = 1;
        const ws = createMockWs();
        netmgmtApp.handleSelectWifiMode(ws, { payload: { wifiMode: 0 } });
        assert.equal(current.wifiMode, 0);
        assert.ok(msgIds(ws).includes('WifiMode'));
    });

    it('Network Management opens the access-point-off screen without wireless CarPlay', () => {
        settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable = 'Off';
        const ws = createMockWs();
        netmgmtApp.handleSelectNetworkManagement(ws);
        assert.deepEqual(contexts(ws), ['NetworkOptions']);
    });
});
