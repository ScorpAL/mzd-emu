const test = require('node:test');
const assert = require('node:assert/strict');

const systemApp = require('../server/mmui/systemApp');
const navigationState = require('../server/mmui/navigationState');
const dialogState = require('../server/mmui/dialogState');
const vehicleEquipment = require('../server/mmui/vehicleEquipment');
const { createMockWs } = require('./helpers/mockWs');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
    dialogState.disclaimerActive = false;
});

test('handleInitGui clears navigation and opens the Disclaimer without touching the back stack', () => {
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Applications', contextSeq: 1 });
    const ws = createMockWs();

    systemApp.handleInitGui(ws);

    assert.equal(dialogState.disclaimerActive, true);
    assert.equal(navigationState.goBackStack.length, 0);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'Disclaimer');
});

test('handleIntentHome resets the back stack and dismisses the disclaimer', () => {
    dialogState.disclaimerActive = true;
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Applications', contextSeq: 1 });
    const ws = createMockWs();

    systemApp.handleIntentHome(ws);

    assert.equal(dialogState.disclaimerActive, false);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'HomeScreen');
});

test('dismissDisclaimer behaves like handleIntentHome', () => {
    dialogState.disclaimerActive = true;
    const ws = createMockWs();

    systemApp.dismissDisclaimer(ws);

    assert.equal(dialogState.disclaimerActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'HomeScreen');
});

test('sendApplicationsState reports every application tile status', () => {
    const ws = createMockWs();

    systemApp.sendApplicationsState(ws);

    const appNames = ws.messages
        .filter((m) => m.msgId === 'StatusMenu')
        .map((m) => m.params.payload.statusMenu.appName);
    assert.ok(appNames.includes('ecoenergy'));
    assert.ok(appNames.includes('schedmaint'));
    assert.ok(appNames.includes('carplay'));
});

test('handleSelectApplications refreshes state and opens Applications', () => {
    const ws = createMockWs();
    systemApp.handleSelectApplications(ws);

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'Applications');
});

test('handleSelectNavigation is a no-op (navigation is a separate, unemulated app)', () => {
    assert.doesNotThrow(() => systemApp.handleSelectNavigation());
});

test('handleSelectSettings opens the HUD tab when HUD is installed', () => {
    const original = vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed;
    vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = 1;
    const ws = createMockWs();

    systemApp.handleSelectSettings(ws);

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.uiaId, 'vehsettings');
    assert.ok(ctxtChg.ctxtId === 'HUDTab' || ctxtChg.ctxtId === 'HUDTabJ78');
    vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = original;
});

test('handleSelectSettings opens the Display tab when HUD is not installed', () => {
    const original = vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed;
    vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = 0;
    const ws = createMockWs();

    systemApp.handleSelectSettings(ws);

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.uiaId, 'syssettings');
    assert.equal(ctxtChg.ctxtId, 'DisplayTab');
    vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = original;
});

test('handleIntentSettingsTab replaces the current stack entry with the requested tab', () => {
    navigationState.goBackStack.push({ uiaId: 'syssettings', ctxtId: 'DisplayTab', contextSeq: 1 });
    const ws = createMockWs();

    systemApp.handleIntentSettingsTab(ws, { payload: { settingsTab: 'Sound' } });

    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(navigationState.goBackStack[0].uiaId, 'audiosettings');
    assert.equal(navigationState.goBackStack[0].ctxtId, 'SoundTab');
});

test('handleIntentSettingsTab routes the Devices tab through syssettings devices state', () => {
    const ws = createMockWs();
    systemApp.handleIntentSettingsTab(ws, { payload: { settingsTab: 'Devices' } });

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.uiaId, 'syssettings');
    assert.equal(ctxtChg.ctxtId, 'DevicesTab');
});

test('handleGetStartupSettings sends startup state from every subsystem and lands on Applications', () => {
    const ws = createMockWs();

    systemApp.handleGetStartupSettings(ws);

    assert.ok(ws.messages.some((m) => m.msgId === 'Region'));
    assert.ok(ws.messages.some((m) => m.msgId === 'BoseAvailable'));
    assert.ok(ws.messages.some((m) => m.msgId === 'BTStatusAndList'));
    const ctxtChg = ws.messages.filter((m) => m.msgType === 'ctxtChg').pop();
    assert.equal(ctxtChg.uiaId, 'system');
    assert.equal(ctxtChg.ctxtId, 'Applications');
    // Startup context change must not itself become a back-stack entry.
    assert.equal(navigationState.goBackStack.length, 0);
});
