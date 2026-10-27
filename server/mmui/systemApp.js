const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('./navigationState');
const dialogState = require('./dialogState');
const startup = require('./startup');
const vehsettingsApp = require('./vehsettingsApp');
const syssettingsApp = require('./syssettingsApp');
const audiosettingsApp = require('./audiosettingsApp');
const btpairingApp = require('./btpairingApp');
const settings = require('./settings');
const vehicleEquipment = require('./vehicleEquipment');
const schedmaintApp = require('./schedmaintApp');
const ecoenergyApp = require('./ecoenergyApp');
const logger = require('../logger');
const splashVideo = require('./splashVideo');

// Simulated cold start (an object so tests can override it).
const coldStart = {
    // Delay before answering the GUI's first request, standing in for the real unit's long
    // boot while the logo loops (LoopLogo.ivf, 2250 ms per pass; see ui-wayland.js).
    // Keep it under 20 s, when the GUI falls back to defaults. 0 disables it.
    bootDelayMs: 4250
};

// Cold-start timers per GUI connection; several browser tabs may be connected at once.
const coldStartTimers = new WeakMap();

function handleGetStartupSettings(ws) {
    startup.sendStartupSettings(ws);
    syssettingsApp.sendDisplayState(ws);
    syssettingsApp.sendClockState(ws);
    syssettingsApp.sendDevicesState(ws);
    audiosettingsApp.sendSoundState(ws);

    vehsettingsApp.sendVehicleFeatureInstalled(ws);
    vehsettingsApp.sendVehicleCapabilityState(ws);
    vehsettingsApp.sendHudType(ws);
    vehsettingsApp.sendNavigationAvailability(ws);
    vehsettingsApp.sendIgnitionOn(ws);
    vehsettingsApp.sendHudState(ws);
    vehsettingsApp.sendDoorLockState(ws);
    vehsettingsApp.sendSpeedAlarmState(ws);
    vehsettingsApp.sendTurnSettingsState(ws);
    vehsettingsApp.sendLightingState(ws);
    vehsettingsApp.sendSafetyState(ws);
    sendApplicationsState(ws);

    btpairingApp.sendPhoneConnectedStatus(ws);

    startIntroAnimation(ws);
}

function cancelColdStart(ws) {
    const timers = coldStartTimers.get(ws);
    if (timers) {
        clearTimeout(timers.boot);
        clearTimeout(timers.intro);
        coldStartTimers.delete(ws);
    }
}

function setColdStartTimer(ws, key, delayMs, callback) {
    const timers = coldStartTimers.get(ws) || {};
    clearTimeout(timers[key]);
    // Never keep the process alive just for a simulated boot step.
    timers[key] = setTimeout(callback, delayMs).unref();
    coldStartTimers.set(ws, timers);
    if (typeof ws.once === 'function' && !timers.closeHooked) {
        timers.closeHooked = true;
        ws.once('close', () => cancelColdStart(ws));
    }
}

// The GUI's startup request arrives instantly here; delay the answer like a real boot.
function scheduleStartupSettings(ws) {
    cancelColdStart(ws);
    const delayMs = coldStart.bootDelayMs || 0;
    if (delayMs <= 0) {
        handleGetStartupSettings(ws);
        return;
    }
    setColdStartTimer(ws, 'boot', delayMs, () => handleGetStartupSettings(ws));
}

// Cold start: the firmware starts the tranlogo video and enters IntroAnimation. When the
// video ends it reports FinishIntroAnimation, the system state becomes NORMAL and the
// native side raises ShowDisclaimer, which lands in the Disclaimer context.
function startIntroAnimation(ws) {
    dialogState.disclaimerActive = false;
    sendContextChange(ws, 'system', 'IntroAnimation', undefined, undefined, true);
    // The firmware leaves IntroAnimation when the tranlogo service exits at the end of the
    // video; without the video file there is nothing to wait for.
    const durationMs = splashVideo.ivfDurationMs('TranLogo.ivf') || 0;
    setColdStartTimer(ws, 'intro', durationMs, () => showDisclaimer(ws));
}

function showDisclaimer(ws) {
    navigationState.goBackStack = [];
    dialogState.disclaimerActive = true;
    // Disclaimer is transient and must not enter the back stack.
    sendContextChange(ws, 'system', 'Disclaimer', undefined, undefined, true);
}

// The GUI asks for the current context; the firmware answers with the one it already holds
// (IntroAnimation on cold start), so nothing new is sent here.
function handleInitGui() {
    navigationState.goBackStack = [];
}

// Home is the navigation root; discard stale stack entries.
function handleIntentHome(ws) {
    cancelColdStart(ws);
    navigationState.goBackStack = [];
    dialogState.disclaimerActive = false;
    sendContextChange(ws, 'system', 'HomeScreen');
}

// Agree and the firmware timeout both return to Home.
function dismissDisclaimer(ws) {
    dialogState.disclaimerActive = false;
    navigationState.goBackStack = [];
    sendContextChange(ws, 'system', 'HomeScreen');
}

function handleSelectApplications(ws) {
    sendApplicationsState(ws);
    sendContextChange(ws, 'system', 'Applications');
}

function sendSystemMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'system',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('system', 'Sent message msgId=%s', msgId);
}

function sendSyssettingsMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'syssettings',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('system', 'Sent syssettings message msgId=%s', msgId);
}

function sendStatusMenuVisible(ws, appName, visible) {
    sendSystemMsg(ws, 'StatusMenuVisible', {
        appName: appName,
        state: visible ? 'Visible' : 'Invisible'
    });
}

function sendStatusMenu(ws, appName, available) {
    sendSystemMsg(ws, 'StatusMenu', {
        statusMenu: {
            appName: appName,
            appStatus: available ? 'Available' : 'Unavailable'
        }
    });
}

function sendApplicationStatus(ws, appName, visible, available) {
    sendStatusMenuVisible(ws, appName, visible);
    sendStatusMenu(ws, appName, available);
}

function sendApplicationsState(ws) {
    sendSyssettingsMsg(ws, 'VehicleConfigData', { evData: 'New' });

    sendSystemMsg(ws, 'StatusUpdateEcoEnergy', { fuelType: 'GAS' });
    sendApplicationStatus(ws, 'ecoenergy', true, true);

    sendApplicationStatus(ws, 'warnguide', true, true);
    sendApplicationStatus(ws, 'schedmaint', true, true);
    sendApplicationStatus(ws, 'vsm', false, false);
    sendStatusMenu(ws, 'vehicleStatus', true);

    sendApplicationStatus(ws, 'carplay', true, false);
    sendApplicationStatus(ws, 'androidauto', true, false);

    sendApplicationStatus(ws, 'xmdata', false, false);
    sendApplicationStatus(ws, 'hdtrafficimage', false, false);
    sendApplicationStatus(ws, 'idm', false, false);
    sendApplicationStatus(ws, 'driverid', false, false);
    sendApplicationStatus(ws, 'vdt_settings', false, false);
    sendApplicationStatus(ws, 'vdt', false, false);

    sendSystemMsg(ws, 'WarningStatusCount', { warningcount: 0 });
    sendSystemMsg(ws, 'StatusUpdateSchedMaint', { due: false });
}

function handleSelectEcoEnergy(ws) {
    ecoenergyApp.handleSelectEcoEnergy(ws);
}

function handleSelectVehicleStatusMonitor(ws) {
    sendApplicationsState(ws);
    sendContextChange(ws, 'system', 'VehicleStatusMonitor');
}

function handleSelectWarnGuide(ws) {
    sendContextChange(ws, 'warnguide', 'WarningList');
}

function handleSelectSchedMaint(ws) {
    schedmaintApp.handleSelectSchedMaint(ws);
}

function handleSelectEntertainment(ws) {
    sendContextChange(ws, 'system', 'Entertainment');
}

function handleSelectCommunication(ws) {
    sendContextChange(ws, 'system', 'Communication');
}

// Navigation belongs to the separate emnavi app, which is not emulated.
function handleSelectNavigation(_ws) {}

// Settings opens directly on the first available tab; there is no system/Settings context.
function handleSelectSettings(ws) {
    sendContextChange(ws, getInitialSettingsTabUiaId(), getInitialSettingsTabContextId());
}

function getInitialSettingsTabUiaId() {
    return vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed === 1 ? 'vehsettings' : 'syssettings';
}

function getInitialSettingsTabContextId() {
    if (vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed !== 1) {
        return 'DisplayTab';
    }

    return settings.HARDWARE_CONFIG.vehicleType === 'SETTINGS_VehicleModelType_J78A'
        ? 'HUDTabJ78'
        : 'HUDTab';
}

// Tabs are siblings, so replace the current stack entry instead of adding depth.
function handleIntentSettingsTab(ws, params) {
    if (navigationState.goBackStack.length > 0) {
        navigationState.goBackStack.pop();
    }
    switch (params.payload.settingsTab) {
        case 'HUD':
            // HUD uses a model-specific context under vehsettings.
            if (settings.HARDWARE_CONFIG.vehicleType === 'SETTINGS_VehicleModelType_J78A') {
                sendContextChange(ws, 'vehsettings', 'HUDTabJ78');
            } else {
                sendContextChange(ws, 'vehsettings', 'HUDTab');
            }
            break;
        case 'Display':
            sendContextChange(ws, 'syssettings', 'DisplayTab');
            break;
        case 'Safety':
            sendContextChange(ws, 'vehsettings', 'SafetyTab');
            break;
        case 'Sound':
            sendContextChange(ws, 'audiosettings', 'SoundTab');
            break;
        case 'Clock':
            sendContextChange(ws, 'syssettings', 'ClockTab');
            break;
        case 'Vehicle':
            sendContextChange(ws, 'vehsettings', 'VehicleSettingsTab');
            break;
        case 'Devices':
            syssettingsApp.sendDevicesState(ws);
            sendContextChange(ws, 'syssettings', 'DevicesTab');
            break;
        case 'System':
            sendContextChange(ws, 'syssettings', 'SystemTab');
            break;
    }
}

module.exports = {
    handleGetStartupSettings: handleGetStartupSettings,
    handleInitGui: handleInitGui,
    showDisclaimer: showDisclaimer,
    coldStart: coldStart,
    cancelColdStart: cancelColdStart,
    scheduleStartupSettings: scheduleStartupSettings,
    handleIntentHome: handleIntentHome,
    dismissDisclaimer: dismissDisclaimer,
    sendApplicationsState: sendApplicationsState,
    handleSelectApplications: handleSelectApplications,
    handleSelectEcoEnergy: handleSelectEcoEnergy,
    handleSelectVehicleStatusMonitor: handleSelectVehicleStatusMonitor,
    handleSelectWarnGuide: handleSelectWarnGuide,
    handleSelectSchedMaint: handleSelectSchedMaint,
    handleSelectEntertainment: handleSelectEntertainment,
    handleSelectCommunication: handleSelectCommunication,
    handleSelectNavigation: handleSelectNavigation,
    handleSelectSettings: handleSelectSettings,
    handleIntentSettingsTab: handleIntentSettingsTab
};
