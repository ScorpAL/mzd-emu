const test = require('node:test');
const assert = require('node:assert/strict');

const temperatureService = require('./temperatureService');
const systemApp = require('../uia/systemApp');
const dispatcher = require('../dispatcher');
const navigationState = require('../state/navigationState');
const { createMockWs } = require('../../testing/mockWs');

function createClient() {
    const ws = createMockWs();
    ws.once = () => {};
    temperatureService.attach(ws);
    return ws;
}

const overMessages = (ws) =>
    ws.messages.filter((m) => m.msgId === 'DisplayOverTemperature').map((m) => m.params.payload);
const contexts = (ws) => ws.messages.filter((m) => m.msgType === 'ctxtChg').map((m) => m.ctxtId);

test.afterEach(() => {
    temperatureService.reset();
    navigationState.goBackStack.length = 0;
    systemApp.dialogs.introAnimationActive = false;
    systemApp.dialogs.disclaimerActive = false;
});

test('the sensor value is clamped to the slider range', () => {
    temperatureService.setTemperature(500);
    assert.equal(temperatureService.getState().temperatureC, 100);
    temperatureService.setTemperature(-5);
    assert.equal(temperatureService.getState().temperatureC, 20);
});

test('nothing happens until the poll sees the display over the limit', () => {
    const ws = createClient();

    temperatureService.setTemperature(90);

    assert.deepEqual(contexts(ws), []);
    temperatureService.poll();
    assert.deepEqual(overMessages(ws), [{ displayOverTemperature: true }]);
    assert.deepEqual(contexts(ws), ['SystemWarning']);
});

test('over-temperature ends only below the lower limit', () => {
    const ws = createClient();
    temperatureService.setTemperature(90);
    temperatureService.poll();

    temperatureService.setTemperature(82);
    temperatureService.poll();
    assert.equal(temperatureService.isOver(), true);

    temperatureService.setTemperature(79);
    temperatureService.poll();
    assert.equal(temperatureService.isOver(), false);
    assert.deepEqual(overMessages(ws), [
        { displayOverTemperature: true },
        { displayOverTemperature: false }
    ]);
    // The dialog is shown once per crossing, not on every poll.
    assert.deepEqual(contexts(ws), ['SystemWarning']);
});

test('the warning waits for the boot video and the Disclaimer', () => {
    const ws = createClient();
    systemApp.dialogs.introAnimationActive = true;
    temperatureService.setTemperature(95);
    temperatureService.poll();
    assert.deepEqual(contexts(ws), []);

    systemApp.dialogs.introAnimationActive = false;
    systemApp.dialogs.disclaimerActive = true;
    systemApp.dismissDisclaimer(ws);

    assert.deepEqual(contexts(ws), ['HomeScreen', 'SystemWarning']);
});

test('OK on the warning goes to Home and the warning stays gone while it is still hot', () => {
    const ws = createClient();
    navigationState.goBackStack.push({ uiaId: 'syssettings', ctxtId: 'DisplayTab', contextSeq: 3 });
    temperatureService.setTemperature(90);
    temperatureService.poll();
    assert.equal(systemApp.isSystemWarningOpen(ws), true);

    dispatcher(ws, 'common', 'Global.Yes', {});

    assert.equal(systemApp.isSystemWarningOpen(ws), false);
    assert.equal(contexts(ws).pop(), 'HomeScreen');
    assert.deepEqual(
        navigationState.goBackStack.map((entry) => entry.ctxtId),
        ['HomeScreen']
    );
    temperatureService.poll();
    assert.deepEqual(contexts(ws), ['SystemWarning', 'HomeScreen']);
});

test('cooling down does not close the warning', () => {
    const ws = createClient();
    temperatureService.setTemperature(90);
    temperatureService.poll();

    temperatureService.setTemperature(30);
    temperatureService.poll();

    assert.equal(systemApp.isSystemWarningOpen(ws), true);
    assert.deepEqual(contexts(ws), ['SystemWarning']);
});

test('a GUI that connects while the display is hot is told so at startup', () => {
    temperatureService.setTemperature(90);
    temperatureService.poll();
    const ws = createMockWs();

    require('../uia/syssettingsApp').sendDisplayState(ws);

    assert.deepEqual(overMessages(ws), [{ displayOverTemperature: true }]);
});
