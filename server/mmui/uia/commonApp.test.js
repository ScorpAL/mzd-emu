const test = require('node:test');
const assert = require('node:assert/strict');

const commonApp = require('./commonApp');
const navigationState = require('../state/navigationState');
const syssettingsApp = require('./syssettingsApp');
const systemApp = require('./systemApp');
const { createMockWs } = require('../../testing/mockWs');
const { resetDialogs } = require('../../testing/dialogs');

const events = commonApp.events;

test.afterEach(() => {
    resetDialogs();
    navigationState.goBackStack.length = 0;
});

test('Global.Yes and Global.No only act for the common sender', () => {
    systemApp.dialogs.disclaimerActive = true;
    const ws = createMockWs();

    events['Global.Yes'](ws, {}, 'ecoenergy-unknown');
    assert.equal(systemApp.dialogs.disclaimerActive, true);

    events['Global.Yes'](ws, {}, 'Common');
    assert.equal(systemApp.dialogs.disclaimerActive, false);
});

test('Global.Yes answers the dialog that is open, in a fixed order', () => {
    systemApp.dialogs.disclaimerActive = true;
    syssettingsApp.dialogs.factoryResetConfirmActive = true;
    const ws = createMockWs();

    events['Global.Yes'](ws, {}, 'common');

    // The Disclaimer comes first; the factory reset dialog is left alone.
    assert.equal(systemApp.dialogs.disclaimerActive, false);
    assert.equal(syssettingsApp.dialogs.factoryResetConfirmActive, true);
});

test('Timeout closes only the Disclaimer', () => {
    const ws = createMockWs();
    events.Timeout(ws, {}, 'system');
    assert.equal(ws.messages.length, 0);

    systemApp.dialogs.disclaimerActive = true;
    events.Timeout(ws, {}, 'system');
    assert.equal(systemApp.dialogs.disclaimerActive, false);
    assert.equal(ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId, 'HomeScreen');
});

test('Global.GoBack clears the flag of the dialog it closes and shows the screen below', () => {
    navigationState.goBackStack.push(
        { uiaId: 'system', ctxtId: 'HomeScreen', contextSeq: 1 },
        { uiaId: 'syssettings', ctxtId: 'FactoryResetConfirm', contextSeq: 2 }
    );
    syssettingsApp.dialogs.factoryResetConfirmActive = true;
    const ws = createMockWs();

    events['Global.GoBack'](ws, {}, 'common-not-matching');

    assert.equal(syssettingsApp.dialogs.factoryResetConfirmActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId, 'HomeScreen');
});

test('Global.GoBack never empties the stack', () => {
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'HomeScreen', contextSeq: 1 });
    const ws = createMockWs();

    events['Global.GoBack'](ws, {}, 'common');

    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(ws.messages.length, 0);
});

test('SelectSettings opens the settings of the sender: ecoenergy has its own', () => {
    const fromSystem = createMockWs();
    events.SelectSettings(fromSystem, {}, 'system');
    assert.equal(fromSystem.messages.find((m) => m.msgType === 'ctxtChg').uiaId, 'vehsettings');

    const fromEco = createMockWs();
    events.SelectSettings(fromEco, {}, 'ecoenergy');
    const ctxtChg = fromEco.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.uiaId, 'ecoenergy');
    assert.equal(ctxtChg.ctxtId, 'Settings');
});
