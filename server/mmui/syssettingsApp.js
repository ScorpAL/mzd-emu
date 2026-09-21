const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('./navigationState');
const dialogState = require('./dialogState');
const settings = require('./settings');
const logger = require('../logger');

// Stage the selected language until the confirmation dialog is accepted.
function handleSelectLanguageConf(ws, params) {
    if (params && params.payload && params.payload.languageID) {
        dialogState.pendingLanguageId = params.payload.languageID;
        dialogState.languageConfActive = true;
        sendContextChange(ws, 'syssettings', 'LanguageConf', {
            payload: { languageID: dialogState.pendingLanguageId }
        });
    }
}

// The progress context is transient; real hardware uses it to load dictionaries.
function handleSetLanguage(ws, params) {
    if (params && params.payload && params.payload.languageID) {
        dialogState.languageConfActive = false;
        dialogState.pendingLanguageId = params.payload.languageID;
        sendContextChange(ws, 'syssettings', 'LanguageChangeProgress', undefined, undefined, true);

        (function (ws, newLanguageId) {
            setTimeout(function () {
                settings.currentLanguageId = newLanguageId;
                settings.saveUserSettings();

                const languageChangedMsg = JSON.stringify({
                    msgType: 'msg',
                    uiaId: 'syssettings',
                    msgId: 'LanguageChanged',
                    params: { payload: { newLanguage: newLanguageId } }
                });
                ws.send(languageChangedMsg);
                logger.debug('syssettings', 'Sent language change');

                // Re-display the list without pushing another stack entry.
                if (navigationState.goBackStack.length > 1) {
                    navigationState.goBackStack.pop();
                    const context =
                        navigationState.goBackStack[navigationState.goBackStack.length - 1];
                    const languageSupportedMsg = JSON.stringify({
                        msgType: 'msg',
                        uiaId: 'syssettings',
                        msgId: 'LanguageSupported',
                        params: {
                            payload: {
                                languageName: {
                                    languageID: settings.currentLanguageId,
                                    vrSupport: false,
                                    ttsSupport: true
                                }
                            }
                        }
                    });
                    ws.send(languageSupportedMsg);
                    logger.debug('syssettings', 'Sent language supported state');
                    sendContextChange(
                        ws,
                        context.uiaId,
                        context.ctxtId,
                        context.params,
                        context.contextSeq,
                        true
                    );
                }
                dialogState.pendingLanguageId = null;
            }, 900);
        })(ws, dialogState.pendingLanguageId);
    }
}

// Global.No dismisses the dialog without changing the active language.
function handleLanguageConfNo(ws) {
    dialogState.languageConfActive = false;
    dialogState.pendingLanguageId = null;
    if (navigationState.goBackStack.length > 1) {
        navigationState.goBackStack.pop();
        const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
        sendContextChange(
            ws,
            context.uiaId,
            context.ctxtId,
            context.params,
            context.contextSeq,
            true
        );
    }
}

// Settings -> System -> Time Format ("12h"/"24h" toggle). syssettingsApp.js already
// switches the clock's own display locally (framework.localize.setTimeFormat(...))
// before sending this - it's just telling MMUI to persist the choice (see its
// "_cachedTimeFormat" field). No response is expected back. params.payload.formatTime
// is "hrs12" or "hrs24".
function handleSetTimeFormat(params) {
    if (params && params.payload && params.payload.formatTime) {
        settings.currentSettings.timeFormat = params.payload.formatTime;
        settings.saveUserSettings(); // persist so the chosen clock format survives a server restart
    }
}

// Settings -> System -> Temperature ("Fahrenheit"/"Celsius" toggle). Same pattern as
// handleSetTimeFormat() above: syssettingsApp.js's "SetUnitsTemperature" case already
// updates its own local display (this._cachedTemperature, via
// framework.localize.setTemperatureUnit()) before calling framework.sendEventToMmui() -
// this handler only needs to persist the choice so it survives a server restart. No
// response is expected back. params.payload.unitsTemperature is "Fahrenheit" or
// "Celsius" (see that GUI file's "SetUnitsTemperature" case for the exact payload shape).
function handleSetUnitsTemperature(params) {
    if (params && params.payload && params.payload.unitsTemperature) {
        settings.currentSettings.temperatureUnit = params.payload.unitsTemperature;
        settings.saveUserSettings(); // persist so the chosen temperature unit survives a server restart
    }
}

// Settings -> System -> Distance ("Miles"/"Kilometers" toggle). Mirrors
// handleSetUnitsTemperature() above - see that comment for the shared reasoning.
// params.payload.unitsDistance is "Miles" or "Kilometers".
function sendDisplayState(ws) {
    const values = settings.currentSettings;
    [
        ['DayNightMode', { dayNightSetting: values.displayDayNightMode }],
        ['Brightness', { brightnessSetting: values.displayBrightness }],
        ['Contrast', { ContrastSetting: values.displayContrast }],
        ['DisplayOverTemperature', { displayOverTemperature: false }]
    ].forEach(function (entry) {
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'syssettings',
                msgId: entry[0],
                params: { payload: entry[1] }
            })
        );
    });
}

function handleSetDisplayDayNight(params) {
    if (params && params.payload && params.payload.displayDayNightAuto) {
        settings.currentSettings.displayDayNightMode = params.payload.displayDayNightAuto;
        settings.saveUserSettings();
    }
}

function handleSetDisplayBrightness(params) {
    if (params && params.payload && params.payload.brightnessValue != null) {
        settings.currentSettings.displayBrightness = params.payload.brightnessValue;
        settings.saveUserSettings();
    }
}

function handleSetDisplayContrast(params) {
    if (params && params.payload && params.payload.ContrastValue != null) {
        settings.currentSettings.displayContrast = params.payload.ContrastValue;
        settings.saveUserSettings();
    }
}

function handleDisplayReset(ws) {
    dialogState.displayResetConfirmActive = true;
    sendContextChange(ws, 'syssettings', 'DisplaySettingsReset');
}

function handleDisplayResetNo(ws) {
    dialogState.displayResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleDisplayResetYes(ws) {
    dialogState.displayResetConfirmActive = false;
    dialogState.displayResetProgressActive = true;
    settings.currentSettings.displayDayNightMode = 'Auto';
    settings.currentSettings.displayBrightness = 0;
    settings.currentSettings.displayContrast = 0;
    settings.saveUserSettings();
    sendDisplayState(ws);
    sendContextChange(
        ws,
        'syssettings',
        'DisplaySettingsResetProgress',
        undefined,
        undefined,
        true
    );
    dialogState.displayResetProgressActive = false;
    returnToPreviousContext(ws);
}

function returnToPreviousContext(ws) {
    if (navigationState.goBackStack.length > 1) {
        navigationState.goBackStack.pop();
        const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
        sendContextChange(
            ws,
            context.uiaId,
            context.ctxtId,
            context.params,
            context.contextSeq,
            true
        );
    }
}

function handleSetUnitsDistance(params) {
    if (params && params.payload && params.payload.unitsDistance) {
        settings.currentSettings.distanceUnit = params.payload.unitsDistance;
        settings.saveUserSettings();
    }
}

// Send cached clock settings and navigation availability at startup.
function sendClockState(ws) {
    const values = settings.currentSettings;
    const naviStatus =
        settings.HARDWARE_CONFIG.navigationSdCard === 'On' ? 'Available' : 'Unavailable';
    [
        ['GPSSync', { enableGpsSync: values.gpsSync }],
        ['TimeZone', { timeZone: values.timeZoneIndex }],
        ['DayLightSavingsTime', { dst: values.daylightSavingTime }],
        ['NaviStatus', { NaviStatus: naviStatus }]
    ].forEach(function (entry) {
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'syssettings',
                msgId: entry[0],
                params: { payload: entry[1] }
            })
        );
    });
}

// Send device capability state before the Devices tab opens.
function sendDevicesState(ws) {
    [
        ['AppleCarPlayAvailable', { enable: settings.HARDWARE_CONFIG.appleCarPlayAvailable }],
        [
            'AppleWirelessCarPlayAvailable',
            { enable: settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable }
        ],
        ['AppleCarPlayConnection', { enable: settings.HARDWARE_CONFIG.appleCarPlayConnection }],
        ['AppleCarPlaySettings', { enable: settings.HARDWARE_CONFIG.appleCarPlaySettings }],
        ['AndroidAutoAvailable', { enable: settings.HARDWARE_CONFIG.androidAutoAvailable }],
        ['AndroidAutoConnection', { enable: settings.HARDWARE_CONFIG.androidAutoConnection }],
        ['AndroidAutoSettings', { enable: settings.HARDWARE_CONFIG.androidAutoSettings }]
    ].forEach(function (entry) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'syssettings',
            msgId: entry[0],
            params: { payload: entry[1] }
        });
        ws.send(msg);
        logger.debug('syssettings', 'Sent device state');
    });
}

function handleSetGpsSync(params) {
    if (params && params.payload && params.payload.enableGpsSync) {
        settings.currentSettings.gpsSync = params.payload.enableGpsSync;
        settings.saveUserSettings();
    }
}

function handleSetTimeZone(params) {
    if (params && params.payload && params.payload.timeZone != null) {
        settings.currentSettings.timeZoneIndex = params.payload.timeZone;
        settings.saveUserSettings();
    }
}

function handleSetDaylightSavingTime(params) {
    if (params && params.payload && params.payload.enable) {
        settings.currentSettings.daylightSavingTime = params.payload.enable;
        settings.saveUserSettings();
    }
}

function handleSetTime(params) {
    if (params && params.payload && params.payload.u32TimestampSec != null) {
        settings.currentSettings.clockOffsetSeconds =
            params.payload.u32TimestampSec - Math.round(Date.now() / 1000);
        settings.saveUserSettings();
    }
}

// Open the language list and report the active language.
function handleSelectChangeLanguage(ws, uiaId) {
    sendContextChange(ws, uiaId, 'ChangeLanguage');
    const languageSupportedMsg = JSON.stringify({
        msgType: 'msg',
        uiaId: uiaId,
        msgId: 'LanguageSupported',
        params: {
            payload: {
                languageName: {
                    languageID: settings.currentLanguageId,
                    vrSupport: false,
                    ttsSupport: true
                }
            }
        }
    });
    ws.send(languageSupportedMsg);
    logger.debug('syssettings', 'Sent language supported state');
}

// Settings -> System -> About -> "Agreements and Disclaimers". This used to fall
// through to the generic "Select..." handler (see dispatcher.js's default case), which
// derives the ctxtId by stripping the "Select" prefix off the eventId - giving
// "AgreementsAndDisclaimers". But syssettingsApp.js's _contextTable actually names this
// context "AgreementsDisclaimers" (no "And"!) - see that file's "AgreementsDisclaimers"
// : { ... "scrollDetailBodyPath" : ".../legalDisclosure.js" ... entry. Sending ctxtChg
// to the wrong/nonexistent name left the GUI stuck on the About screen forever. The
// screen's content (3rd-party license text) is entirely local to legalDisclosure.js -
// no MMUI data needed, just the right name.
function handleSelectAgreementsAndDisclaimers(ws, uiaId) {
    sendContextChange(ws, uiaId, 'AgreementsDisclaimers');
}

// Open the factory-reset confirmation dialog.
function handleSelectFactoryReset(ws, uiaId) {
    sendContextChange(ws, uiaId, 'FactoryResetConfirm');
    dialogState.factoryResetConfirmActive = true;
}

// "FactoryResetConfirm"'s "No" button - forwards the literal "Global.No" appData to
// uiaId "common" (see this file's _dialogDefaultSelectCallback, `case
// "FactoryResetConfirm":` branch - it sends whatever appData the button had,
// unconditionally). Just dismiss back to the System settings tab underneath, same as a
// "Global.GoBack", without doing anything else.
function handleFactoryResetNo(ws) {
    dialogState.factoryResetConfirmActive = false;
    if (navigationState.goBackStack.length > 1) {
        navigationState.goBackStack.pop();
        const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
        sendContextChange(
            ws,
            context.uiaId,
            context.ctxtId,
            context.params,
            context.contextSeq,
            true
        );
    }
}

// "FactoryResetConfirm"'s "Yes" button (same "Global.No"-style forwarding, but with
// appData "Global.Yes" - see handleFactoryResetNo() above for the shared mechanism).
// Note: unlike handleSelectFactoryReset() (called with the uiaId the GUI's own click
// event carried, "syssettings"), this is called from dispatcher.js's generic
// "Global.Yes" case, whose uiaId is whatever the CURRENT event carried ("common", since
// that's what the confirm dialog's buttons send to) - not the uiaId that
// "FactoryResetProgress" actually belongs to. So this hardcodes "syssettings" rather
// than trusting a passed-in uiaId.
//
// STUB: real hardware would now actually wipe all persisted settings back to their
// factory defaults (see this file's "FactoryResetProgress" context / "Restoring all
// settings" spinner, driven by repeated "SendFactoryResetProgress" msgs reporting an
// item counter, e.g. "3/12"), likely finishing with a head-unit reboot. We do NOT
// perform an actual reset here yet - this only shows the progress spinner for a bit and
// then returns to the System tab, so the screens can be seen without risking wiping any
// real settings.json values while just poking around. See RESEARCH_NOTES.md for the
// follow-up note on actually implementing the reset (delete/reset
// server/data/user-settings.json) if that's ever wanted.
function handleFactoryResetYes(ws) {
    dialogState.factoryResetConfirmActive = false;
    dialogState.factoryResetProgressActive = true;
    sendContextChange(ws, 'syssettings', 'FactoryResetProgress', undefined, undefined, true);
    setTimeout(function () {
        dialogState.factoryResetProgressActive = false;
        if (navigationState.goBackStack.length > 1) {
            navigationState.goBackStack.pop();
            const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
            sendContextChange(
                ws,
                context.uiaId,
                context.ctxtId,
                context.params,
                context.contextSeq,
                true
            );
        }
    }, 2000);
}

module.exports = {
    handleSelectLanguageConf: handleSelectLanguageConf,
    handleSetLanguage: handleSetLanguage,
    handleLanguageConfNo: handleLanguageConfNo,
    handleSetTimeFormat: handleSetTimeFormat,
    handleSetUnitsTemperature: handleSetUnitsTemperature,
    handleSetUnitsDistance: handleSetUnitsDistance,
    sendDisplayState: sendDisplayState,
    handleSetDisplayDayNight: handleSetDisplayDayNight,
    handleSetDisplayBrightness: handleSetDisplayBrightness,
    handleSetDisplayContrast: handleSetDisplayContrast,
    handleDisplayReset: handleDisplayReset,
    handleDisplayResetNo: handleDisplayResetNo,
    handleDisplayResetYes: handleDisplayResetYes,
    sendClockState: sendClockState,
    sendDevicesState: sendDevicesState,
    handleSetGpsSync: handleSetGpsSync,
    handleSetTimeZone: handleSetTimeZone,
    handleSetDaylightSavingTime: handleSetDaylightSavingTime,
    handleSetTime: handleSetTime,
    handleSelectChangeLanguage: handleSelectChangeLanguage,
    handleSelectAgreementsAndDisclaimers: handleSelectAgreementsAndDisclaimers,
    handleSelectFactoryReset: handleSelectFactoryReset,
    handleFactoryResetNo: handleFactoryResetNo,
    handleFactoryResetYes: handleFactoryResetYes
};
