const test = require('node:test');
const assert = require('node:assert/strict');

const stitcherApp = require('./stitcherApp');
const dispatcher = require('../dispatcher');
const { createMockWs } = require('../../testing/mockWs');
const settings = require('../services/settings');
const navigationState = require('../state/navigationState');

const originalConfig = Object.assign({}, stitcherApp.config);
const originalBluetooth = settings.currentSettings.bluetooth;
const originalPhoneLink = settings.HARDWARE_CONFIG.phoneBluetoothConnection;

// A phone is connected (the emulator reports its mock phone) unless a test says otherwise.
test.beforeEach(() => {
    settings.currentSettings.bluetooth = 'On';
    settings.HARDWARE_CONFIG.phoneBluetoothConnection = 'On';
    navigationState.goBackStack.length = 0;
});

test.afterEach(() => {
    Object.assign(stitcherApp.config, originalConfig);
    stitcherApp.dialogs.errorActive = false;
    settings.currentSettings.bluetooth = originalBluetooth;
    settings.HARDWARE_CONFIG.phoneBluetoothConnection = originalPhoneLink;
    navigationState.goBackStack.length = 0;
});

function contexts(ws) {
    return ws.messages.filter((m) => m.msgType === 'ctxtChg');
}

test('SelectStitcher opens the Loading context of the stitcher application', () => {
    const ws = createMockWs();

    dispatcher(ws, 'system', 'SelectStitcher', {});
    stitcherApp.cancelConnect(ws);

    const ctxt = contexts(ws);
    assert.equal(ctxt.length, 1);
    assert.equal(ctxt[0].uiaId, 'stitcher');
    assert.equal(ctxt[0].ctxtId, 'Loading');
});

test('the failed connection opens ErrorCondition with the configured errorID', () => {
    stitcherApp.config.connectTimeoutMs = 0;
    stitcherApp.config.errorId = 'MobileDeviceError';
    const ws = createMockWs();

    stitcherApp.handleSelectStitcher(ws);

    const ctxt = contexts(ws);
    assert.deepEqual(
        ctxt.map((c) => c.ctxtId),
        ['Loading', 'ErrorCondition']
    );
    assert.equal(ctxt[1].params.payload.errorID, 'MobileDeviceError');
    assert.equal(stitcherApp.dialogs.errorActive, true);
});

test('the error appears after the timeout, and not after the user left', async () => {
    stitcherApp.config.connectTimeoutMs = 20;
    const stayed = createMockWs();
    const left = createMockWs();

    stitcherApp.handleSelectStitcher(stayed);
    stitcherApp.handleSelectStitcher(left);
    dispatcher(left, 'common', 'Global.IntentHome', {});
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.ok(contexts(stayed).some((c) => c.ctxtId === 'ErrorCondition'));
    assert.ok(!contexts(left).some((c) => c.ctxtId === 'ErrorCondition'));
});

test('the Entertainment Menu button of Loading goes back to the Entertainment list', () => {
    const ws = createMockWs();
    stitcherApp.handleSelectStitcher(ws);
    ws.messages.length = 0;

    dispatcher(ws, 'stitcher', 'SelectSource', {});

    const ctxt = contexts(ws);
    assert.equal(ctxt.length, 1);
    assert.equal(ctxt[0].uiaId, 'system');
    assert.equal(ctxt[0].ctxtId, 'Entertainment');
});

test('OK on the error dialog (Global.Yes) goes back to the Entertainment list', () => {
    stitcherApp.config.connectTimeoutMs = 0;
    const ws = createMockWs();
    stitcherApp.handleSelectStitcher(ws);
    ws.messages.length = 0;

    dispatcher(ws, 'common', 'Global.Yes', {});

    const ctxt = contexts(ws);
    assert.equal(ctxt.length, 1);
    assert.equal(ctxt[0].ctxtId, 'Entertainment');
    assert.equal(stitcherApp.dialogs.errorActive, false);
});

test('without a phone, Stitcher shows the No Device Connected window and starts nothing', () => {
    settings.currentSettings.bluetooth = 'Off';
    stitcherApp.config.connectTimeoutMs = 0;
    const ws = createMockWs();

    dispatcher(ws, 'system', 'SelectStitcher', {});

    const ctxt = contexts(ws);
    assert.equal(stitcherApp.isPhoneConnected(), false);
    assert.deepEqual(
        ctxt.map((c) => c.uiaId + '/' + c.ctxtId),
        ['system/NoDevice']
    );
    assert.equal(stitcherApp.dialogs.errorActive, false);
});

test('Connect in the No Device window closes it and opens Settings > Devices > Bluetooth', () => {
    settings.currentSettings.bluetooth = 'Off';
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Entertainment', contextSeq: 1 });
    const ws = createMockWs();
    dispatcher(ws, 'system', 'SelectStitcher', {});
    ws.messages.length = 0;

    dispatcher(ws, 'system', 'SelectConnect', {});

    const ctxt = contexts(ws);
    assert.equal(ctxt.length, 1);
    assert.equal(ctxt[0].uiaId, 'btpairing');
    assert.equal(ctxt[0].ctxtId, 'BTConnectionManager');
    // the window is gone from the back stack: Back from the Bluetooth screen does not bring it again
    assert.ok(!navigationState.goBackStack.some((c) => c.ctxtId === 'NoDevice'));
});

test('No in the No Device window (Global.GoBack) returns to the Entertainment list', () => {
    settings.currentSettings.bluetooth = 'Off';
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Entertainment', contextSeq: 1 });
    const ws = createMockWs();
    dispatcher(ws, 'system', 'SelectStitcher', {});
    ws.messages.length = 0;

    dispatcher(ws, 'common', 'Global.GoBack', {});

    const ctxt = contexts(ws);
    assert.equal(ctxt.length, 1);
    assert.equal(ctxt[0].uiaId, 'system');
    assert.equal(ctxt[0].ctxtId, 'Entertainment');
});

test('Bluetooth On but the phone not connected (its own Bluetooth is off) also shows No Device Connected', () => {
    settings.currentSettings.bluetooth = 'On';
    settings.HARDWARE_CONFIG.phoneBluetoothConnection = 'Off';
    const ws = createMockWs();

    dispatcher(ws, 'system', 'SelectStitcher', {});

    assert.equal(stitcherApp.isPhoneConnected(), false);
    assert.deepEqual(
        contexts(ws).map((c) => c.uiaId + '/' + c.ctxtId),
        ['system/NoDevice']
    );
});

test('the phone is connected only when both the head unit Bluetooth and the phone link are On', () => {
    const cases = [
        ['On', 'On', true],
        ['On', 'Off', false],
        ['Off', 'On', false],
        ['Off', 'Off', false]
    ];
    cases.forEach(([bluetooth, link, expected]) => {
        settings.currentSettings.bluetooth = bluetooth;
        settings.HARDWARE_CONFIG.phoneBluetoothConnection = link;
        assert.equal(stitcherApp.isPhoneConnected(), expected, bluetooth + '/' + link);
    });
});

// The back stack must not grow with every visit to Stitcher: the Back button of the Entertainment list needs one press.
function stackLabels() {
    return navigationState.goBackStack.map((c) => c.uiaId + '/' + c.ctxtId);
}

test('OK on Stitcher Not Found returns to the same Entertainment entry of the back stack, not a new one', () => {
    stitcherApp.config.connectTimeoutMs = 0;
    const ws = createMockWs();
    dispatcher(ws, 'system', 'SelectEntertainment', {});
    const before = stackLabels();

    for (let i = 0; i < 3; i += 1) {
        dispatcher(ws, 'system', 'SelectStitcher', {});
        dispatcher(ws, 'common', 'Global.Yes', {});
    }

    assert.deepEqual(stackLabels(), before);
});

test('the Entertainment Menu button of Loading does not grow the back stack either', () => {
    const ws = createMockWs();
    dispatcher(ws, 'system', 'SelectEntertainment', {});
    const before = stackLabels();

    dispatcher(ws, 'system', 'SelectStitcher', {});
    dispatcher(ws, 'stitcher', 'SelectSource', {});

    assert.deepEqual(stackLabels(), before);
});

test('Back from the Entertainment list after visits to Stitcher leaves the list at the first press', () => {
    stitcherApp.config.connectTimeoutMs = 0;
    const ws = createMockWs();
    dispatcher(ws, 'system', 'IntentHome', {});
    navigationState.goBackStack.length = 0;
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'HomeScreen', contextSeq: 1 });
    dispatcher(ws, 'system', 'SelectEntertainment', {});
    for (let i = 0; i < 3; i += 1) {
        dispatcher(ws, 'system', 'SelectStitcher', {});
        dispatcher(ws, 'common', 'Global.Yes', {});
    }
    ws.messages.length = 0;

    dispatcher(ws, 'common', 'Global.GoBack', {});

    const ctxt = contexts(ws);
    assert.equal(ctxt.length, 1);
    assert.equal(ctxt[0].ctxtId, 'HomeScreen');
});
