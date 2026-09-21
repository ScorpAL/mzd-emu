const test = require('node:test');
const assert = require('node:assert/strict');

const dispatcher = require('../server/mmui/dispatcher');
const navigationState = require('../server/mmui/navigationState');
const dialogState = require('../server/mmui/dialogState');
const settings = require('../server/mmui/settings');
const { createMockWs } = require('./helpers/mockWs');

function withStubbedSave(fn) {
    const originalSave = settings.saveUserSettings;
    settings.saveUserSettings = () => {};
    try {
        fn();
    } finally {
        settings.saveUserSettings = originalSave;
    }
}

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
    Object.keys(dialogState).forEach((key) => {
        if (typeof dialogState[key] === 'boolean') {
            dialogState[key] = false;
        }
    });
    dialogState.schedMaintResetContext = null;
    dialogState.pendingLanguageId = null;
});

test('dispatcher always returns true, even for unhandled events', () => {
    const ws = createMockWs();
    assert.equal(dispatcher(ws, 'common', 'TotallyUnknownEvent', {}), true);
});

test('Global.GetStartupSettings routes to the full startup sequence', () => {
    const ws = createMockWs();
    dispatcher(ws, 'system', 'Global.GetStartupSettings', {});

    assert.ok(ws.messages.some((m) => m.msgId === 'Region'));
    const ctxtChg = ws.messages.filter((m) => m.msgType === 'ctxtChg').pop();
    assert.equal(ctxtChg.ctxtId, 'Applications');
});

test('the default case turns an unknown "SelectXyz" event into a plain context change', () => {
    const ws = createMockWs();
    dispatcher(ws, 'system', 'SelectFoobar', {});

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'Foobar');
});

test('the default case ignores unknown non-Select events entirely', () => {
    const ws = createMockWs();
    dispatcher(ws, 'system', 'SomethingElseEntirely', {});
    assert.equal(ws.messages.length, 0);
});

test('SelectReset routes to ecoenergy reset-confirm-yes when uiaId is ecoenergy', () => {
    navigationState.goBackStack.push({
        uiaId: 'ecoenergy',
        ctxtId: 'FuelConsumption',
        contextSeq: 1
    });
    navigationState.goBackStack.push({ uiaId: 'ecoenergy', ctxtId: 'ResetConfirm', contextSeq: 2 });

    const ws = createMockWs();
    dispatcher(ws, 'ecoenergy', 'SelectReset', {});

    assert.ok(ws.messages.some((m) => m.msgId === 'ResetSuccess'));
});

test('SelectSettings routes to ecoenergy settings when uiaId is ecoenergy, otherwise to system settings', () => {
    let ws = createMockWs();
    dispatcher(ws, 'ecoenergy', 'SelectSettings', {});
    assert.equal(ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId, 'Settings');

    ws = createMockWs();
    dispatcher(ws, 'system', 'SelectSettings', {});
    assert.ok(
        ['DisplayTab', 'HUDTab', 'HUDTabJ78'].includes(
            ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId
        )
    );
});

test('Global.Yes forwards to the disclaimer dismiss handler only while it is active', () => {
    dialogState.disclaimerActive = true;
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Disclaimer', contextSeq: 1 });

    const ws = createMockWs();
    dispatcher(ws, 'common', 'Global.Yes', {});

    assert.equal(dialogState.disclaimerActive, false);
    assert.equal(ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId, 'HomeScreen');
});

test('Global.Yes forwards to the HUD reset handler when that dialog is active', () => {
    withStubbedSave(() => {
        dialogState.hudResetConfirmActive = true;
        navigationState.goBackStack.push({ uiaId: 'vehsettings', ctxtId: 'HUDTab', contextSeq: 1 });
        settings.currentSettings.hudHeight = 4;

        const ws = createMockWs();
        dispatcher(ws, 'common', 'Global.Yes', {});

        assert.equal(settings.currentSettings.hudHeight, 0);
        assert.equal(dialogState.hudResetConfirmActive, false);
        settings.currentSettings.hudHeight = 0;
    });
});

test('Global.Yes is a no-op when no dialog flag is active and uiaId is not ecoenergy', () => {
    const ws = createMockWs();
    dispatcher(ws, 'common', 'Global.Yes', {});
    assert.equal(ws.messages.length, 0);
});

test('Global.No forwards to the language conf "No" handler when that dialog is active', () => {
    navigationState.goBackStack.push({
        uiaId: 'syssettings',
        ctxtId: 'ChangeLanguage',
        contextSeq: 1
    });
    navigationState.goBackStack.push({
        uiaId: 'syssettings',
        ctxtId: 'LanguageConf',
        contextSeq: 2
    });
    dialogState.languageConfActive = true;

    const ws = createMockWs();
    dispatcher(ws, 'common', 'Global.No', {});

    assert.equal(dialogState.languageConfActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
});

test('Global.Cancel is intercepted by an active Bluetooth Discoverable context first', () => {
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'BTConnectionManager',
        contextSeq: 1
    });
    navigationState.goBackStack.push({ uiaId: 'btpairing', ctxtId: 'Discoverable', contextSeq: 2 });

    const ws = createMockWs();
    dispatcher(ws, 'btpairing', 'Global.Cancel', {});

    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(navigationState.goBackStack[0].ctxtId, 'BTConnectionManager');
});

test('Global.Cancel falls back to closing an active music DB update dialog', () => {
    navigationState.goBackStack.push({ uiaId: 'sysupdate', ctxtId: 'SystemTab', contextSeq: 1 });
    navigationState.goBackStack.push({
        uiaId: 'sysupdate',
        ctxtId: 'SearchMusicDBUpdates',
        contextSeq: 2
    });
    dialogState.musicDBUpdateActive = true;

    const ws = createMockWs();
    dispatcher(ws, 'common', 'Global.Cancel', {});

    assert.equal(dialogState.musicDBUpdateActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
});

test('Global.GoBack pops the stack and re-displays the previous context', () => {
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Applications', contextSeq: 1 });
    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Entertainment', contextSeq: 2 });

    const ws = createMockWs();
    dispatcher(ws, 'system', 'Global.GoBack', {});

    assert.equal(navigationState.goBackStack.length, 1);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'Applications');
});

test('Global.GoBack clears the SoftwareInfo dialog flag when it dismisses that context', () => {
    navigationState.goBackStack.push({ uiaId: 'sysupdate', ctxtId: 'SystemTab', contextSeq: 1 });
    navigationState.goBackStack.push({ uiaId: 'sysupdate', ctxtId: 'SoftwareInfo', contextSeq: 2 });
    dialogState.softwareInfoDialogActive = true;

    const ws = createMockWs();
    dispatcher(ws, 'sysupdate', 'Global.GoBack', {});

    assert.equal(dialogState.softwareInfoDialogActive, false);
});

test('grouped Set* safety events are all routed through handleSafetySettingsEvent', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        dispatcher(ws, 'vehsettings', 'SetDRSS', { payload: { evData: 'DRSS_On' } });
        assert.equal(settings.currentSettings.drssMode, 'DRSS_On');
    });
});

test('grouped Set* lighting events are all routed through handleLightingSettingsEvent', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        dispatcher(ws, 'vehsettings', 'SetHBC', { payload: { evData: 'HBC_On' } });
        assert.equal(settings.currentSettings.lightingHighBeamControl, 'HBC_On');
    });
});

test('SetTimeFormat/SetUnitsTemperature/SetUnitsDistance persist via syssettingsApp', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        dispatcher(ws, 'syssettings', 'SetTimeFormat', { payload: { formatTime: 'hrs24' } });
        assert.equal(settings.currentSettings.timeFormat, 'hrs24');
    });
});

test('SelectBluetooth opens the Bluetooth connection manager', () => {
    const ws = createMockWs();
    dispatcher(ws, 'btpairing', 'SelectBluetooth', {});

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'BTConnectionManager');
});

test('SelectTimeZone opens the firmware-named SelectTimeZone context as-is', () => {
    const ws = createMockWs();
    dispatcher(ws, 'syssettings', 'SelectTimeZone', {});

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'SelectTimeZone');
});

test('SelectDisplayOff/SelectDisplayClock are native no-ops', () => {
    const ws = createMockWs();
    dispatcher(ws, 'syssettings', 'SelectDisplayOff', {});
    dispatcher(ws, 'syssettings', 'SelectDisplayClock', {});
    assert.equal(ws.messages.length, 0);
});
