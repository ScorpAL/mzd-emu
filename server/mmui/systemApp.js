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

    sendContextChange(ws, 'system', 'Applications', undefined, undefined, true);
}

// The firmware shows this warning at every power-on.
function handleInitGui(ws) {
    navigationState.goBackStack = [];
    dialogState.disclaimerActive = true;
    // Disclaimer is transient and must not enter the back stack.
    sendContextChange(ws, 'system', 'Disclaimer', undefined, undefined, true);
}

// Home is the navigation root; discard stale stack entries.
function handleIntentHome(ws) {
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
