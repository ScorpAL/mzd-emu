const test = require('node:test');
const assert = require('node:assert/strict');

const systemApp = require('./systemApp');
const coldStart = require('../services/coldStart');
const navigationState = require('../state/navigationState');
const vehicleEquipment = require('../services/vehicleEquipment');
const { createMockWs } = require('../../testing/mockWs');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
    systemApp.dialogs.disclaimerActive = false;
});

test('handleInitGui clears navigation and sends no context of its own', () => {
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Applications', contextSeq: 1 });
    const ws = createMockWs();

    systemApp.handleInitGui(ws);

    assert.equal(navigationState.goBackStack.length, 0);
    assert.equal(ws.messages.length, 0);
});

test('cold start plays IntroAnimation and shows the Disclaimer only when the boot video ends', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const ws = createMockWs();

    systemApp.handleGetStartupSettings(ws);

    const contexts = () => ws.messages.filter((m) => m.msgType === 'ctxtChg');
    assert.equal(contexts().pop().ctxtId, 'IntroAnimation');
    assert.equal(systemApp.dialogs.disclaimerActive, false);

    t.mock.timers.tick(4999);
    assert.equal(contexts().pop().ctxtId, 'IntroAnimation');

    t.mock.timers.tick(1);
    assert.equal(contexts().pop().ctxtId, 'Disclaimer');
    assert.equal(systemApp.dialogs.disclaimerActive, true);
    assert.equal(navigationState.goBackStack.length, 0);
});

test('leaving for Home during the boot video cancels the pending Disclaimer', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const ws = createMockWs();
    systemApp.handleGetStartupSettings(ws);

    systemApp.handleIntentHome(ws);
    t.mock.timers.tick(10000);

    const ids = ws.messages.filter((m) => m.msgType === 'ctxtChg').map((m) => m.ctxtId);
    assert.deepEqual(ids, ['IntroAnimation', 'HomeScreen']);
});

test('handleIntentHome resets the back stack and dismisses the disclaimer', () => {
    systemApp.dialogs.disclaimerActive = true;
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Applications', contextSeq: 1 });
    const ws = createMockWs();

    systemApp.handleIntentHome(ws);

    assert.equal(systemApp.dialogs.disclaimerActive, false);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'HomeScreen');
});

test('dismissDisclaimer behaves like handleIntentHome', () => {
    systemApp.dialogs.disclaimerActive = true;
    const ws = createMockWs();

    systemApp.dismissDisclaimer(ws);

    assert.equal(systemApp.dialogs.disclaimerActive, false);
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

test('handleGetStartupSettings sends startup state from every subsystem and lands on IntroAnimation', () => {
    const ws = createMockWs();

    systemApp.handleGetStartupSettings(ws);

    assert.ok(ws.messages.some((m) => m.msgId === 'Region'));
    assert.ok(ws.messages.some((m) => m.msgId === 'BoseAvailable'));
    assert.ok(ws.messages.some((m) => m.msgId === 'BTStatusAndList'));
    const ctxtChg = ws.messages.filter((m) => m.msgType === 'ctxtChg').pop();
    assert.equal(ctxtChg.uiaId, 'system');
    assert.equal(ctxtChg.ctxtId, 'IntroAnimation');
    // Startup context change must not itself become a back-stack entry.
    assert.equal(navigationState.goBackStack.length, 0);
});

test('scheduleStartupSettings holds the startup reply back for the simulated boot time', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const saved = coldStart.config.bootDelayMs;
    coldStart.config.bootDelayMs = 8000;
    try {
        const ws = createMockWs();

        systemApp.scheduleStartupSettings(ws);
        t.mock.timers.tick(7999);
        assert.equal(ws.messages.length, 0);

        t.mock.timers.tick(1);
        assert.ok(ws.messages.some((m) => m.msgId === 'Region'));
        assert.equal(
            ws.messages.filter((m) => m.msgType === 'ctxtChg').pop().ctxtId,
            'IntroAnimation'
        );
    } finally {
        coldStart.config.bootDelayMs = saved;
    }
});
