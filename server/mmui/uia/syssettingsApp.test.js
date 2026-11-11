const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const syssettingsApp = require('./syssettingsApp');
const settings = require('../services/settings');
const { createMockWs, contexts, msgIds, messageOf } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');
const { useMockTimers } = require('../../testing/timers');

const app = syssettingsApp;
const { dialogs } = app;
const current = settings.currentSettings;

// The msgIds a "send...State" function sends, in order.
function sentBy(send) {
    const ws = createMockWs();
    send(ws);
    return ws.messages.map((m) => m.msgId);
}

describe('syssettingsApp', () => {
    const fixture = useCleanState();

    describe('language', () => {
        it('Change Language opens the list and reports the active language', () => {
            const ws = createMockWs();
            app.handleSelectChangeLanguage(ws, 'syssettings');
            assert.deepEqual(contexts(ws), ['ChangeLanguage']);
            assert.ok(messageOf(ws, 'LanguageSupported'));
        });

        it('choosing a language stages it and asks for confirmation', () => {
            const ws = createMockWs();
            app.handleSelectLanguageConf(ws, { payload: { languageID: 'LANGS_FR_FRENCH' } });
            assert.equal(dialogs.pendingLanguageId, 'LANGS_FR_FRENCH');
            assert.equal(dialogs.languageConfActive, true);
            assert.deepEqual(contexts(ws), ['LanguageConf']);
        });

        it('Yes applies the language after the progress delay and returns to the list', (t) => {
            const timers = useMockTimers(t);
            setBackStack(['syssettings', 'ChangeLanguage'], ['syssettings', 'LanguageConf']);
            dialogs.pendingLanguageId = 'LANGS_DE_GERMAN';
            const ws = createMockWs();

            app.handleSetLanguage(ws, { payload: { languageID: 'LANGS_DE_GERMAN' } });
            assert.ok(contexts(ws).includes('LanguageChangeProgress'));

            timers.tick(900);
            assert.equal(settings.currentLanguageId, 'LANGS_DE_GERMAN');
            assert.ok(msgIds(ws).includes('LanguageChanged'));
            assert.deepEqual(backStack(), ['ChangeLanguage']);
            assert.equal(dialogs.pendingLanguageId, null);
            assert.equal(fixture.saves, 1);
        });

        it('No closes the confirmation without changing the language', () => {
            const before = settings.currentLanguageId;
            setBackStack(['syssettings', 'ChangeLanguage'], ['syssettings', 'LanguageConf']);
            dialogs.languageConfActive = true;
            app.handleLanguageConfNo(createMockWs());
            assert.equal(dialogs.languageConfActive, false);
            assert.deepEqual(backStack(), ['ChangeLanguage']);
            assert.equal(settings.currentLanguageId, before);
        });
    });

    describe('units', () => {
        it('time format, temperature and distance units are saved', () => {
            app.handleSetTimeFormat({ payload: { formatTime: 'hrs24' } });
            assert.equal(current.timeFormat, 'hrs24');
            app.handleSetUnitsTemperature({ payload: { unitsTemperature: 'Celsius' } });
            assert.equal(current.temperatureUnit, 'Celsius');
            app.handleSetUnitsDistance({ payload: { unitsDistance: 'Kilometers' } });
            assert.equal(current.distanceUnit, 'Kilometers');
            assert.equal(fixture.saves, 3);
        });
    });

    describe('display', () => {
        it('the display state reports the cached display fields', () => {
            assert.deepEqual(sentBy(app.sendDisplayState), [
                'DayNightMode',
                'Brightness',
                'Contrast',
                'DisplayOverTemperature'
            ]);
        });

        it('day/night mode, brightness and contrast are saved', () => {
            app.handleSetDisplayDayNight({ payload: { displayDayNightAuto: 'Night' } });
            assert.equal(current.displayDayNightMode, 'Night');
            app.handleSetDisplayBrightness({ payload: { brightnessValue: 5 } });
            assert.equal(current.displayBrightness, 5);
            app.handleSetDisplayContrast({ payload: { ContrastValue: -2 } });
            assert.equal(current.displayContrast, -2);
        });

        it('Reset asks first, and Yes restores the defaults', () => {
            setBackStack(['syssettings', 'DisplayTab']);
            current.displayBrightness = 9;
            const ws = createMockWs();
            app.handleDisplayReset(ws);
            assert.equal(dialogs.displayResetConfirmActive, true);

            app.handleDisplayResetYes(ws);
            assert.equal(current.displayBrightness, 0);
            assert.deepEqual(backStack(), ['DisplayTab']);
        });

        it('Reset + No returns to the previous context without resetting', () => {
            current.displayBrightness = 9;
            setBackStack(['syssettings', 'DisplayTab'], ['syssettings', 'DisplaySettingsReset']);
            app.handleDisplayResetNo(createMockWs());
            assert.equal(dialogs.displayResetConfirmActive, false);
            assert.deepEqual(backStack(), ['DisplayTab']);
            assert.equal(current.displayBrightness, 9);
        });
    });

    describe('clock and devices', () => {
        it('the clock and devices states report their cached fields', () => {
            assert.deepEqual(sentBy(app.sendClockState), [
                'GPSSync',
                'TimeZone',
                'DayLightSavingsTime',
                'NaviStatus'
            ]);
            const devices = sentBy(app.sendDevicesState);
            assert.ok(devices.includes('AppleCarPlayAvailable'));
            assert.ok(devices.includes('AndroidAutoSettings'));
        });

        it('GPS sync, time zone, daylight saving time and the clock offset are saved', () => {
            app.handleSetGpsSync({ payload: { enableGpsSync: true } });
            assert.equal(current.gpsSync, true);
            app.handleSetTimeZone({ payload: { timeZone: 12 } });
            assert.equal(current.timeZoneIndex, 12);
            app.handleSetDaylightSavingTime({ payload: { enable: true } });
            assert.equal(current.daylightSavingTime, true);

            const nowSeconds = Math.round(Date.now() / 1000);
            app.handleSetTime({ payload: { u32TimestampSec: nowSeconds + 3600 } });
            assert.ok(Math.abs(current.clockOffsetSeconds - 3600) < 2);
        });
    });

    describe('system', () => {
        it('Agreements and Disclaimers opens the AgreementsDisclaimers context (no "And")', () => {
            const ws = createMockWs();
            app.handleSelectAgreementsAndDisclaimers(ws, 'syssettings');
            assert.deepEqual(contexts(ws), ['AgreementsDisclaimers']);
        });

        it('factory reset: No and Yes both return to the System tab, without wiping settings', (t) => {
            const timers = useMockTimers(t);
            setBackStack(['syssettings', 'SystemTab']);
            current.timeFormat = 'hrs24';
            const ws = createMockWs();

            app.handleSelectFactoryReset(ws, 'syssettings');
            assert.equal(dialogs.factoryResetConfirmActive, true);
            app.handleFactoryResetNo(ws);
            assert.equal(dialogs.factoryResetConfirmActive, false);
            assert.deepEqual(backStack(), ['SystemTab']);

            app.handleSelectFactoryReset(ws, 'syssettings');
            app.handleFactoryResetYes(ws);
            assert.equal(dialogs.factoryResetProgressActive, true);
            timers.tick(2000);
            assert.equal(dialogs.factoryResetProgressActive, false);
            assert.deepEqual(backStack(), ['SystemTab']);
            assert.equal(current.timeFormat, 'hrs24');
        });
    });
});
