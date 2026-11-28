const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const settings = require('../services/settings');
const navigationState = require('../state/navigationState');
const logger = require('../../logger');

const SEEDED_WIFI_NETWORKS = [
    {
        id: 1,
        name: 'Home-WiFi',
        bssid: '00:11:22:33:44:01',
        signalStrength: 4,
        securityType: 8,
        connectionState: 1,
        stateFlags: 1,
        remembered: true
    },
    {
        id: 2,
        name: 'Garage-Guest',
        bssid: '00:11:22:33:44:02',
        signalStrength: 3,
        securityType: 12,
        connectionState: 0,
        stateFlags: 1,
        remembered: true
    },
    {
        id: 3,
        name: 'Cafe_Hotspot',
        bssid: '00:11:22:33:44:03',
        signalStrength: 2,
        securityType: 0,
        connectionState: 0,
        stateFlags: 0,
        remembered: false
    },
    {
        id: 4,
        name: 'Office-Net',
        bssid: '00:11:22:33:44:04',
        signalStrength: 1,
        securityType: 8,
        connectionState: 0,
        stateFlags: 0,
        remembered: false
    }
];

let hiddenNetworkInfo = {
    networkName: '',
    securityType: 0
};

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
    const wifiEnabled = settings.currentSettings.wifiMode === 1;
    const hasNetworks = wifiEnabled && settings.HARDWARE_CONFIG.wifiNetworks === 'On';
    const scanned = hasNetworks ? SEEDED_WIFI_NETWORKS : [];
    const remembered = hasNetworks ? SEEDED_WIFI_NETWORKS.filter((n) => n.remembered) : [];
    const connected = scanned.find((n) => n.connectionState === 1);

    sendMsg(ws, 'WifiMode', { mode: settings.currentSettings.wifiMode });
    sendMsg(ws, 'WifiStatus', {
        onOffState: wifiEnabled ? 1 : 0,
        connectedState: connected ? 1 : 0,
        transmissionState: 0,
        signalStrength: connected ? connected.signalStrength : 0
    });
    sendMsg(ws, 'ScannedNetworksList', { size: scanned.length, list: scanned });
    sendMsg(ws, 'RememberedNetworksList', { size: remembered.length, list: remembered });
}

function networkOptionsContext() {
    if (settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On') {
        return settings.currentSettings.wifiMode === 1
            ? 'NetworkOptionsStation'
            : 'NetworkOptionsOffAP';
    }
    return 'NetworkOptions';
}

function handleSelectNetworkManagement(ws) {
    sendWifiState(ws);
    sendContextChange(ws, 'netmgmt', networkOptionsContext());
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
        if (settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On') {
            sendContextChange(ws, 'netmgmt', networkOptionsContext(), undefined, undefined, true);
        }
    }
}

function handleSelectOtherNetwork(ws) {
    sendMsg(ws, 'HiddenNetworkInfo', hiddenNetworkInfo);
    sendContextChange(ws, 'netmgmt', 'OtherNetwork');
}

function handleSelectNameSSID(ws) {
    sendContextChange(ws, 'netmgmt', 'KeyboardInput', {
        payload: { isPassword: false, value: hiddenNetworkInfo.networkName }
    });
}

function handleSelectSecurity(ws) {
    sendContextChange(ws, 'netmgmt', 'SecurityOptions');
}

function handleSelectSecurityType(ws, params) {
    const securityType =
        params && params.payload && params.payload.securityType != null
            ? params.payload.securityType
            : 0;
    hiddenNetworkInfo = { ...hiddenNetworkInfo, securityType };
    sendMsg(ws, 'HiddenNetworkInfo', hiddenNetworkInfo);
    const stack = navigationState.goBackStack;
    if (
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'netmgmt' &&
        stack[stack.length - 1].ctxtId === 'SecurityOptions'
    ) {
        stack.pop();
    }
    const alreadyOther =
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'netmgmt' &&
        stack[stack.length - 1].ctxtId === 'OtherNetwork';
    sendContextChange(ws, 'netmgmt', 'OtherNetwork', undefined, undefined, alreadyOther);
}

function handleSelectKeyboardInput(ws) {
    sendContextChange(ws, 'netmgmt', 'KeyboardInput', {
        payload: { isPassword: false, value: '' }
    });
}

function handleSubmitKeyboardInput(ws, params) {
    const input = params && params.payload ? params.payload.input : '';
    logger.info('netmgmt', 'Keyboard input submitted: %s', input);
    const stack = navigationState.goBackStack;
    const fromOtherNetwork =
        stack.length >= 2 &&
        stack[stack.length - 1].uiaId === 'netmgmt' &&
        stack[stack.length - 1].ctxtId === 'KeyboardInput' &&
        stack[stack.length - 2].uiaId === 'netmgmt' &&
        stack[stack.length - 2].ctxtId === 'OtherNetwork';
    if (fromOtherNetwork) {
        hiddenNetworkInfo = { ...hiddenNetworkInfo, networkName: input || '' };
        sendMsg(ws, 'HiddenNetworkInfo', hiddenNetworkInfo);
        stack.pop();
        sendContextChange(ws, 'netmgmt', 'OtherNetwork', undefined, undefined, true);
        return;
    }
    sendContextChange(ws, 'netmgmt', 'NetworkOptions');
}

// Events of this application (see docs/NATIVE_MAP.md), dispatched by eventId.
const events = {
    SelectNetworkManagement: (ws) => handleSelectNetworkManagement(ws),
    SetWifiConnection: (ws, params) => handleSetWifiConnection(ws, params),
    SelectNetworkConnection: (ws) => handleSelectNetworkConnection(ws),
    SelectWifiMode: (ws, params) => handleSelectWifiMode(ws, params),
    SelectOtherNetwork: (ws) => handleSelectOtherNetwork(ws),
    SelectNameSSID: (ws) => handleSelectNameSSID(ws),
    SelectSecurity: (ws) => handleSelectSecurity(ws),
    SelectSecurityType: (ws, params) => handleSelectSecurityType(ws, params),
    SelectKeyboardInput: (ws) => handleSelectKeyboardInput(ws),
    SubmitKeyboardInput: (ws, params) => handleSubmitKeyboardInput(ws, params)
};

module.exports = {
    events: events,
    SEEDED_WIFI_NETWORKS: SEEDED_WIFI_NETWORKS,
    sendWifiState: sendWifiState,
    handleSelectNetworkManagement: handleSelectNetworkManagement,
    handleSetWifiConnection: handleSetWifiConnection,
    handleSelectNetworkConnection: handleSelectNetworkConnection,
    handleSelectWifiMode: handleSelectWifiMode,
    handleSelectOtherNetwork: handleSelectOtherNetwork,
    handleSelectNameSSID: handleSelectNameSSID,
    handleSelectSecurity: handleSelectSecurity,
    handleSelectSecurityType: handleSelectSecurityType,
    handleSelectKeyboardInput: handleSelectKeyboardInput,
    handleSubmitKeyboardInput: handleSubmitKeyboardInput,
    getHiddenNetworkInfo: () => hiddenNetworkInfo,
    resetHiddenNetworkInfo: () => {
        hiddenNetworkInfo = { networkName: '', securityType: 0 };
    }
};
