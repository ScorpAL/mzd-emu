const test = require('node:test');
const assert = require('node:assert/strict');

const btpairingApp = require('./btpairingApp');
const navigationState = require('../state/navigationState');
const settings = require('../services/settings');
const { createMockWs } = require('../../testing/mockWs');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
});

test('cancelling Discoverable returns to Bluetooth connection manager', () => {
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'BTConnectionManager',
        contextSeq: 1
    });
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'Discoverable',
        contextSeq: 2
    });

    const messages = [];
    const handled = btpairingApp.handleCancel({
        send(message) {
            messages.push(message);
        }
    });

    assert.equal(handled, true);
    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(navigationState.goBackStack[0].ctxtId, 'BTConnectionManager');
    assert.equal(messages.length, 4);
    assert.equal(JSON.parse(messages[1].slice(0, -1)).ctxtId, 'BTConnectionManager');
});

test('cancelling another Bluetooth context is ignored', () => {
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'BTConnectionManager',
        contextSeq: 1
    });

    assert.equal(
        btpairingApp.handleCancel({
            send() {}
        }),
        false
    );
});

test('the mock phone is listed as connected only while its own Bluetooth link is On', () => {
    const originalBluetooth = settings.currentSettings.bluetooth;
    const originalLink = settings.HARDWARE_CONFIG.phoneBluetoothConnection;
    try {
        function phoneItem(bluetooth, link) {
            settings.currentSettings.bluetooth = bluetooth;
            settings.HARDWARE_CONFIG.phoneBluetoothConnection = link;
            const ws = createMockWs();
            btpairingApp.sendPhoneConnectedStatus(ws);
            return ws.messages.find((m) => m.msgId === 'BTStatusAndList').params.payload
                .pairedDeviceList.listItem[0];
        }

        assert.equal(phoneItem('On', 'On').status, 1);
        // Bluetooth of the head unit On, the phone's own Bluetooth off: the phone is in the list but not connected
        assert.equal(phoneItem('On', 'Off').status, 0);
        assert.equal(phoneItem('On', 'Off').itemLabel, 'Mock Phone');
        assert.equal(phoneItem('Off', 'On'), undefined);
    } finally {
        settings.currentSettings.bluetooth = originalBluetooth;
        settings.HARDWARE_CONFIG.phoneBluetoothConnection = originalLink;
    }
});
