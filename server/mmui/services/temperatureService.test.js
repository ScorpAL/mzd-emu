const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const temperatureService = require('./temperatureService');
const systemApp = require('../uia/systemApp');
const syssettingsApp = require('../uia/syssettingsApp');
const dispatcher = require('../dispatcher');
const { createMockWs, contexts } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');

// A GUI connection that the service watches until the test ends.
function createClient(t) {
    const ws = createMockWs();
    temperatureService.attach(ws);
    t.after(() => ws.close());
    return ws;
}

const overMessages = (ws) =>
    ws.messages.filter((m) => m.msgId === 'DisplayOverTemperature').map((m) => m.params.payload);

// Sets the sensor and lets the service poll it, as its timer does.
function heat(celsius) {
    temperatureService.setTemperature(celsius);
    temperatureService.poll();
}

describe('temperatureService', () => {
    useCleanState();

    describe('the sensor', () => {
        it('is clamped to the slider range and rounded', () => {
            temperatureService.setTemperature(500);
            assert.equal(temperatureService.getState().temperatureC, 100);
            temperatureService.setTemperature(-5);
            assert.equal(temperatureService.getState().temperatureC, 20);
            temperatureService.setTemperature(42.6);
            assert.equal(temperatureService.getState().temperatureC, 43);
        });

        it('ignores a value that is not a finite number', () => {
            temperatureService.setTemperature(40);
            for (const value of ['90', NaN, Infinity, null, undefined]) {
                temperatureService.setTemperature(value);
            }
            assert.equal(temperatureService.getState().temperatureC, 40);
        });

        it('nothing happens until the poll sees the display over the limit', (t) => {
            const ws = createClient(t);
            temperatureService.setTemperature(90);
            assert.deepEqual(contexts(ws), []);

            temperatureService.poll();
            assert.deepEqual(overMessages(ws), [{ displayOverTemperature: true }]);
            assert.deepEqual(contexts(ws), ['SystemWarning']);
        });

        it('over-temperature ends only below the lower limit', (t) => {
            const ws = createClient(t);
            heat(90);
            heat(82);
            assert.equal(temperatureService.isOver(), true);
            heat(79);
            assert.equal(temperatureService.isOver(), false);
            assert.deepEqual(overMessages(ws), [
                { displayOverTemperature: true },
                { displayOverTemperature: false }
            ]);
            // The dialog is shown once per crossing, not on every poll.
            assert.deepEqual(contexts(ws), ['SystemWarning']);
        });

        it('a GUI that connects while the display is hot is told so at startup', () => {
            heat(90);
            const ws = createMockWs();
            syssettingsApp.sendDisplayState(ws);
            assert.deepEqual(overMessages(ws), [{ displayOverTemperature: true }]);
        });
    });

    describe('the warning', () => {
        it('waits for the boot video and the Disclaimer', (t) => {
            const ws = createClient(t);
            systemApp.dialogs.introAnimationActive = true;
            heat(95);
            assert.deepEqual(contexts(ws), []);

            systemApp.dialogs.introAnimationActive = false;
            systemApp.dialogs.disclaimerActive = true;
            systemApp.dismissDisclaimer(ws);
            assert.deepEqual(contexts(ws), ['HomeScreen', 'SystemWarning']);
        });

        it('OK goes to Home, and the warning stays gone while it is still hot', (t) => {
            const ws = createClient(t);
            setBackStack(['syssettings', 'DisplayTab']);
            heat(90);
            assert.equal(systemApp.isSystemWarningOpen(ws), true);

            dispatcher(ws, 'common', 'Global.Yes', {});
            assert.equal(systemApp.isSystemWarningOpen(ws), false);
            assert.deepEqual(backStack(), ['HomeScreen']);

            temperatureService.poll();
            assert.deepEqual(contexts(ws), ['SystemWarning', 'HomeScreen']);
        });

        it('cooling down does not close it', (t) => {
            const ws = createClient(t);
            heat(90);
            heat(30);
            assert.equal(systemApp.isSystemWarningOpen(ws), true);
            assert.deepEqual(contexts(ws), ['SystemWarning']);
        });
    });

    describe('clients and listeners', () => {
        it('a GUI that disconnected is not told anything any more', (t) => {
            const gone = createClient(t);
            const stays = createClient(t);
            gone.close();
            heat(90);
            assert.deepEqual(overMessages(gone), []);
            assert.deepEqual(overMessages(stays), [{ displayOverTemperature: true }]);
        });

        it('listeners are told every change until they unsubscribe', () => {
            const seen = [];
            const unsubscribe = temperatureService.onChange((state) => seen.push(state));
            temperatureService.setTemperature(40);
            unsubscribe();
            temperatureService.setTemperature(50);
            assert.deepEqual(
                seen.map((state) => state.temperatureC),
                [40]
            );
        });
    });
});
