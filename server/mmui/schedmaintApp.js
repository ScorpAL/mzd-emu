const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('./navigationState');
const dialogState = require('./dialogState');
const settings = require('./settings');
const logger = require('../logger');

const SCHEDULE_RESET_DEFAULTS = {
    setting: 'On',
    time: 360,
    distance: 20000
};

const TIRE_RESET_DEFAULTS = {
    setting: 'On',
    distance: 10000
};

const OIL_RESET_DEFAULTS = {
    setting: 'On',
    distance: 10000
};

function sendMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'schedmaint',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('schedmaint', 'Sent message msgId=%s', msgId);
}

function sendMaintenanceState(ws) {
    const current = settings.currentSettings;

    sendMsg(ws, 'SchedMaintCMUModelType', {
        schedMaintCMUModelType: {
            ModelType: 'New',
            CMUModel: 1
        }
    });
    sendMsg(ws, 'MaintenanceListData', {
        MaintenanceList: {
            Disp_distance: true,
            Oil_setting_disp: 'Manual_Only',
            DistIncr_scale: 500,
            DistIncr_scale_mile: 250,
            TimeIncr_scale: 1,
            DistanceDue_KM: 0,
            DistanceDue_MILE: 0,
            TimeDue: 0,
            SchedMaintsetDistDefault: current.schedMaintDistance,
            SchedMntSetTimeDefault: current.schedMaintTime,
            TireRotationSetDistDefault: current.tireRotationDistance,
            OilSetDistDefault: current.oilMaintDistance,
            ScdMaintSetting: current.schedMaintSetting,
            TireRotationSetting: current.tireRotationSetting,
            OilChangeSetting: current.oilMaintSetting,
            Unit: 'KM'
        }
    });
    sendMsg(ws, 'SettingMessage', {
        settingmessage: {
            SMSetting: current.schedMaintSetting,
            TRSetting: current.tireRotationSetting,
            OilSetting: current.oilMaintSetting
        }
    });
    sendMsg(ws, 'SchedMaintSetting', { schedmaintsetting: current.schedMaintSetting });
    sendMsg(ws, 'TireRotationSetting', { tirerotationsetting: current.tireRotationSetting });
    sendMsg(ws, 'OilMaintSetting', { oilmaintsetting: current.oilMaintSetting });
    sendMsg(ws, 'SchedMaintDistRemaining', {
        schedmaintdistance: { Distance: current.schedMaintDistance, Unit: 'KM' }
    });
    sendMsg(ws, 'SchedMaintTimeRemaining', { schedmaintTime: current.schedMaintTime });
    sendMsg(ws, 'TireRotationDistRemaining', {
        tirerotationdistance: { Distance: current.tireRotationDistance, Unit: 'KM' }
    });
    sendMsg(ws, 'OilMaintenanceDistanceChange', {
        distance: { Distance: current.oilMaintDistance, Unit: 'KM' }
    });
    sendMsg(ws, 'OilLife', { oillife: { oillifeValue: 80, oillifeCountDown: null } });
    sendMsg(ws, 'SchedMaintDue', {
        schedmaintdue: {
            VWM_ScheduleMaintDue: 0,
            status: false,
            VWM_SchedMaintDue_J78: 0
        }
    });
}

function handleSelectSchedMaint(ws) {
    sendMaintenanceState(ws);
    sendContextChange(ws, 'schedmaint', 'MaintenanceList');
}

function handleSelectScheduledMaintenance(ws) {
    sendMaintenanceState(ws);
    sendContextChange(ws, 'schedmaint', 'ScheduledMaintenanceDetail');
}

function handleSelectTireRotation(ws) {
    sendMaintenanceState(ws);
    sendContextChange(ws, 'schedmaint', 'TireRotationDetail');
}

function handleSelectOilChange(ws) {
    sendMaintenanceState(ws);
    sendContextChange(ws, 'schedmaint', 'OilChangeDetail');
}

function handleSelectSettingInterval(ws, params) {
    const value = params && params.payload ? params.payload.settingValue : null;
    if (value === 'On' || value === 'Off') {
        handleSelectSettingIntervalValue(ws, params);
        return;
    }
    sendMaintenanceState(ws);
    sendContextChange(ws, 'schedmaint', 'SettingInterval');
}

function getTopContextId() {
    if (!navigationState.goBackStack.length) {
        return null;
    }
    return navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId;
}

function returnToPreviousContext(ws) {
    const topContextId = getTopContextId();
    if (
        navigationState.goBackStack.length > 1 &&
        (topContextId === 'ConfirmReset' || topContextId === 'ConfirmOff')
    ) {
        navigationState.goBackStack.pop();
    }
    const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
    if (context) {
        sendMaintenanceState(ws);
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

function handleSelectReset(ws) {
    const contextId = getTopContextId();
    if (
        contextId !== 'ScheduledMaintenanceDetail' &&
        contextId !== 'TireRotationDetail' &&
        contextId !== 'OilChangeDetail'
    ) {
        return;
    }
    dialogState.schedMaintResetConfirmActive = true;
    dialogState.schedMaintResetContext = contextId;
    sendContextChange(ws, 'schedmaint', 'ConfirmReset');
}

function handleSelectOff(ws, contextId) {
    dialogState.schedMaintOffConfirmActive = true;
    dialogState.schedMaintOffContext = contextId;
    sendContextChange(ws, 'schedmaint', 'ConfirmOff');
}

function handleOffNo(ws) {
    dialogState.schedMaintOffConfirmActive = false;
    dialogState.schedMaintOffContext = null;
    returnToPreviousContext(ws);
}

function handleOffYes(ws) {
    const contextId = dialogState.schedMaintOffContext;
    dialogState.schedMaintOffConfirmActive = false;
    dialogState.schedMaintOffContext = null;

    if (contextId === 'ScheduledMaintenanceDetail') {
        settings.currentSettings.schedMaintSetting = 'Off';
    } else if (contextId === 'TireRotationDetail') {
        settings.currentSettings.tireRotationSetting = 'Off';
    } else if (contextId === 'OilChangeDetail') {
        settings.currentSettings.oilMaintSetting = 'Off';
    }
    settings.saveUserSettings();
    returnToPreviousContext(ws);
}

function handleResetNo(ws) {
    dialogState.schedMaintResetConfirmActive = false;
    dialogState.schedMaintResetContext = null;
    returnToPreviousContext(ws);
}

function handleResetYes(ws) {
    const contextId = dialogState.schedMaintResetContext;
    dialogState.schedMaintResetConfirmActive = false;
    dialogState.schedMaintResetContext = null;

    if (contextId === 'ScheduledMaintenanceDetail') {
        settings.currentSettings.schedMaintSetting = SCHEDULE_RESET_DEFAULTS.setting;
        settings.currentSettings.schedMaintTime = SCHEDULE_RESET_DEFAULTS.time;
        settings.currentSettings.schedMaintDistance = SCHEDULE_RESET_DEFAULTS.distance;
    } else if (contextId === 'TireRotationDetail') {
        settings.currentSettings.tireRotationSetting = TIRE_RESET_DEFAULTS.setting;
        settings.currentSettings.tireRotationDistance = TIRE_RESET_DEFAULTS.distance;
    } else if (contextId === 'OilChangeDetail') {
        settings.currentSettings.oilMaintSetting = OIL_RESET_DEFAULTS.setting;
        settings.currentSettings.oilMaintDistance = OIL_RESET_DEFAULTS.distance;
    }
    settings.saveUserSettings();
    returnToPreviousContext(ws);
}

function handleSetSchedMaintOnOff(ws, params) {
    const value = params && params.payload ? params.payload.schedMaint : null;
    if (value === 'Off') {
        handleSelectOff(ws, 'ScheduledMaintenanceDetail');
    } else if (value === 'On') {
        settings.currentSettings.schedMaintSetting = value;
        settings.saveUserSettings();
        sendMaintenanceState(ws);
    }
}

function handleSetTireRotationOnOff(ws, params) {
    const value = params && params.payload ? params.payload.tireRotation : null;
    if (value === 'Off') {
        handleSelectOff(ws, 'TireRotationDetail');
    } else if (value === 'On') {
        settings.currentSettings.tireRotationSetting = value;
        settings.saveUserSettings();
        sendMaintenanceState(ws);
    }
}

function handleSelectSettingIntervalValue(ws, params) {
    const value = params && params.payload ? params.payload.settingValue : null;
    if (value === 'Off') {
        handleSelectOff(ws, 'OilChangeDetail');
    } else if (value === 'Fixed' || value === 'Flexible' || value === 'On') {
        settings.currentSettings.oilMaintSetting = value;
        settings.saveUserSettings();
        sendMaintenanceState(ws);
    }
}

function handleSetOilChange(ws, params) {
    const value = params && params.payload ? params.payload.oilChange : null;
    if (value === 'Off') {
        handleSelectOff(ws, 'OilChangeDetail');
    } else if (value === 'Fixed' || value === 'Flexible' || value === 'On') {
        settings.currentSettings.oilMaintSetting = value;
        settings.saveUserSettings();
        sendMaintenanceState(ws);
    }
}

function handleSetTimeValue(ws, params) {
    const value = params && params.payload ? Number(params.payload.TimeValue) : NaN;
    if (Number.isFinite(value) && value > 0) {
        settings.currentSettings.schedMaintTime = value < 30 ? value : value * 30;
        settings.saveUserSettings();
    }
    sendMaintenanceState(ws);
}

function handleSetDistanceValue(ws, params, currentContextId) {
    const value = params && params.payload ? Number(params.payload.DistanceValue) : NaN;
    let contextId = currentContextId;
    if (!contextId && navigationState.goBackStack.length) {
        contextId = navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId;
    }
    if (!Number.isFinite(value) || value < 0) {
        return;
    }

    if (contextId === 'ScheduledMaintenanceDetail') {
        settings.currentSettings.schedMaintDistance = value;
        settings.saveUserSettings();
        sendMsg(ws, 'SchedMaintDistRemaining', {
            schedmaintdistance: { Distance: value, Unit: 'KM' }
        });
    } else if (contextId === 'TireRotationDetail') {
        settings.currentSettings.tireRotationDistance = value;
        settings.saveUserSettings();
        sendMsg(ws, 'TireRotationDistRemaining', {
            tirerotationdistance: { Distance: value, Unit: 'KM' }
        });
    } else if (contextId === 'OilChangeDetail') {
        settings.currentSettings.oilMaintDistance = value;
        settings.saveUserSettings();
        sendMsg(ws, 'OilMaintenanceDistanceChange', {
            distance: { Distance: value, Unit: 'KM' }
        });
    }
}

module.exports = {
    sendMaintenanceState: sendMaintenanceState,
    handleSelectSchedMaint: handleSelectSchedMaint,
    handleSelectScheduledMaintenance: handleSelectScheduledMaintenance,
    handleSelectTireRotation: handleSelectTireRotation,
    handleSelectOilChange: handleSelectOilChange,
    handleSelectSettingInterval: handleSelectSettingInterval,
    handleSelectReset: handleSelectReset,
    handleResetNo: handleResetNo,
    handleResetYes: handleResetYes,
    handleOffNo: handleOffNo,
    handleOffYes: handleOffYes,
    handleSetSchedMaintOnOff: handleSetSchedMaintOnOff,
    handleSetTireRotationOnOff: handleSetTireRotationOnOff,
    handleSelectSettingIntervalValue: handleSelectSettingIntervalValue,
    handleSetOilChange: handleSetOilChange,
    handleSetTimeValue: handleSetTimeValue,
    handleSetDistanceValue: handleSetDistanceValue
};
