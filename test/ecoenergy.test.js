const test = require('node:test');
const assert = require('node:assert/strict');

const ecoenergyApp = require('../server/mmui/ecoenergyApp');
const navigationState = require('../server/mmui/navigationState');
const { createMockWs } = require('./helpers/mockWs');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
});

test('handleSelectEcoEnergy sends the full state and opens ControlStatus', () => {
    const ws = createMockWs();

    ecoenergyApp.handleSelectEcoEnergy(ws);

    assert.ok(ws.messages.some((m) => m.msgId === 'FuelType'));
    assert.ok(ws.messages.some((m) => m.msgId === 'TreeData'));
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'ControlStatus');
});

test('handleSelectSwitchView cycles ControlStatus -> Effectiveness -> FuelConsumption -> ControlStatus', () => {
    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'ControlStatus',
        contextSeq: 1
    });
    let ws = createMockWs();
    ecoenergyApp.handleSelectSwitchView(ws);
    let ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'Effectiveness');

    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'Effectiveness',
        contextSeq: 2
    });
    ws = createMockWs();
    ecoenergyApp.handleSelectSwitchView(ws);
    ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'FuelConsumption');

    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'FuelConsumption',
        contextSeq: 3
    });
    ws = createMockWs();
    ecoenergyApp.handleSelectSwitchView(ws);
    ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'ControlStatus');
});

test('isResetConfirmActive reflects the top of the navigation stack', () => {
    assert.equal(ecoenergyApp.isResetConfirmActive(), false);

    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'ControlStatus',
        contextSeq: 1
    });
    assert.equal(ecoenergyApp.isResetConfirmActive(), false);

    navigationState.goBackStack.push({ uiaId: 'ecoenergy', ctxtId: 'ResetConfirm', contextSeq: 2 });
    assert.equal(ecoenergyApp.isResetConfirmActive(), true);
});

test('handleResetCancel returns to the page that was active before the reset confirm dialog', () => {
    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'Effectiveness',
        contextSeq: 1
    });
    navigationState.goBackStack.push({ uiaId: 'ecoenergy', ctxtId: 'ResetConfirm', contextSeq: 2 });

    const ws = createMockWs();
    ecoenergyApp.handleResetCancel(ws);

    assert.equal(navigationState.goBackStack.length, 1);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'Effectiveness');
});

test('handleResetConfirmYes sends a reset success message and returns to the previous page', () => {
    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'FuelConsumption',
        contextSeq: 1
    });
    navigationState.goBackStack.push({ uiaId: 'ecoenergy', ctxtId: 'ResetConfirm', contextSeq: 2 });

    const ws = createMockWs();
    ecoenergyApp.handleResetConfirmYes(ws);

    assert.ok(ws.messages.some((m) => m.msgId === 'ResetSuccess'));
    const ctxtChg = ws.messages.filter((m) => m.msgType === 'ctxtChg').pop();
    assert.equal(ctxtChg.ctxtId, 'FuelConsumption');
});

test('handleSelectSourceMenu switches to the system Applications screen', () => {
    const ws = createMockWs();
    ecoenergyApp.handleSelectSourceMenu(ws);

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.uiaId, 'system');
    assert.equal(ctxtChg.ctxtId, 'Applications');
});
