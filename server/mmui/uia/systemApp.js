const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const startup = require('../services/startup');
const vehsettingsApp = require('./vehsettingsApp');
const syssettingsApp = require('./syssettingsApp');
const audiosettingsApp = require('./audiosettingsApp');
const btpairingApp = require('./btpairingApp');
const settings = require('../services/settings');
const vehicleEquipment = require('../services/vehicleEquipment');
const schedmaintApp = require('./schedmaintApp');
const ecoenergyApp = require('./ecoenergyApp');
const logger = require('../../logger');
const coldStart = require('../services/coldStart');

// Dialog state of this application (what the shared Global.Yes / Global.No answer, see commonApp.js).
const dialogs = {
    disclaimerActive: false,
    introAnimationActive: false
};

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
    dialogs.introAnimationActive = false;
    coldStart.cancel(ws);
}

// The GUI's startup request arrives instantly here; the answer waits for the simulated boot.
function scheduleStartupSettings(ws) {
    dialogs.introAnimationActive = false;
    coldStart.waitForBoot(ws, handleGetStartupSettings);
}

// Cold start: the firmware starts the tranlogo video and enters IntroAnimation. When the
// video ends it reports FinishIntroAnimation, the system state becomes NORMAL and the
// native side raises ShowDisclaimer, which lands in the Disclaimer context.
function startIntroAnimation(ws) {
    dialogs.disclaimerActive = false;
    dialogs.introAnimationActive = true;
    sendContextChange(ws, 'system', 'IntroAnimation', undefined, undefined, true);
    coldStart.waitForIntroEnd(ws, showDisclaimer);
}

function showDisclaimer(ws) {
    dialogs.introAnimationActive = false;
    navigationState.goBackStack = [];
    dialogs.disclaimerActive = true;
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
    dialogs.disclaimerActive = false;
    sendContextChange(ws, 'system', 'HomeScreen');
}

// Agree and the firmware timeout both return to Home.
function dismissDisclaimer(ws) {
    dialogs.disclaimerActive = false;
    navigationState.goBackStack = [];
    sendContextChange(ws, 'system', 'HomeScreen');
    showPendingSystemWarning(ws);
}

// "Temperature Warning" state per GUI connection (several tabs may be open).
const openSystemWarnings = new WeakSet();
const pendingSystemWarnings = new WeakSet();

// IntentSystemWarningMessage(DisplayExtremeTemp): the firmware opens the SystemWarning context
// from almost anywhere, but keeps the message as pending while the boot video or the Disclaimer
// is up (UIA_SYSTEM_SavePendingWarningMessage) and ignores it while a warning is already open.
function requestSystemWarning(ws) {
    if (openSystemWarnings.has(ws)) {
        return;
    }
    if (dialogs.introAnimationActive || dialogs.disclaimerActive) {
        pendingSystemWarnings.add(ws);
        return;
    }
    pendingSystemWarnings.delete(ws);
    openSystemWarnings.add(ws);
    // Transient dialog: it must not become a back-stack entry.
    sendContextChange(ws, 'system', 'SystemWarning', undefined, undefined, true);
}

function showPendingSystemWarning(ws) {
    if (pendingSystemWarnings.has(ws)) {
        requestSystemWarning(ws);
    }
}

function isSystemWarningOpen(ws) {
    return openSystemWarnings.has(ws);
}

// OK (Global.Yes) on the warning goes to Home. The firmware would return to the Disclaimer if
// the warning had interrupted it, which the emulator avoids by deferring the warning instead.
function dismissSystemWarning(ws) {
    openSystemWarnings.delete(ws);
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

// Events of the system application (libjciuiasystem.so), dispatched by eventId.
const events = {
    'Global.GetStartupSettings': (ws) => scheduleStartupSettings(ws),
    'Global.InitGui': (ws) => handleInitGui(ws),
    'Global.IntentHome': (ws) => handleIntentHome(ws),
    'Global.IntentSettingsTab': (ws, params) => handleIntentSettingsTab(ws, params),
    SelectApplications: (ws) => handleSelectApplications(ws),
    SelectEntertainment: (ws) => handleSelectEntertainment(ws),
    SelectCommunication: (ws) => handleSelectCommunication(ws),
    SelectNavigation: (ws) => handleSelectNavigation(ws),
    SelectEcoEnergy: (ws) => handleSelectEcoEnergy(ws),
    SelectVehicleStatusMonitor: (ws) => handleSelectVehicleStatusMonitor(ws),
    SelectWarnGuide: (ws) => handleSelectWarnGuide(ws),
    SelectSchedMaint: (ws) => handleSelectSchedMaint(ws)
};

// Dialogs this application answers for the shared Global.Yes / Global.No, as [flag, handler]
// in the order they are tried.
const dialogAnswers = {
    yes: [['disclaimerActive', dismissDisclaimer]],
    no: []
};

module.exports = {
    dialogs: dialogs,
    dialogAnswers: dialogAnswers,
    events: events,
    handleGetStartupSettings: handleGetStartupSettings,
    handleInitGui: handleInitGui,
    showDisclaimer: showDisclaimer,
    cancelColdStart: cancelColdStart,
    scheduleStartupSettings: scheduleStartupSettings,
    handleIntentHome: handleIntentHome,
    dismissDisclaimer: dismissDisclaimer,
    requestSystemWarning: requestSystemWarning,
    isSystemWarningOpen: isSystemWarningOpen,
    dismissSystemWarning: dismissSystemWarning,
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
