const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const netmgmtApp = require('./netmgmtApp');
const settings = require('../services/settings');
const { createMockWs, contexts, msgIds, payloadOf } = require('../../testing/mockWs');
const { useCleanState, setBackStack } = require('../../testing/state');

const current = settings.currentSettings;

describe('netmgmtApp', () => {
    const fixture = useCleanState();

    it('the Wi-Fi state reports seeded networks when wifiNetworks is On and empty when Off', () => {
        const prev = settings.HARDWARE_CONFIG.wifiNetworks;
        try {
            current.wifiMode = 1;
            settings.HARDWARE_CONFIG.wifiNetworks = 'On';
            const ws = createMockWs();
            netmgmtApp.sendWifiState(ws);
            assert.deepEqual(msgIds(ws), [
                'WifiMode',
                'WifiStatus',
                'ScannedNetworksList',
                'RememberedNetworksList'
            ]);
            assert.equal(payloadOf(ws, 'WifiStatus').onOffState, 1);
            assert.equal(payloadOf(ws, 'WifiStatus').connectedState, 1);
            assert.ok(payloadOf(ws, 'ScannedNetworksList').size > 0);
            assert.ok(payloadOf(ws, 'RememberedNetworksList').size > 0);

            settings.HARDWARE_CONFIG.wifiNetworks = 'Off';
            const wsOff = createMockWs();
            netmgmtApp.sendWifiState(wsOff);
            assert.equal(payloadOf(wsOff, 'WifiStatus').connectedState, 0);
            assert.equal(payloadOf(wsOff, 'ScannedNetworksList').size, 0);
        } finally {
            settings.HARDWARE_CONFIG.wifiNetworks = prev;
        }
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

    it('OtherNetwork updates SSID and securityType via KeyboardInput and SecurityOptions', () => {
        try {
            setBackStack(['netmgmt', 'NetworkOptions']);
            const ws = createMockWs();
            netmgmtApp.events.SelectOtherNetwork(ws);
            assert.deepEqual(contexts(ws), ['OtherNetwork']);

            netmgmtApp.events.SelectNameSSID(ws);
            assert.deepEqual(contexts(ws).slice(-1), ['KeyboardInput']);

            netmgmtApp.events.SubmitKeyboardInput(ws, { payload: { input: 'Hidden-Lab' } });
            assert.equal(netmgmtApp.getHiddenNetworkInfo().networkName, 'Hidden-Lab');
            assert.deepEqual(contexts(ws).slice(-1), ['OtherNetwork']);

            netmgmtApp.events.SelectSecurity(ws);
            assert.deepEqual(contexts(ws).slice(-1), ['SecurityOptions']);

            netmgmtApp.events.SelectSecurityType(ws, { payload: { securityType: 8 } });
            assert.equal(netmgmtApp.getHiddenNetworkInfo().securityType, 8);
            assert.deepEqual(contexts(ws).slice(-1), ['OtherNetwork']);
        } finally {
            netmgmtApp.resetHiddenNetworkInfo();
        }
    });
});
