const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const vehicleEquipment = require('./vehicleEquipment');
const settings = require('./settings');
const navigationState = require('./navigationState');
const dialogState = require('./dialogState');
const logger = require('../logger');

// Send optional-equipment flags before settings screens are opened.
function sendVehicleFeatureInstalled(ws) {
    const equipment = vehicleEquipment.VEHICLE_EQUIPMENT;

    Object.keys(equipment).forEach(function (flagName) {
        let payload = { evData: equipment[flagName] };
        if (flagName === 'ParkingSensor_Installed') {
            payload = {
                parkingSensorConfig: equipment[flagName] === 1 ? 'Installed' : 'NOTInstalled'
            };
        }
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: vehicleEquipment.getUiaIdForFlag(flagName),
            msgId: flagName,
            params: { payload: payload }
        });
        ws.send(msg);
        logger.debug('vehsettings', 'Sent vehicle feature installed state');
    });
}

function sendVehicleCapabilityState(ws) {
    const capabilities = vehicleEquipment.VEHICLE_CAPABILITIES;
    Object.keys(capabilities).forEach(function (msgId) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'vehsettings',
            msgId: msgId,
            params: { payload: { evData: capabilities[msgId] } }
        });
        ws.send(msg);
        logger.debug('vehsettings', 'Sent vehicle capability state');
    });
}

// HudType is a separate hardware signal.
function sendHudType(ws) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'HudType',
        params: { payload: { evData: require('./settings').HARDWARE_CONFIG.hudType } }
    });
    ws.send(msg);
    logger.debug('vehsettings', 'Sent vehicle HUD type');
}

function sendNavigationAvailability(ws) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'NAVIEquipped',
        params: { payload: { evData: settings.HARDWARE_CONFIG.navigationSdCard } }
    });
    ws.send(msg);
    logger.debug('vehsettings', 'Sent navigation SD card state');
}

// Vehicle and Safety settings stay disabled until IgnitionStatus is received.
function sendIgnitionOn(ws) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'IgnitionStatus',
        params: { payload: { evData: 1 } }
    });
    ws.send(msg);
    logger.debug('vehsettings', 'Sent ignition state');
}

function sendHudState(ws) {
    const values = settings.currentSettings;
    [
        ['HUDHeight', values.hudHeight],
        ['HUDBrightnessControl', values.hudBrightnessControl],
        ['HUDBrightness', values.hudBrightness],
        ['HUDCalibration', values.hudCalibration],
        [
            'GetHUDRotation',
            {
                '-3': 'Level_minus_3',
                '-2': 'Level_minus_2',
                '-1': 'Level_minus_1',
                0: 'Level_Default',
                1: 'Level_plus_1',
                2: 'Level_plus_2',
                3: 'Level_plus_3'
            }[values.hudRotation]
        ],
        ['HUDNavigation', values.hudNavigation],
        ['HUDDisplay', values.hudDisplay],
        ['GetHUDStreet', values.hudStreetInformation],
        ['GetHUDNavigation', values.hudNavigationScreen],
        ['Hud_ControlAllowed', 1],
        ['HUDError', 0]
    ].forEach(function (entry) {
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'vehsettings',
                msgId: entry[0],
                params: { payload: { evData: entry[1] } }
            })
        );
    });
}

function saveHudValue(name, value) {
    settings.currentSettings[name] = value;
    settings.saveUserSettings();
}

function isJ36IpmScbsProfile() {
    return (
        vehicleEquipment.VEHICLE_EQUIPMENT.SCBS_Installed === 4 ||
        vehicleEquipment.VEHICLE_EQUIPMENT.SCBS_Installed === 5
    );
}

function normalizeScbsMode(value) {
    const enabled = value === 'SCBS_On' || value === 'SBS_On';
    if (isJ36IpmScbsProfile()) {
        return enabled ? 'SCBS_On' : 'SCBS_Off';
    }
    return enabled ? 'SCBS_On' : 'SCBS_Off';
}

function normalizeJ36IpmScbsDistance(value) {
    switch (value) {
        case 'SCBSDistance_Long':
        case 'SBS_Distance_Long':
            return 'SCBSDistance_Long';
        case 'SCBSDistance_Middle':
        case 'SBS_Distance_Middle':
            return 'SCBSDistance_Middle';
        case 'SCBSDistance_Short':
        case 'SBS_Distance_Short':
        default:
            return 'SCBSDistance_Short';
    }
}

function normalizeSbsDistance(value) {
    switch (value) {
        case 'SBS_Distance_Long':
        case 'SCBSDistance_Long':
            return 'SBS_Distance_Long';
        case 'SBS_Distance_Short':
        case 'SCBSDistance_Short':
        default:
            return 'SBS_Distance_Short';
    }
}

function normalizeBsmSystem(value) {
    return value === 'BSM_Off' ? 'BSM_Off' : 'BSM_On';
}

function sendSafetyState(ws) {
    const values = settings.currentSettings;
    const bsmSystem = normalizeBsmSystem(values.bsmSystem);
    const scbsMode = normalizeScbsMode(values.scbsMode);
    const sbsDistance = normalizeSbsDistance(values.sbsDistance);
    const j36IpmScbsDistance = normalizeJ36IpmScbsDistance(values.sbsDistance);
    [
        ['GetDRSS', values.drssMode],
        ['GetDRSSDistance', values.drssDistance],
        ['GetSBS', values.sbsMode],
        ['GetSBSDistance', sbsDistance],
        ['GetSBSBuzzerVolume', values.sbsBuzzerVolume],
        ['GetSCBS', scbsMode],
        ['GetSBS_SCBS_J36IPM', scbsMode],
        ['GetSBS_SCBS_DistanceJ36IPM', j36IpmScbsDistance],
        ['GetFOW', values.fowMode],
        ['GetFOWDistance', values.fowDistance],
        ['GetFOWBuzzerVolume', values.fowBuzzerVolume],
        ['GetBSMBuzzerVolume', values.bsmBuzzerVolume],
        ['BSMSystem_Status', bsmSystem],
        ['GetLDWSTiming', values.ldwsTiming],
        ['GetLDWSWarning', values.ldwsWarning],
        ['GetBuzzerSetting', values.ldwsSound],
        ['GetLDWSBuzzerVolume', values.ldwsSoundVolume],
        ['GetLASIntervention', values.lasIntervention],
        ['GetLASAlert', values.lasAlert],
        ['GetMRCCDistanceControl', values.mrccDistanceControl],
        ['GetDA', values.driverAttentionAlert],
        ['GetSLC', values.speedLimitCaution],
        ['GetCautionSpeed', values.cautionSpeed],
        ['GetSLS_HUD', values.speedLimitHud],
        ['GetSLS_Center', values.speedLimitCenter],
        ['GetTVMAutoViewStart', values.tvmAutoViewStart],
        ['GetTVMVehiclePathLine', values.tvmVehiclePathLine],
        ['GetTVMFrontViewDisplay', values.tvmFrontViewDisplay],
        ['GetRainSensingWiper', values.autoWiper]
    ].forEach(function (entry) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'vehsettings',
            msgId: entry[0],
            params: { payload: { evData: entry[1] } }
        });
        ws.send(msg);
        logger.debug('vehsettings', 'Sent safety state');
    });

    const parkingSensorMsg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'GetParkingSensor',
        params: { payload: { parkingSensorSetting: values.parkingSensor } }
    });
    ws.send(parkingSensorMsg);
    logger.debug('vehsettings', 'Sent parking sensor state');
}

function saveSafetyValue(name, value) {
    settings.currentSettings[name] = value;
    settings.saveUserSettings();
}

function sendBsmSystemState(ws) {
    const statusMsg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'BSMSystem_Status',
        params: { payload: { evData: normalizeBsmSystem(settings.currentSettings.bsmSystem) } }
    });
    ws.send(statusMsg);
    logger.debug('vehsettings', 'Sent BSM system state');

    const volumeMsg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'GetBSMBuzzerVolume',
        params: { payload: { evData: settings.currentSettings.bsmBuzzerVolume } }
    });
    ws.send(volumeMsg);
    logger.debug('vehsettings', 'Sent BSM volume state');
}

function getSafetyResetDefaults() {
    const j36IpmScbs = isJ36IpmScbsProfile();
    return {
        drssMode: 'DRSS_Off',
        drssDistance: 'DRSS_Distance_Short',
        sbsMode: 'SBS_Off',
        sbsDistance: j36IpmScbs ? 'SCBSDistance_Middle' : 'SBS_Distance_Short',
        sbsBuzzerVolume: j36IpmScbs ? 'SBS_Vol_Big' : 'SBS_Vol_No_Alarm',
        scbsMode: j36IpmScbs ? 'SCBS_On' : 'SCBS_Off',
        fowMode: 'FOW_Off',
        fowDistance: 'FOW_Distance_Short',
        fowBuzzerVolume: 'FOW_Vol_No_Alarm'
    };
}

function handleGoSBS(ws) {
    sendContextChange(ws, 'vehsettings', 'SBS');
}

function handleGoSBS_SCBS(ws) {
    sendContextChange(ws, 'vehsettings', 'SBS_SCBS');
}

function handleGoSBS_SCBS_J36IPM(ws) {
    sendContextChange(ws, 'vehsettings', 'SBS_SCBS_J36IPM');
    sendSafetyState(ws);
}

function handleGoFOW(ws) {
    sendContextChange(ws, 'vehsettings', 'FOW');
}

function handleOpenSafetyContext(ws, contextId) {
    sendContextChange(ws, 'vehsettings', contextId);
    sendSafetyState(ws);
}

function handleSelectSpeedLimitInfo(ws) {
    const contextId = settings.HARDWARE_CONFIG.hudType === 'WHUD_color' ? 'SLI_WHUD' : 'SLI';
    handleOpenSafetyContext(ws, contextId);
}

function handleGoDRSSReset(ws) {
    dialogState.drssResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'DRSSReset');
}

function handleDrssResetNo(ws) {
    dialogState.drssResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleDrssResetYes(ws) {
    dialogState.drssResetConfirmActive = false;
    const defaults = getSafetyResetDefaults();
    settings.currentSettings.drssMode = defaults.drssMode;
    settings.currentSettings.drssDistance = defaults.drssDistance;
    settings.saveUserSettings();
    sendSafetyState(ws);
    returnToPreviousContext(ws);
}

function handleGoSbsReset(ws) {
    dialogState.sbsResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'SBSReset');
}

function handleGoSbsJ36IpmReset(ws) {
    dialogState.sbsJ36IpmResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'SBS_SCBSReset_J36IPM', undefined, undefined, true);
}

function handleSbsJ36IpmResetNo(ws) {
    dialogState.sbsJ36IpmResetConfirmActive = false;
    sendContextChange(ws, 'vehsettings', 'SBS_SCBS_J36IPM', undefined, undefined, true);
    sendSafetyState(ws);
}

function handleSbsJ36IpmResetYes(ws) {
    dialogState.sbsJ36IpmResetConfirmActive = false;
    dialogState.sbsJ36IpmResetProgressActive = true;
    sendContextChange(
        ws,
        'vehsettings',
        'SBS_SCBSResetProgress_J36IPM',
        undefined,
        undefined,
        true
    );

    setTimeout(function () {
        const defaults = getSafetyResetDefaults();
        settings.currentSettings.sbsMode = defaults.sbsMode;
        settings.currentSettings.sbsDistance = defaults.sbsDistance;
        settings.currentSettings.sbsBuzzerVolume = defaults.sbsBuzzerVolume;
        settings.currentSettings.scbsMode = defaults.scbsMode;
        settings.saveUserSettings();
        sendSafetyState(ws);
        dialogState.sbsJ36IpmResetProgressActive = false;
        if (
            navigationState.goBackStack.length > 0 &&
            navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                'SBS_SCBS_J36IPM'
        ) {
            navigationState.goBackStack.pop();
        }
        sendContextChange(ws, 'vehsettings', 'SafetyTab', undefined, undefined, true);
    }, 800);
}

function handleSbsResetNo(ws) {
    dialogState.sbsResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleSbsResetYes(ws) {
    dialogState.sbsResetConfirmActive = false;
    const defaults = getSafetyResetDefaults();
    settings.currentSettings.sbsMode = defaults.sbsMode;
    settings.currentSettings.sbsDistance = defaults.sbsDistance;
    settings.currentSettings.sbsBuzzerVolume = defaults.sbsBuzzerVolume;
    settings.currentSettings.scbsMode = defaults.scbsMode;
    settings.saveUserSettings();
    sendSafetyState(ws);
    returnToPreviousContext(ws);
}

function handleGoFowReset(ws) {
    dialogState.fowResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'FOWReset');
}

function handleFowResetNo(ws) {
    dialogState.fowResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleFowResetYes(ws) {
    dialogState.fowResetConfirmActive = false;
    const defaults = getSafetyResetDefaults();
    settings.currentSettings.fowMode = defaults.fowMode;
    settings.currentSettings.fowDistance = defaults.fowDistance;
    settings.currentSettings.fowBuzzerVolume = defaults.fowBuzzerVolume;
    settings.saveUserSettings();
    sendSafetyState(ws);
    returnToPreviousContext(ws);
}

function handleGoLdwsReset(ws) {
    dialogState.ldwsResetConfirmActive = true;
    handleOpenSafetyContext(ws, 'LDWSReset');
}

function handleLdwsResetNo(ws) {
    dialogState.ldwsResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleLdwsResetYes(ws) {
    dialogState.ldwsResetConfirmActive = false;
    settings.currentSettings.ldwsTiming = 'LDWS_Timing_Online';
    settings.currentSettings.ldwsWarning = 'LDWS_Warning_Rare';
    settings.currentSettings.ldwsSound = 'LDWS_Sound_Buzzer';
    settings.currentSettings.ldwsSoundVolume = 'LDWS_Vol_High';
    settings.saveUserSettings();
    sendSafetyState(ws);
    returnToPreviousContext(ws);
}

function handleGoLasReset(ws) {
    dialogState.lasResetConfirmActive = true;
    handleOpenSafetyContext(ws, 'LASReset');
}

function handleLasResetNo(ws) {
    dialogState.lasResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleLasResetYes(ws) {
    dialogState.lasResetConfirmActive = false;
    dialogState.lasResetProgressActive = true;
    sendContextChange(ws, 'vehsettings', 'LASResetProgress', undefined, undefined, true);

    setTimeout(function () {
        settings.currentSettings.lasIntervention = 'LAS_Intervention_On';
        settings.currentSettings.ldwsTiming = 'LDWS_Timing_Online';
        settings.currentSettings.ldwsWarning = 'LDWS_Warning_Ofen';
        settings.currentSettings.lasAlert = 'LAS_Alert_On';
        settings.currentSettings.ldwsSound = 'LDWS_Sound_Vibration';
        settings.currentSettings.ldwsSoundVolume = 'LDWS_Vol_Low';
        settings.saveUserSettings();
        sendSafetyState(ws);
        dialogState.lasResetProgressActive = false;

        while (navigationState.goBackStack.length > 0) {
            const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
            if (context.uiaId !== 'vehsettings' || context.ctxtId === 'SafetyTab') {
                break;
            }
            navigationState.goBackStack.pop();
        }
        sendContextChange(ws, 'vehsettings', 'SafetyTab', undefined, undefined, true);
    }, 800);
}

function handleGoSliReset(ws) {
    dialogState.sliResetConfirmActive = true;
    handleOpenSafetyContext(ws, 'SLIReset');
}

function handleSliResetNo(ws) {
    dialogState.sliResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleSliResetYes(ws) {
    dialogState.sliResetConfirmActive = false;
    dialogState.sliResetProgressActive = true;
    sendContextChange(ws, 'vehsettings', 'SLIResetProgress', undefined, undefined, true);

    setTimeout(function () {
        settings.currentSettings.speedLimitCaution = 'SLC_Off';
        settings.currentSettings.cautionSpeed = 'SLCS_0';
        settings.currentSettings.speedLimitHud = 'SLS_HUD_On';
        settings.currentSettings.speedLimitCenter = 'SLS_Center_On';
        settings.saveUserSettings();
        sendSafetyState(ws);
        dialogState.sliResetProgressActive = false;
        returnToPreviousContext(ws);
    }, 800);
}

function getHudResetDefaults() {
    return {
        hudHeight: 0,
        hudBrightnessControl: 1,
        hudBrightness: 0,
        hudCalibration: 0,
        hudRotation: 0,
        hudNavigation: 2,
        hudDisplay: 1,
        hudStreetInformation: 'Street_Always',
        hudNavigationScreen: 'Navigation_Maneuver'
    };
}

function handleGoHudReset(ws) {
    dialogState.hudResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'HUDReset');
}

function handleHudResetNo(ws) {
    dialogState.hudResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleHudResetYes(ws) {
    dialogState.hudResetConfirmActive = false;
    dialogState.hudResetProgressActive = true;
    sendContextChange(ws, 'vehsettings', 'HUDProgress', undefined, undefined, true);

    const defaults = getHudResetDefaults();
    Object.keys(defaults).forEach(function (name) {
        settings.currentSettings[name] = defaults[name];
    });
    settings.saveUserSettings();
    sendHudState(ws);

    dialogState.hudResetProgressActive = false;
    returnToPreviousContext(ws);
}

function handleDisplayInfoReset(ws) {
    dialogState.hudDisplayInfoResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'HUDDisplayInfoReset');
}

function handleDisplayInfoResetNo(ws) {
    dialogState.hudDisplayInfoResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleDisplayInfoResetYes(ws) {
    dialogState.hudDisplayInfoResetConfirmActive = false;
    settings.currentSettings.hudNavigation = 2;
    settings.currentSettings.hudStreetInformation = 'Street_Always';
    settings.currentSettings.hudNavigationScreen = 'Navigation_Maneuver';
    settings.saveUserSettings();
    sendHudState(ws);
    returnToPreviousContext(ws);
}

function returnToPreviousContext(ws) {
    const stack = navigationState.goBackStack;
    if (
        stack.length > 0 &&
        (stack[stack.length - 1].ctxtId === 'HUDReset' ||
            stack[stack.length - 1].ctxtId === 'HUDDisplayInfoReset' ||
            stack[stack.length - 1].ctxtId === 'DoorLockReset' ||
            stack[stack.length - 1].ctxtId === 'TurnReset' ||
            stack[stack.length - 1].ctxtId === 'DRSSReset' ||
            stack[stack.length - 1].ctxtId === 'SBSReset' ||
            stack[stack.length - 1].ctxtId === 'SBS_SCBSReset_J36IPM' ||
            stack[stack.length - 1].ctxtId === 'FOWReset' ||
            stack[stack.length - 1].ctxtId === 'LDWSReset' ||
            stack[stack.length - 1].ctxtId === 'LASReset' ||
            stack[stack.length - 1].ctxtId === 'SLIReset')
    ) {
        stack.pop();
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
    }
}

function handleHudEvent(ws, eventId, params) {
    const value = params && params.payload && params.payload.evData;
    switch (eventId) {
        case 'SetHudHeight':
            saveHudValue('hudHeight', value);
            break;
        case 'SetHudBrightnessControl':
            saveHudValue('hudBrightnessControl', value);
            break;
        case 'SetHudBrightness':
            saveHudValue('hudBrightness', value);
            break;
        case 'SetHudCalibration':
            saveHudValue('hudCalibration', value);
            break;
        case 'SetHUDRotation':
            saveHudValue(
                'hudRotation',
                {
                    Level_minus_3: -3,
                    Level_minus_2: -2,
                    Level_minus_1: -1,
                    Level_Default: 0,
                    Level_plus_1: 1,
                    Level_plus_2: 2,
                    Level_plus_3: 3
                }[value]
            );
            break;
        case 'SetHudNavigation':
            saveHudValue('hudNavigation', value);
            break;
        case 'SetHudOpenClose':
            saveHudValue('hudDisplay', value);
            break;
        case 'SelectDisplayInformation':
            sendContextChange(ws, 'vehsettings', 'HUDDisplayInformation');
            return true;
        case 'SelectDisplayInformationJ36':
            sendContextChange(ws, 'vehsettings', 'HUDDisplayInformationJ36');
            return true;
        case 'SelectHUDStreet':
            sendContextChange(ws, 'vehsettings', 'HUDStreetInformation');
            return true;
        case 'SelectHUDNavigationScreen':
            sendContextChange(ws, 'vehsettings', 'HUDNavigation');
            return true;
        case 'SetHUDStreet':
            saveHudValue('hudStreetInformation', value);
            return true;
        case 'SelectHUDNavigation':
            saveHudValue('hudNavigationScreen', value);
            return true;
        case 'SelectDisplayReset':
            handleDisplayInfoReset(ws);
            return true;
        case 'GoHUDReset':
            handleGoHudReset(ws);
            return true;
        default:
            return false;
    }
}

// Settings -> Vehicle -> Door Lock / Unlock Mode / Door Lock Mode.
function handleGoDoorLock(ws) {
    sendContextChange(ws, 'vehsettings', 'DoorLock');
}

function handleGoUnlockMode(ws) {
    sendContextChange(ws, 'vehsettings', 'UnlockMode');
}

function handleGoDoorLockMode(ws) {
    sendContextChange(ws, 'vehsettings', 'DoorLockMode');
}

// These events use bare Go* IDs rather than the generic Select fallback.
function handleGoKeylessLockBeepVol(ws) {
    sendContextChange(ws, 'vehsettings', 'KeylessLockBeepVol');
}

function handleGoDoorRelockTime(ws) {
    sendContextChange(ws, 'vehsettings', 'DoorRelockTime');
}

// The client caches these Get* values and does not request them on demand.
function sendDoorLockState(ws) {
    const values = settings.currentSettings;
    [
        ['GetAutoDoorLockAT6', values.doorLockAT6Mode],
        ['GetKeylessLockBeepVol', values.keylessLockBeepVol],
        ['GetAutoRelockTimer', values.doorRelockTimer],
        ['GetUnlockMode', values.unlockMode],
        ['GetWalkAwayLock', values.walkAwayLock],
        ['GetHandsFreeLiftgate', values.handsFreeLiftgate]
    ].forEach(function (entry) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'vehsettings',
            msgId: entry[0],
            params: { payload: { evData: entry[1] } }
        });
        ws.send(msg);
        logger.debug('vehsettings', 'Sent door lock state');
    });
}

// Hardware reports speed alarm as one signal: 1 is off, 2..51 are thresholds.
function sendSpeedAlarmState(ws) {
    const values = settings.currentSettings;
    const evData = values.speedAlarmOnOff === 'SpeedAlarm_On' ? values.speedAlarmValue : 1;
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'vehsettings',
        msgId: 'GetSpeedAlarm',
        params: { payload: { evData: evData } }
    });
    ws.send(msg);
    logger.debug('vehsettings', 'Sent speed alarm state');
}

function saveVehicleSettingValue(name, value) {
    settings.currentSettings[name] = value;
    settings.saveUserSettings();
}

// Re-send Get* values after each update so the GUI refreshes immediately.
function handleVehicleSettingsEvent(ws, eventId, params) {
    const value = params && params.payload && params.payload.evData;
    switch (eventId) {
        case 'SetAutoDoorLockAT6':
            saveVehicleSettingValue('doorLockAT6Mode', value);
            sendDoorLockState(ws);
            return true;
        case 'SetKeylessLockBeepVol':
            saveVehicleSettingValue('keylessLockBeepVol', value);
            sendDoorLockState(ws);
            return true;
        case 'SetAutoRelockTimer':
            saveVehicleSettingValue('doorRelockTimer', value);
            sendDoorLockState(ws);
            return true;
        case 'SetUnlockMode':
            saveVehicleSettingValue('unlockMode', value);
            sendDoorLockState(ws);
            return true;
        case 'SetWalkAwayLock':
            saveVehicleSettingValue('walkAwayLock', value);
            sendDoorLockState(ws);
            return true;
        case 'SetHandsFreeLiftgate':
            saveVehicleSettingValue('handsFreeLiftgate', value);
            sendDoorLockState(ws);
            return true;
        case 'SetSpeedAlarmOnOff':
            saveVehicleSettingValue('speedAlarmOnOff', value);
            sendSpeedAlarmState(ws);
            return true;
        case 'SetSpeedAlarm':
            saveVehicleSettingValue('speedAlarmValue', value);
            sendSpeedAlarmState(ws);
            return true;
        default:
            return false;
    }
}

function handleSafetySettingsEvent(ws, eventId, params) {
    let value = params && params.payload && params.payload.evData;
    switch (eventId) {
        case 'SetDRSS':
            saveSafetyValue('drssMode', value);
            sendSafetyState(ws);
            return true;
        case 'SetDRSSDistance':
            saveSafetyValue('drssDistance', value);
            sendSafetyState(ws);
            return true;
        case 'SetSBS':
            saveSafetyValue('sbsMode', value);
            sendSafetyState(ws);
            return true;
        case 'SetSBSDistance':
            saveSafetyValue('sbsDistance', value);
            sendSafetyState(ws);
            return true;
        case 'SetSBSBuzzerVolume':
            saveSafetyValue('sbsBuzzerVolume', value);
            sendSafetyState(ws);
            return true;
        case 'SetSCBS':
        case 'SetSCBSMode_J36IPM':
            if (
                value !== 'SCBS_On' &&
                value !== 'SCBS_Off' &&
                value !== 'SBS_On' &&
                value !== 'SBS_Off'
            ) {
                value =
                    normalizeScbsMode(settings.currentSettings.scbsMode) === 'SCBS_On'
                        ? 'SCBS_Off'
                        : 'SCBS_On';
            }
            saveSafetyValue('scbsMode', normalizeScbsMode(value));
            sendSafetyState(ws);
            return true;
        case 'SetSCBSDistance_J36IPM':
            saveSafetyValue('sbsDistance', normalizeJ36IpmScbsDistance(value));
            sendSafetyState(ws);
            return true;
        case 'SetFOW':
            saveSafetyValue('fowMode', value);
            sendSafetyState(ws);
            return true;
        case 'SetFOWDistance':
            saveSafetyValue('fowDistance', value);
            sendSafetyState(ws);
            return true;
        case 'SetFOWBuzzerVolume':
            saveSafetyValue('fowBuzzerVolume', value);
            sendSafetyState(ws);
            return true;
        case 'SetRainSensingWiper':
            saveSafetyValue('autoWiper', value);
            sendSafetyState(ws);
            return true;
        case 'SetBSMSystem':
            if (value !== 'BSM_On' && value !== 'BSM_Off') {
                value =
                    normalizeBsmSystem(settings.currentSettings.bsmSystem) === 'BSM_On'
                        ? 'BSM_Off'
                        : 'BSM_On';
            }
            saveSafetyValue('bsmSystem', normalizeBsmSystem(value));
            sendBsmSystemState(ws);
            return true;
        case 'SetBSMBuzzerVolume':
        case 'SetBSMVolume':
            saveSafetyValue('bsmBuzzerVolume', value);
            sendBsmSystemState(ws);
            return true;
        case 'SetLDWSTiming':
            saveSafetyValue('ldwsTiming', value);
            sendSafetyState(ws);
            return true;
        case 'SetLDWSWarning':
            saveSafetyValue('ldwsWarning', value);
            sendSafetyState(ws);
            return true;
        case 'SetLASSound':
        case 'SetBuzzerSetting':
            saveSafetyValue('ldwsSound', value);
            sendSafetyState(ws);
            return true;
        case 'SetLDWSBuzzerVolume':
        case 'SetLDWSRumbleVolume':
        case 'SetLASSoundVol':
            saveSafetyValue('ldwsSoundVolume', value);
            sendSafetyState(ws);
            return true;
        case 'SetLASIntervention':
            settings.currentSettings.lasIntervention = value;
            if (value === 'LAS_Intervention_Off') {
                settings.currentSettings.ldwsTiming = 'LDWS_Timing_Online';
                settings.currentSettings.ldwsWarning = 'LDWS_Warning_Med';
            } else if (value === 'LAS_Intervention_On') {
                settings.currentSettings.ldwsTiming = 'LDWS_Timing_Online';
                settings.currentSettings.ldwsWarning = 'LDWS_Warning_Ofen';
            }
            settings.saveUserSettings();
            sendSafetyState(ws);
            return true;
        case 'SetLASAlert':
            saveSafetyValue('lasAlert', value);
            sendSafetyState(ws);
            return true;
        case 'SetMRCCDistanceControl':
            saveSafetyValue('mrccDistanceControl', value);
            sendSafetyState(ws);
            return true;
        case 'SetDA':
            saveSafetyValue('driverAttentionAlert', value);
            sendSafetyState(ws);
            return true;
        case 'SetParkingSensor':
            saveSafetyValue(
                'parkingSensor',
                params && params.payload && params.payload.parkingSensorSetting
            );
            sendSafetyState(ws);
            return true;
        case 'SetSLC':
            saveSafetyValue('speedLimitCaution', value);
            sendSafetyState(ws);
            return true;
        case 'SetCautionSpeed':
            saveSafetyValue('cautionSpeed', value);
            sendSafetyState(ws);
            return true;
        case 'SetSLS_HUD':
        case 'SetSLS_WHUD':
            saveSafetyValue('speedLimitHud', value);
            sendSafetyState(ws);
            return true;
        case 'SetSLS_Center':
            saveSafetyValue('speedLimitCenter', value);
            sendSafetyState(ws);
            return true;
        case 'SetTVMAutoViewStart':
            saveSafetyValue('tvmAutoViewStart', value);
            sendSafetyState(ws);
            return true;
        case 'SetTVMVehiclePathLine':
            saveSafetyValue('tvmVehiclePathLine', value);
            sendSafetyState(ws);
            return true;
        case 'SetTVMFrontViewDisplay':
            saveSafetyValue('tvmFrontViewDisplay', value);
            sendSafetyState(ws);
            return true;
        default:
            return false;
    }
}

// Settings -> Vehicle -> Door Lock -> Reset. Same Yes/No + progress-spinner pattern as
// handleGoHudReset()/handleHudResetYes()/handleHudResetNo() above - see those for the
// full explanation of why dialogState is needed here (dispatcher.js's generic
// "Global.Yes"/"Global.No" events carry no indication of which dialog sent them).
function handleGoDoorLockReset(ws) {
    dialogState.doorLockResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'DoorLockReset');
}

function handleDoorLockResetNo(ws) {
    dialogState.doorLockResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleDoorLockResetYes(ws) {
    dialogState.doorLockResetConfirmActive = false;
    dialogState.doorLockResetProgressActive = true;
    sendContextChange(ws, 'vehsettings', 'DoorLockResetProgress', undefined, undefined, true);

    settings.currentSettings.doorLockAT6Mode = 'AT6_Off';
    settings.currentSettings.keylessLockBeepVol = 'KBV_Middle';
    settings.currentSettings.doorRelockTimer = 'Door_Relock_60_Sec';
    settings.currentSettings.unlockMode = 'Unlock_DriverSeat';
    settings.currentSettings.walkAwayLock = 'WalkAwayLock_Off';
    settings.currentSettings.handsFreeLiftgate = 'HandsFreeLiftgate_Off';
    settings.saveUserSettings();
    sendDoorLockState(ws);

    dialogState.doorLockResetProgressActive = false;
    returnToPreviousContext(ws);
}

// Turn settings also use the bare GoTurnSettings event.
function handleGoTurnSettings(ws) {
    sendContextChange(ws, 'vehsettings', 'TurnSettings');
}

// The client caches these Get* values.
function sendTurnSettingsState(ws) {
    const values = settings.currentSettings;
    [
        ['Get3FlashTurnSignal', values.threeFlashTurnSignal],
        ['GetTurnSignalIndicatorVolume', values.turnSignalIndicatorVolume]
    ].forEach(function (entry) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'vehsettings',
            msgId: entry[0],
            params: { payload: { evData: entry[1] } }
        });
        ws.send(msg);
        logger.debug('vehsettings', 'Sent turn settings state');
    });
}

function handleTurnSettingsEvent(ws, eventId, params) {
    const value = params && params.payload && params.payload.evData;
    switch (eventId) {
        case 'Set3FlashTurnSignal':
            saveVehicleSettingValue('threeFlashTurnSignal', value);
            sendTurnSettingsState(ws);
            return true;
        case 'SetTurnSignalIndicatorVolume':
            saveVehicleSettingValue('turnSignalIndicatorVolume', value);
            sendTurnSettingsState(ws);
            return true;
        default:
            return false;
    }
}

function handleGoTurnReset(ws) {
    dialogState.turnResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'TurnReset');
}

function handleTurnResetNo(ws) {
    dialogState.turnResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleTurnResetYes(ws) {
    dialogState.turnResetConfirmActive = false;
    dialogState.turnResetProgressActive = true;
    sendContextChange(ws, 'vehsettings', 'TurnProgress', undefined, undefined, true);

    settings.currentSettings.threeFlashTurnSignal = 'Three_Flash_Off';
    settings.currentSettings.turnSignalIndicatorVolume = 'Turn_Volume_Small';
    settings.saveUserSettings();
    sendTurnSettingsState(ws);

    dialogState.turnResetProgressActive = false;
    returnToPreviousContext(ws);
}

function sendLightingState(ws) {
    const values = settings.currentSettings;
    [
        ['GetILB', values.lightingInteriorBrightness],
        ['GetInteriorLightTimeoutDoorOpen', values.lightingInteriorTimeoutDoorOpen],
        ['GetInteriorLightTimeoutDoorClosed', values.lightingInteriorTimeoutDoorClosed],
        ['GetHBC', values.lightingHighBeamControl],
        ['GetAFS', values.lightingAfs],
        ['GetHeadlightOnWarning', values.lightingHeadlightOnWarning],
        ['GetHeadlightOffTimer', values.lightingHeadlightOffTimer],
        ['GetCHLT', values.lightingComingHome],
        ['GetLHL', values.lightingLeavingHome],
        ['GetDRL', values.lightingDaytimeRunningLights],
        ['GetAutoHeadlightSensitivity', values.lightingAutoHeadlightSensitivity]
    ].forEach(function (entry) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'vehsettings',
            msgId: entry[0],
            params: { payload: { evData: entry[1] } }
        });
        ws.send(msg);
        logger.debug('vehsettings', 'Sent lighting state');
    });
}

function handleGoLighting(ws) {
    sendContextChange(ws, 'vehsettings', 'Lighting');
}

function handleOpenLightingContext(ws, contextId) {
    sendContextChange(ws, 'vehsettings', contextId);
}

function handleLightingSettingsEvent(ws, eventId, params) {
    const value = params && params.payload && params.payload.evData;
    switch (eventId) {
        case 'SetHBC':
            saveVehicleSettingValue('lightingHighBeamControl', value);
            sendLightingState(ws);
            return true;
        case 'SetAFS':
            saveVehicleSettingValue('lightingAfs', value);
            sendLightingState(ws);
            return true;
        case 'SetHeadlightOnWarning':
            saveVehicleSettingValue('lightingHeadlightOnWarning', value);
            sendLightingState(ws);
            return true;
        case 'SetHeadlightOffTimer':
            saveVehicleSettingValue('lightingHeadlightOffTimer', value);
            sendLightingState(ws);
            return true;
        case 'SetCHLT':
            saveVehicleSettingValue('lightingComingHome', value);
            sendLightingState(ws);
            return true;
        case 'SetLHL':
            saveVehicleSettingValue('lightingLeavingHome', value);
            sendLightingState(ws);
            return true;
        case 'SetDaytimeRunningLights':
            saveVehicleSettingValue('lightingDaytimeRunningLights', value);
            sendLightingState(ws);
            return true;
        case 'SetAutoHeadlightSensitivity':
            saveVehicleSettingValue('lightingAutoHeadlightSensitivity', value);
            sendLightingState(ws);
            return true;
        case 'SetInteriorLightTimeoutDoorOpen':
            saveVehicleSettingValue('lightingInteriorTimeoutDoorOpen', value);
            sendLightingState(ws);
            return true;
        case 'SetInteriorLightTimeoutDoorClosed':
            saveVehicleSettingValue('lightingInteriorTimeoutDoorClosed', value);
            sendLightingState(ws);
            return true;
        case 'SetILB':
            saveVehicleSettingValue('lightingInteriorBrightness', value);
            sendLightingState(ws);
            return true;
        default:
            return false;
    }
}

function handleGoLightingReset(ws) {
    dialogState.lightingResetConfirmActive = true;
    sendContextChange(ws, 'vehsettings', 'LightingReset');
}

function handleLightingResetNo(ws) {
    dialogState.lightingResetConfirmActive = false;
    returnToPreviousContext(ws);
}

function handleLightingResetYes(ws) {
    dialogState.lightingResetConfirmActive = false;
    dialogState.lightingResetProgressActive = true;
    sendContextChange(ws, 'vehsettings', 'LightingResetProgress', undefined, undefined, true);

    settings.currentSettings.lightingInteriorBrightness = 'ILB_Medium';
    settings.currentSettings.lightingInteriorTimeoutDoorOpen = 'ILTDO_10_Min';
    settings.currentSettings.lightingInteriorTimeoutDoorClosed = 'ILTDC_7_5_Sec';
    settings.currentSettings.lightingHighBeamControl = 'HBC_Off';
    settings.currentSettings.lightingAfs = 'AFS_Off';
    settings.currentSettings.lightingHeadlightOnWarning = 'HOW_Off';
    settings.currentSettings.lightingHeadlightOffTimer = 'HOT_OFF';
    settings.currentSettings.lightingComingHome = 'CHL_OFF';
    settings.currentSettings.lightingLeavingHome = 'LHL_Off';
    settings.currentSettings.lightingDaytimeRunningLights = 'DRL_Off';
    settings.currentSettings.lightingAutoHeadlightSensitivity = 'AHS_Standard';
    settings.saveUserSettings();
    sendLightingState(ws);

    dialogState.lightingResetProgressActive = false;
    returnToPreviousContext(ws);
}

module.exports = {
    sendVehicleFeatureInstalled: sendVehicleFeatureInstalled,
    sendVehicleCapabilityState: sendVehicleCapabilityState,
    sendHudType: sendHudType,
    sendNavigationAvailability: sendNavigationAvailability,
    sendIgnitionOn: sendIgnitionOn,
    sendHudState: sendHudState,
    sendSafetyState: sendSafetyState,
    handleSafetySettingsEvent: handleSafetySettingsEvent,
    handleGoSBS: handleGoSBS,
    handleGoSBS_SCBS: handleGoSBS_SCBS,
    handleGoSBS_SCBS_J36IPM: handleGoSBS_SCBS_J36IPM,
    handleGoFOW: handleGoFOW,
    handleOpenSafetyContext: handleOpenSafetyContext,
    handleSelectSpeedLimitInfo: handleSelectSpeedLimitInfo,
    handleGoDRSSReset: handleGoDRSSReset,
    handleDrssResetNo: handleDrssResetNo,
    handleDrssResetYes: handleDrssResetYes,
    handleGoSbsReset: handleGoSbsReset,
    handleGoSbsJ36IpmReset: handleGoSbsJ36IpmReset,
    handleSbsJ36IpmResetNo: handleSbsJ36IpmResetNo,
    handleSbsJ36IpmResetYes: handleSbsJ36IpmResetYes,
    handleSbsResetNo: handleSbsResetNo,
    handleSbsResetYes: handleSbsResetYes,
    handleGoFowReset: handleGoFowReset,
    handleFowResetNo: handleFowResetNo,
    handleFowResetYes: handleFowResetYes,
    handleGoLdwsReset: handleGoLdwsReset,
    handleLdwsResetNo: handleLdwsResetNo,
    handleLdwsResetYes: handleLdwsResetYes,
    handleGoLasReset: handleGoLasReset,
    handleLasResetNo: handleLasResetNo,
    handleLasResetYes: handleLasResetYes,
    handleGoSliReset: handleGoSliReset,
    handleSliResetNo: handleSliResetNo,
    handleSliResetYes: handleSliResetYes,
    handleHudEvent: handleHudEvent,
    handleGoHudReset: handleGoHudReset,
    handleHudResetNo: handleHudResetNo,
    handleHudResetYes: handleHudResetYes,
    handleDisplayInfoReset: handleDisplayInfoReset,
    handleDisplayInfoResetNo: handleDisplayInfoResetNo,
    handleDisplayInfoResetYes: handleDisplayInfoResetYes,
    handleGoDoorLock: handleGoDoorLock,
    handleGoUnlockMode: handleGoUnlockMode,
    handleGoDoorLockMode: handleGoDoorLockMode,
    handleGoKeylessLockBeepVol: handleGoKeylessLockBeepVol,
    handleGoDoorRelockTime: handleGoDoorRelockTime,
    sendDoorLockState: sendDoorLockState,
    sendSpeedAlarmState: sendSpeedAlarmState,
    handleVehicleSettingsEvent: handleVehicleSettingsEvent,
    handleGoDoorLockReset: handleGoDoorLockReset,
    handleDoorLockResetNo: handleDoorLockResetNo,
    handleDoorLockResetYes: handleDoorLockResetYes,
    handleGoTurnSettings: handleGoTurnSettings,
    sendTurnSettingsState: sendTurnSettingsState,
    handleTurnSettingsEvent: handleTurnSettingsEvent,
    handleGoTurnReset: handleGoTurnReset,
    handleTurnResetNo: handleTurnResetNo,
    handleTurnResetYes: handleTurnResetYes,
    sendLightingState: sendLightingState,
    handleGoLighting: handleGoLighting,
    handleOpenLightingContext: handleOpenLightingContext,
    handleLightingSettingsEvent: handleLightingSettingsEvent,
    handleGoLightingReset: handleGoLightingReset,
    handleLightingResetNo: handleLightingResetNo,
    handleLightingResetYes: handleLightingResetYes
};
