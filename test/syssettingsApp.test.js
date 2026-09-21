const test = require('node:test');
const assert = require('node:assert/strict');

const syssettingsApp = require('../server/mmui/syssettingsApp');
const settings = require('../server/mmui/settings');
const navigationState = require('../server/mmui/navigationState');
const dialogState = require('../server/mmui/dialogState');
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
    dialogState.languageConfActive = false;
    dialogState.pendingLanguageId = null;
    dialogState.displayResetConfirmActive = false;
    dialogState.factoryResetConfirmActive = false;
});

test('handleSelectLanguageConf stages the pending language and opens the confirm dialog', () => {
    const ws = createMockWs();
    syssettingsApp.handleSelectLanguageConf(ws, { payload: { languageID: 'LANGS_FR_FRENCH' } });

    assert.equal(dialogState.pendingLanguageId, 'LANGS_FR_FRENCH');
    assert.equal(dialogState.languageConfActive, true);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'LanguageConf');
});

test('handleSetLanguage applies the language after the progress delay and returns to the list', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    withStubbedSave(() => {
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
        dialogState.pendingLanguageId = 'LANGS_DE_GERMAN';
        const ws = createMockWs();

        syssettingsApp.handleSetLanguage(ws, { payload: { languageID: 'LANGS_DE_GERMAN' } });
        assert.ok(ws.messages.some((m) => m.ctxtId === 'LanguageChangeProgress'));

        t.mock.timers.tick(900);

        assert.equal(settings.currentLanguageId, 'LANGS_DE_GERMAN');
        assert.ok(ws.messages.some((m) => m.msgId === 'LanguageChanged'));
        assert.equal(navigationState.goBackStack.length, 1);
        assert.equal(navigationState.goBackStack[0].ctxtId, 'ChangeLanguage');
        assert.equal(dialogState.pendingLanguageId, null);
    });
});

test('handleLanguageConfNo dismisses without changing the language', () => {
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
    syssettingsApp.handleLanguageConfNo(ws);

    assert.equal(dialogState.languageConfActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
});

test('handleSetTimeFormat/handleSetUnitsTemperature/handleSetUnitsDistance persist their fields', () => {
    withStubbedSave(() => {
        syssettingsApp.handleSetTimeFormat({ payload: { formatTime: 'hrs24' } });
        assert.equal(settings.currentSettings.timeFormat, 'hrs24');

        syssettingsApp.handleSetUnitsTemperature({ payload: { unitsTemperature: 'Celsius' } });
        assert.equal(settings.currentSettings.temperatureUnit, 'Celsius');

        syssettingsApp.handleSetUnitsDistance({ payload: { unitsDistance: 'Kilometers' } });
        assert.equal(settings.currentSettings.distanceUnit, 'Kilometers');
    });
});

test('sendDisplayState reports the cached display fields', () => {
    const ws = createMockWs();
    syssettingsApp.sendDisplayState(ws);

    const msgIds = ws.messages.map((m) => m.msgId);
    assert.deepEqual(msgIds, ['DayNightMode', 'Brightness', 'Contrast', 'DisplayOverTemperature']);
});

test('display setting handlers persist brightness/contrast/day-night values', () => {
    withStubbedSave(() => {
        syssettingsApp.handleSetDisplayDayNight({ payload: { displayDayNightAuto: 'Night' } });
        assert.equal(settings.currentSettings.displayDayNightMode, 'Night');

        syssettingsApp.handleSetDisplayBrightness({ payload: { brightnessValue: 5 } });
        assert.equal(settings.currentSettings.displayBrightness, 5);

        syssettingsApp.handleSetDisplayContrast({ payload: { ContrastValue: -2 } });
        assert.equal(settings.currentSettings.displayContrast, -2);
    });
});

test('handleDisplayReset opens the confirm dialog and Yes resets to defaults', () => {
    withStubbedSave(() => {
        navigationState.goBackStack.push({
            uiaId: 'syssettings',
            ctxtId: 'DisplayTab',
            contextSeq: 1
        });
        settings.currentSettings.displayBrightness = 9;

        const ws = createMockWs();
        syssettingsApp.handleDisplayReset(ws);
        assert.equal(dialogState.displayResetConfirmActive, true);

        syssettingsApp.handleDisplayResetYes(ws);
        assert.equal(settings.currentSettings.displayBrightness, 0);
        assert.equal(navigationState.goBackStack.length, 1);
        assert.equal(navigationState.goBackStack[0].ctxtId, 'DisplayTab');

        settings.currentSettings.displayBrightness = 0;
    });
});

test('handleDisplayResetNo returns to the previous context without resetting values', () => {
    navigationState.goBackStack.push({ uiaId: 'syssettings', ctxtId: 'DisplayTab', contextSeq: 1 });
    navigationState.goBackStack.push({
        uiaId: 'syssettings',
        ctxtId: 'DisplaySettingsReset',
        contextSeq: 2
    });

    const ws = createMockWs();
    syssettingsApp.handleDisplayResetNo(ws);

    assert.equal(dialogState.displayResetConfirmActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
});

test('sendClockState/sendDevicesState report the cached clock and device fields', () => {
    let ws = createMockWs();
    syssettingsApp.sendClockState(ws);
    assert.deepEqual(
        ws.messages.map((m) => m.msgId),
        ['GPSSync', 'TimeZone', 'DayLightSavingsTime', 'NaviStatus']
    );

    ws = createMockWs();
    syssettingsApp.sendDevicesState(ws);
    assert.ok(ws.messages.some((m) => m.msgId === 'AppleCarPlayAvailable'));
    assert.ok(ws.messages.some((m) => m.msgId === 'AndroidAutoSettings'));
});

test('clock setting handlers persist gps sync, time zone, DST and clock offset', () => {
    withStubbedSave(() => {
        syssettingsApp.handleSetGpsSync({ payload: { enableGpsSync: true } });
        assert.equal(settings.currentSettings.gpsSync, true);

        syssettingsApp.handleSetTimeZone({ payload: { timeZone: 12 } });
        assert.equal(settings.currentSettings.timeZoneIndex, 12);

        syssettingsApp.handleSetDaylightSavingTime({ payload: { enable: true } });
        assert.equal(settings.currentSettings.daylightSavingTime, true);

        const nowSeconds = Math.round(Date.now() / 1000);
        syssettingsApp.handleSetTime({ payload: { u32TimestampSec: nowSeconds + 3600 } });
        assert.ok(Math.abs(settings.currentSettings.clockOffsetSeconds - 3600) < 2);
    });
});

test('handleSelectChangeLanguage opens the language list and reports the active language', () => {
    const ws = createMockWs();
    syssettingsApp.handleSelectChangeLanguage(ws, 'syssettings');

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'ChangeLanguage');
    assert.ok(ws.messages.some((m) => m.msgId === 'LanguageSupported'));
});

test('handleSelectAgreementsAndDisclaimers opens the AgreementsDisclaimers context (no "And")', () => {
    const ws = createMockWs();
    syssettingsApp.handleSelectAgreementsAndDisclaimers(ws, 'syssettings');

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'AgreementsDisclaimers');
});

test('factory reset confirm/no/yes flow returns to the System tab without wiping settings', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    navigationState.goBackStack.push({ uiaId: 'syssettings', ctxtId: 'SystemTab', contextSeq: 1 });
    const ws = createMockWs();

    syssettingsApp.handleSelectFactoryReset(ws, 'syssettings');
    assert.equal(dialogState.factoryResetConfirmActive, true);

    syssettingsApp.handleFactoryResetNo(ws);
    assert.equal(dialogState.factoryResetConfirmActive, false);
    assert.equal(navigationState.goBackStack.length, 1);

    syssettingsApp.handleSelectFactoryReset(ws, 'syssettings');
    syssettingsApp.handleFactoryResetYes(ws);
    assert.equal(dialogState.factoryResetProgressActive, true);
    t.mock.timers.tick(2000);
    assert.equal(dialogState.factoryResetProgressActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(navigationState.goBackStack[0].ctxtId, 'SystemTab');
});
