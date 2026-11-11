const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const btpairingApp = require('./btpairingApp');
const settings = require('../services/settings');
const { createMockWs, contexts, payloadOf } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');

// What sendPhoneConnectedStatus (the status bar and the paired list) reports for the given
// head unit Bluetooth switch and the mock phone's own Bluetooth link.
function phoneStatus(bluetooth, link) {
    settings.currentSettings.bluetooth = bluetooth;
    settings.HARDWARE_CONFIG.phoneBluetoothConnection = link;
    const ws = createMockWs();
    btpairingApp.sendPhoneConnectedStatus(ws);
    return {
        list: payloadOf(ws, 'BTStatusAndList').pairedDeviceList,
        signal: payloadOf(ws, 'SignalStrengthStatus').signalStrengthValue,
        battery: payloadOf(ws, 'BatteryStatus')
    };
}

describe('btpairingApp', () => {
    const fixture = useCleanState();

    describe('Bluetooth state', () => {
        it('carries the switch, the head unit identity and the projection status', () => {
            for (const [bluetooth, status] of [
                ['On', 1],
                ['Off', 0]
            ]) {
                settings.currentSettings.bluetooth = bluetooth;
                const ws = createMockWs();
                btpairingApp.sendBluetoothState(ws);

                const list = payloadOf(ws, 'BTStatusAndList').pairedDeviceList;
                assert.equal(list.status, status, bluetooth);
                assert.deepEqual(list.listItem, []);
                assert.equal(payloadOf(ws, 'DeviceInfo').DeviceInfoMsg.deviceName, 'Mazda');
                assert.equal(payloadOf(ws, 'CarPlayConnectionStatus').isCarPlayConnected, 0);
                assert.equal(
                    payloadOf(ws, 'AndroidAutoConnectionStatus').isAndroidAutoConnected,
                    false
                );
            }
        });

        it('the switch is saved and reported at once, without changing screen', () => {
            settings.currentSettings.bluetooth = 'Off';

            let ws = createMockWs();
            btpairingApp.events.ToggleBluetoothOn(ws);
            assert.equal(settings.currentSettings.bluetooth, 'On');
            assert.equal(payloadOf(ws, 'BTStatusAndList').pairedDeviceList.status, 1);
            assert.deepEqual(contexts(ws), []);

            ws = createMockWs();
            btpairingApp.events.ToggleBluetoothOff(ws);
            assert.equal(settings.currentSettings.bluetooth, 'Off');
            assert.equal(payloadOf(ws, 'BTStatusAndList').pairedDeviceList.status, 0);
            assert.equal(fixture.saves, 2);
        });
    });

    describe('the mock phone', () => {
        it('is listed as connected only while its own Bluetooth link is On', () => {
            assert.equal(phoneStatus('On', 'On').list.listItem[0].status, 1);
            // The head unit's Bluetooth On, the phone's own off: listed, but not connected.
            const linkOff = phoneStatus('On', 'Off').list.listItem[0];
            assert.equal(linkOff.status, 0);
            assert.equal(linkOff.itemLabel, 'Mock Phone');
            assert.equal(linkOff.connect_disconnect_Success, 0);
            assert.deepEqual(phoneStatus('Off', 'On').list.listItem, []);
        });

        it('the status bar shows signal and battery only while Bluetooth is On', () => {
            const on = phoneStatus('On', 'On');
            assert.equal(on.signal, 4);
            assert.equal(on.battery.currValue, 4);
            assert.equal(on.battery.PhoneBatteryStatusAvailable, true);
            assert.equal(on.list.status, 1);
            assert.equal(on.list.listItem.length, 1);

            const off = phoneStatus('Off', 'On');
            assert.equal(off.signal, -1);
            assert.equal(off.battery.currValue, 0);
            assert.equal(off.battery.PhoneBatteryStatusAvailable, false);
            assert.equal(off.list.status, 0);
        });

        it('with the phone link off the emulator still shows signal and battery', () => {
            // The indicators follow the Bluetooth switch only (current emulator behaviour, not
            // checked on the car).
            assert.equal(phoneStatus('On', 'Off').signal, 4);
        });
    });

    describe('screens', () => {
        it('each screen refreshes the Bluetooth state, then opens its context', () => {
            for (const [eventId, expected] of [
                ['SelectBluetooth', 'BTConnectionManager'],
                ['SelectBluetoothSettings', 'BluetoothSettings'],
                ['AddNewDevice', 'Discoverable']
            ]) {
                setBackStack();
                const ws = createMockWs();
                btpairingApp.events[eventId](ws);
                assert.deepEqual(contexts(ws), [expected], eventId);
                assert.equal(ws.messages[0].msgId, 'BTStatusAndList', `${eventId}: state first`);
                assert.deepEqual(backStack(), [expected]);
            }
        });
    });

    describe('Cancel', () => {
        it('in Discoverable goes back through the real Add New Device flow', () => {
            btpairingApp.events.SelectBluetooth(createMockWs());
            btpairingApp.events.AddNewDevice(createMockWs());
            assert.deepEqual(backStack(), ['BTConnectionManager', 'Discoverable']);

            const ws = createMockWs();
            assert.equal(btpairingApp.handleCancel(ws), true);
            assert.deepEqual(backStack(), ['BTConnectionManager']);
            assert.deepEqual(contexts(ws), ['BTConnectionManager']);
        });

        it('in another Bluetooth context is not handled', () => {
            setBackStack(['btpairing', 'BTConnectionManager']);
            const ws = createMockWs();
            assert.equal(btpairingApp.handleCancel(ws), false);
            assert.deepEqual(ws.messages, []);
        });

        it('is not handled on an empty stack, outside btpairing, or without a screen below', () => {
            const ws = createMockWs();
            assert.equal(btpairingApp.handleCancel(ws), false, 'empty stack');

            setBackStack(['syssettings', 'Discoverable']);
            assert.equal(btpairingApp.handleCancel(ws), false, 'another application');

            setBackStack(['btpairing', 'Discoverable']);
            assert.equal(btpairingApp.handleCancel(ws), false, 'nothing to go back to');
            assert.deepEqual(backStack(), ['Discoverable'], 'the stack is left alone');
            assert.deepEqual(ws.messages, []);
        });
    });
});
