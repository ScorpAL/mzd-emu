const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const settings = require('./settings');
const logger = require('../logger');

function sendMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'netmgmt',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('netmgmt', 'Sent message msgId=%s', msgId);
}

function sendWifiState(ws) {
    sendMsg(ws, 'WifiMode', { mode: settings.currentSettings.wifiMode });
    sendMsg(ws, 'WifiStatus', {
        onOffState: settings.currentSettings.wifiMode === 1 ? 1 : 0,
        connectedState: 0,
        transmissionState: 0,
        signalStrength: 0
    });
    sendMsg(ws, 'ScannedNetworksList', { size: 0, list: [] });
    sendMsg(ws, 'RememberedNetworksList', { size: 0, list: [] });
}

function handleSelectNetworkManagement(ws) {
    sendWifiState(ws);
    if (settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On') {
        sendContextChange(ws, 'netmgmt', 'NetworkOptionsOffAP');
    } else {
        sendContextChange(ws, 'netmgmt', 'NetworkOptions');
    }
}

function handleSetWifiConnection(ws, params) {
    const offOn = params && params.payload ? params.payload.offOn : 0;
    settings.currentSettings.wifiMode = offOn === 1 ? 1 : 0;
    settings.saveUserSettings();
    sendWifiState(ws);
}

function handleSelectNetworkConnection(ws) {
    const ctxtId =
        settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On' ? 'Mode2' : 'Mode3';
    sendContextChange(ws, 'netmgmt', ctxtId);
}

function handleSelectWifiMode(ws, params) {
    if (params && params.payload && params.payload.wifiMode != null) {
        settings.currentSettings.wifiMode = params.payload.wifiMode;
        settings.saveUserSettings();
        sendWifiState(ws);
    }
}

module.exports = {
    sendWifiState: sendWifiState,
    handleSelectNetworkManagement: handleSelectNetworkManagement,
    handleSetWifiConnection: handleSetWifiConnection,
    handleSelectNetworkConnection: handleSelectNetworkConnection,
    handleSelectWifiMode: handleSelectWifiMode
};
