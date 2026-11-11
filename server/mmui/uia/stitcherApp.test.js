const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const stitcherApp = require('./stitcherApp');
const dispatcher = require('../dispatcher');
const settings = require('../services/settings');
const { createMockWs, contexts, contextPaths } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStackPaths } = require('../../testing/state');
const { useMockTimers } = require('../../testing/timers');

// Sends GUI events through the dispatcher, as [uiaId, eventId] pairs.
function send(ws, ...events) {
    events.forEach(([uiaId, eventId]) => dispatcher(ws, uiaId, eventId, {}));
}

const OPEN = ['system', 'SelectStitcher'];
const OK = ['common', 'Global.Yes'];

function setPhone(bluetooth, link) {
    settings.currentSettings.bluetooth = bluetooth;
    settings.HARDWARE_CONFIG.phoneBluetoothConnection = link;
}

describe('stitcherApp', () => {
    useCleanState();
    // A phone is connected (the emulator reports its mock phone) unless a test says otherwise.
    beforeEach(() => setPhone('On', 'On'));

    describe('the phone', () => {
        it('is connected only when both the head unit Bluetooth and the phone link are On', () => {
            for (const [bluetooth, link, expected] of [
                ['On', 'On', true],
                ['On', 'Off', false],
                ['Off', 'On', false],
                ['Off', 'Off', false]
            ]) {
                setPhone(bluetooth, link);
                assert.equal(stitcherApp.isPhoneConnected(), expected, `${bluetooth}/${link}`);
            }
        });
    });

    describe('with a phone', () => {
        it('SelectStitcher opens the Loading context of the stitcher application', () => {
            const ws = createMockWs();
            send(ws, OPEN);
            stitcherApp.cancelConnect(ws);
            assert.deepEqual(contextPaths(ws), ['stitcher/Loading']);
        });

        it('the failed connection opens ErrorCondition with the configured errorID', () => {
            stitcherApp.config.connectTimeoutMs = 0;
            stitcherApp.config.errorId = 'MobileDeviceError';
            const ws = createMockWs();
            stitcherApp.handleSelectStitcher(ws);

            assert.deepEqual(contexts(ws), ['Loading', 'ErrorCondition']);
            const error = ws.messages.find((m) => m.ctxtId === 'ErrorCondition');
            assert.equal(error.params.payload.errorID, 'MobileDeviceError');
            assert.equal(stitcherApp.dialogs.errorActive, true);
        });

        it('the error appears after the timeout, and not after the user left', (t) => {
            const timers = useMockTimers(t);
            stitcherApp.config.connectTimeoutMs = 2500;
            const stayed = createMockWs();
            const left = createMockWs();

            stitcherApp.handleSelectStitcher(stayed);
            stitcherApp.handleSelectStitcher(left);
            send(left, ['common', 'Global.IntentHome']);
            timers.tick(2499);
            assert.deepEqual(contexts(stayed), ['Loading']);

            timers.tick(1);
            assert.deepEqual(contexts(stayed), ['Loading', 'ErrorCondition']);
            assert.deepEqual(contexts(left), ['Loading', 'HomeScreen']);
        });

        it('the Entertainment Menu button of Loading goes back to the Entertainment list', () => {
            const ws = createMockWs();
            stitcherApp.handleSelectStitcher(ws);
            ws.messages.length = 0;
            send(ws, ['stitcher', 'SelectSource']);
            assert.deepEqual(contextPaths(ws), ['system/Entertainment']);
        });

        it('OK on the error dialog (Global.Yes) goes back to the Entertainment list', () => {
            stitcherApp.config.connectTimeoutMs = 0;
            const ws = createMockWs();
            stitcherApp.handleSelectStitcher(ws);
            ws.messages.length = 0;
            send(ws, OK);
            assert.deepEqual(contexts(ws), ['Entertainment']);
            assert.equal(stitcherApp.dialogs.errorActive, false);
        });
    });

    describe('without a phone', () => {
        for (const [bluetooth, link, why] of [
            ['Off', 'On', 'the head unit Bluetooth is Off'],
            ['On', 'Off', 'the phone link is Off']
        ]) {
            it(`shows the No Device Connected window and starts nothing when ${why}`, () => {
                setPhone(bluetooth, link);
                stitcherApp.config.connectTimeoutMs = 0;
                const ws = createMockWs();
                send(ws, OPEN);
                assert.equal(stitcherApp.isPhoneConnected(), false);
                assert.deepEqual(contextPaths(ws), ['system/NoDevice']);
                assert.equal(stitcherApp.dialogs.errorActive, false);
            });
        }

        it('Connect closes the window and opens Settings > Devices > Bluetooth', () => {
            setPhone('Off', 'On');
            setBackStack(['system', 'Entertainment']);
            const ws = createMockWs();
            send(ws, OPEN);
            ws.messages.length = 0;

            send(ws, ['system', 'SelectConnect']);
            assert.deepEqual(contextPaths(ws), ['btpairing/BTConnectionManager']);
            // The window is gone from the back stack: Back from Bluetooth does not bring it again.
            assert.deepEqual(backStackPaths(), [
                'system/Entertainment',
                'btpairing/BTConnectionManager'
            ]);
        });

        it('No (Global.GoBack) returns to the Entertainment list', () => {
            setPhone('Off', 'On');
            setBackStack(['system', 'Entertainment']);
            const ws = createMockWs();
            send(ws, OPEN);
            ws.messages.length = 0;
            send(ws, ['common', 'Global.GoBack']);
            assert.deepEqual(contextPaths(ws), ['system/Entertainment']);
        });
    });

    // The back stack must not grow with every visit to Stitcher: the Back button of the
    // Entertainment list needs one press.
    describe('the back stack', () => {
        beforeEach(() => {
            stitcherApp.config.connectTimeoutMs = 0;
        });

        it('OK on Stitcher Not Found returns to the same Entertainment entry, not a new one', () => {
            const ws = createMockWs();
            send(ws, ['system', 'SelectEntertainment']);
            const before = backStackPaths();
            for (let i = 0; i < 3; i += 1) {
                send(ws, OPEN, OK);
            }
            assert.deepEqual(backStackPaths(), before);
        });

        it('the Entertainment Menu button of Loading does not grow it either', () => {
            stitcherApp.config.connectTimeoutMs = 2500;
            const ws = createMockWs();
            send(ws, ['system', 'SelectEntertainment']);
            const before = backStackPaths();
            send(ws, OPEN, ['stitcher', 'SelectSource']);
            assert.deepEqual(backStackPaths(), before);
        });

        it('Back from the Entertainment list after visits to Stitcher leaves it at the first press', () => {
            const ws = createMockWs();
            setBackStack(['system', 'HomeScreen']);
            send(ws, ['system', 'SelectEntertainment']);
            for (let i = 0; i < 3; i += 1) {
                send(ws, OPEN, OK);
            }
            ws.messages.length = 0;
            send(ws, ['common', 'Global.GoBack']);
            assert.deepEqual(contexts(ws), ['HomeScreen']);
        });
    });
});
