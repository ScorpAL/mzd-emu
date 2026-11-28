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
const fmradioApp = require('./fmradioApp');
const phoneApp = require('./phoneApp');
const contactsApp = require('./contactsApp');
const smsApp = require('./smsApp');
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

// Stitcher entertainment item. The real car decides this in libjciuiastitcher.so
// (stitcher_dbus_InformAboutOurVisibility / ...OurAvailability, read from the firmware's
// disassembly):
//   - the item is hidden AND unavailable only for Destination 12 (CA) together with BLM
//     VehicleModelType 7 (the UIA enum name for that value is J03W);
//   - otherwise it is available, once the blm_ira_stitcher and offboard Stitcher services
//     are up and the audio flag is set (the emulator treats all of these as always true;
//     no phone is needed);
//   - when it is not hidden the car sends no StatusMenuVisible at all, so the item keeps
//     the GUI default (visible).
// Both values come from config/vehicle.json through settings.HARDWARE_CONFIG.
const STITCHER_BLOCKED_DESTINATION = 'SETTINGS_Destination_CA';
const STITCHER_BLOCKED_VEHICLE_TYPE = 'SETTINGS_VehicleModelType_J03W';

function isStitcherBlockedForThisVehicle() {
    return (
        settings.HARDWARE_CONFIG.destinationCode === STITCHER_BLOCKED_DESTINATION &&
        settings.HARDWARE_CONFIG.vehicleType === STITCHER_BLOCKED_VEHICLE_TYPE
    );
}

function sendStitcherState(ws) {
    if (isStitcherBlockedForThisVehicle()) {
        sendApplicationStatus(ws, 'stitcher', false, false);
    } else {
        sendStatusMenu(ws, 'stitcher', true);
    }
}

function sendApplicationsState(ws) {
    sendSyssettingsMsg(ws, 'VehicleConfigData', { evData: 'New' });

    sendSystemMsg(ws, 'StatusUpdateEcoEnergy', { fuelType: 'GAS' });
    sendApplicationStatus(ws, 'ecoenergy', true, true);

    sendApplicationStatus(ws, 'warnguide', true, true);
    sendApplicationStatus(ws, 'schedmaint', true, true);
    sendApplicationStatus(ws, 'vsm', false, false);
    sendStatusMenu(ws, 'vehicleStatus', true);

    const carplayAvailable =
        settings.HARDWARE_CONFIG.appleCarPlayAvailable === 'On' ||
        settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On';
    const carplayConnected =
        carplayAvailable && settings.HARDWARE_CONFIG.appleCarPlayConnection === 'On';
    const aaAvailable = settings.HARDWARE_CONFIG.androidAutoAvailable === 'On';
    const aaConnected = aaAvailable && settings.HARDWARE_CONFIG.androidAutoConnection === 'On';

    sendApplicationStatus(ws, 'carplay', carplayAvailable, carplayConnected);
    sendApplicationStatus(ws, 'androidauto', aaAvailable, aaConnected);
    sendRemoteUiStatus(ws, carplayConnected, aaConnected);

    sendApplicationStatus(ws, 'phone', true, true);
    sendApplicationStatus(ws, 'contacts', true, true);
    sendApplicationStatus(ws, 'sms', true, true);
    sendStatusMenu(ws, 'fmradio', true);
    sendStatusMenu(ws, 'syssettings', true);

    sendStitcherState(ws);

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

// "Connect" in the No Device Connected window (system/NoDevice): the window closes and Settings > Devices > Bluetooth opens.
function handleSelectConnect(ws) {
    const stack = navigationState.goBackStack;
    const top = stack[stack.length - 1];
    if (top && top.uiaId === 'system' && top.ctxtId === 'NoDevice') {
        stack.pop();
    }
    btpairingApp.handleSelectBluetooth(ws);
}

function sendCommunicationState(ws) {
    sendApplicationStatus(ws, 'phone', true, true);
    sendApplicationStatus(ws, 'contacts', true, true);
    sendApplicationStatus(ws, 'sms', true, true);
    sendStatusMenu(ws, 'syssettings', true);
}

function sendRemoteUiStatus(ws, carplayConnected, aaConnected) {
    // StatusBarCtrl has a single RemoteUI button slot; sending 'Hidden' for an inactive
    // projection clears an active one, so only emit 'Hidden' when neither is connected.
    if (carplayConnected) {
        sendSystemMsg(ws, 'StatusMenuVisibleCarPlay', {
            appName: 'carplay',
            state: 'Visible',
            deviceName: 'iPhone'
        });
    } else if (aaConnected) {
        sendSystemMsg(ws, 'StatusMenuVisibleAndroidAuto', {
            appName: 'androidauto',
            state: 'Visible'
        });
    } else {
        sendSystemMsg(ws, 'StatusMenuVisibleCarPlay', {
            appName: 'carplay',
            state: 'Hidden',
            deviceName: 'iPhone'
        });
        sendSystemMsg(ws, 'StatusMenuVisibleAndroidAuto', {
            appName: 'androidauto',
            state: 'Hidden'
        });
    }
}

function sendEntertainmentState(ws) {
    const carplayConnected =
        (settings.HARDWARE_CONFIG.appleCarPlayAvailable === 'On' ||
            settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On') &&
        settings.HARDWARE_CONFIG.appleCarPlayConnection === 'On';
    const aaConnected =
        settings.HARDWARE_CONFIG.androidAutoAvailable === 'On' &&
        settings.HARDWARE_CONFIG.androidAutoConnection === 'On';

    sendStatusMenu(ws, 'fmradio', true);
    sendRemoteUiStatus(ws, carplayConnected, aaConnected);
}

function handleSelectEntertainment(ws) {
    sendEntertainmentState(ws);
    sendContextChange(ws, 'system', 'Entertainment');
}

function handleSelectCommunication(ws) {
    sendCommunicationState(ws);
    sendContextChange(ws, 'system', 'Communication');
}

function handleSelectRadioFM(ws) {
    fmradioApp.handleSelectRadioFM(ws);
}

function handleSelectPhone(ws) {
    phoneApp.handleSelectPhone(ws);
}

function handleSelectContacts(ws) {
    contactsApp.handleSelectContacts(ws);
}

function handleSelectCallHistory(ws) {
    phoneApp.handleSelectCallHistory(ws);
}

function handleSelectSms(ws) {
    smsApp.handleSelectSms(ws);
}

function handleSelectActiveCall(ws) {
    phoneApp.handleSelectActiveCall(ws);
}

function handleSelectCarPlay(ws) {
    const carplayConnected =
        (settings.HARDWARE_CONFIG.appleCarPlayAvailable === 'On' ||
            settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On') &&
        settings.HARDWARE_CONFIG.appleCarPlayConnection === 'On';
    if (carplayConnected) {
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'carplay',
                msgId: 'SendDeviceListInfo',
                params: {
                    payload: {
                        devicelistsize: 1,
                        devicelistInfo: {
                            CarplayDeviceList: [
                                {
                                    clientId: 1,
                                    friendlyName: 'iPhone',
                                    connectMode: 1,
                                    serialId: 'cp-1',
                                    btMacAddress: '00:11:22:33:44:55',
                                    isPaired: true
                                }
                            ]
                        }
                    }
                }
            })
        );
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'carplay',
                msgId: 'SendCPSessionState',
                params: {
                    payload: {
                        state: true,
                        btMacAddress: '00:11:22:33:44:55',
                        serialId: 'cp-1'
                    }
                }
            })
        );
    } else {
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'carplay',
                msgId: 'SendCPSessionState',
                params: { payload: { state: false } }
            })
        );
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'carplay',
                msgId: 'SendNoneDeviceListInfo',
                params: { payload: {} }
            })
        );
    }
    sendContextChange(ws, 'carplay', 'DeviceList');
}

function handleDisplayOffGUIActivity(ws) {
    const stack = navigationState.goBackStack;
    if (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.uiaId === 'system' && top.ctxtId === 'DisplayOff') {
            stack.pop();
        }
    }
    if (stack.length > 0) {
        const context = stack[stack.length - 1];
        sendContextChange(
            ws,
            context.uiaId,
            context.ctxtId,
            context.params,
            context.contextSeq,
            true
        );
    } else {
        sendContextChange(ws, 'syssettings', 'DisplayTab');
    }
}

function sendPhoneCallStatus(ws, phoneCallStatus) {
    sendSystemMsg(ws, 'StatusPhoneCall', { phoneCallStatus: phoneCallStatus });
}

// Navigation belongs to the separate emnavi app, which is not emulated.
function handleSelectNavigation(_ws) {}

// Settings opens directly on the first available tab; there is no system/Settings context.
function handleSelectSettings(ws) {
    const stack = navigationState.goBackStack;
    const top = stack[stack.length - 1];
    if (top && top.uiaId === 'system' && top.ctxtId === 'Communication') {
        sendContextChange(ws, 'syssettings', 'CommunicationSettings');
        return;
    }
    if (top && (top.uiaId === 'fmradio' || top.ctxtId === 'NowPlaying')) {
        audiosettingsApp.sendSoundState(ws);
        sendContextChange(ws, 'audiosettings', 'SoundTab');
        return;
    }
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
    SelectConnect: (ws) => handleSelectConnect(ws),
    SelectCommunication: (ws) => handleSelectCommunication(ws),
    SelectNavigation: (ws) => handleSelectNavigation(ws),
    SelectEcoEnergy: (ws) => handleSelectEcoEnergy(ws),
    SelectVehicleStatusMonitor: (ws) => handleSelectVehicleStatusMonitor(ws),
    SelectWarnGuide: (ws) => handleSelectWarnGuide(ws),
    SelectSchedMaint: (ws) => handleSelectSchedMaint(ws),
    SelectRadioFM: (ws) => handleSelectRadioFM(ws),
    SelectPhone: (ws) => handleSelectPhone(ws),
    SelectContacts: (ws) => handleSelectContacts(ws),
    SelectCallHistory: (ws) => handleSelectCallHistory(ws),
    SelectSms: (ws) => handleSelectSms(ws),
    SelectActiveCall: (ws) => handleSelectActiveCall(ws),
    SelectCarPlay: (ws) => handleSelectCarPlay(ws),
    SelectCarPlayWifi: (ws) => handleSelectCarPlay(ws),
    SelectAppleCarPlay: (ws) => handleSelectCarPlay(ws),
    DisplayOffGUIActivity: (ws) => handleDisplayOffGUIActivity(ws),
    DisplayOffNotificationEvent: (ws) => handleDisplayOffGUIActivity(ws)
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
    isStitcherBlockedForThisVehicle: isStitcherBlockedForThisVehicle,
    handleSelectApplications: handleSelectApplications,
    handleSelectEcoEnergy: handleSelectEcoEnergy,
    handleSelectVehicleStatusMonitor: handleSelectVehicleStatusMonitor,
    handleSelectWarnGuide: handleSelectWarnGuide,
    handleSelectSchedMaint: handleSelectSchedMaint,
    handleSelectEntertainment: handleSelectEntertainment,
    handleSelectConnect: handleSelectConnect,
    handleSelectCommunication: handleSelectCommunication,
    handleSelectNavigation: handleSelectNavigation,
    handleSelectSettings: handleSelectSettings,
    handleIntentSettingsTab: handleIntentSettingsTab,
    sendPhoneCallStatus: sendPhoneCallStatus,
    handleSelectRadioFM: handleSelectRadioFM,
    handleSelectPhone: handleSelectPhone,
    handleSelectContacts: handleSelectContacts,
    handleSelectCallHistory: handleSelectCallHistory,
    handleSelectSms: handleSelectSms,
    handleSelectActiveCall: handleSelectActiveCall,
    handleDisplayOffGUIActivity: handleDisplayOffGUIActivity
};
