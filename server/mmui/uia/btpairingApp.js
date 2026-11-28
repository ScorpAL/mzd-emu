const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const settings = require('../services/settings');
const navigationState = require('../state/navigationState');
const logger = require('../../logger');

let pairCode = '0000';

function sendMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'btpairing',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('btpairing', 'Sent message msgId=%s', msgId);
}

function bluetoothStatusPayload(listItem) {
    return {
        pairedDeviceList: {
            status: settings.currentSettings.bluetooth === 'On' ? 1 : 0,
            listItem: listItem || []
        }
    };
}

function sendBluetoothState(ws) {
    sendMsg(ws, 'BTStatusAndList', bluetoothStatusPayload([]));
    sendMsg(ws, 'DeviceInfo', {
        DeviceInfoMsg: {
            deviceName: 'Mazda',
            deviceAddress: '00:00:00:00:00:00',
            pairCode: pairCode
        }
    });
    const cpConnected =
        (settings.HARDWARE_CONFIG.appleCarPlayAvailable === 'On' ||
            settings.HARDWARE_CONFIG.appleWirelessCarPlayAvailable === 'On') &&
        settings.HARDWARE_CONFIG.appleCarPlayConnection === 'On';
    const aaConnected =
        settings.HARDWARE_CONFIG.androidAutoAvailable === 'On' &&
        settings.HARDWARE_CONFIG.androidAutoConnection === 'On';
    sendMsg(ws, 'CarPlayConnectionStatus', { isCarPlayConnected: cpConnected ? 1 : 0 });
    sendMsg(ws, 'AndroidAutoConnectionStatus', { isAndroidAutoConnected: aaConnected });
}

function handleSelectBluetooth(ws) {
    sendBluetoothState(ws);
    sendContextChange(ws, 'btpairing', 'BTConnectionManager');
}

function handleSelectBluetoothSettings(ws) {
    sendBluetoothState(ws);
    sendContextChange(ws, 'btpairing', 'BluetoothSettings');
}

function handleToggleBluetooth(ws, enabled) {
    settings.currentSettings.bluetooth = enabled ? 'On' : 'Off';
    settings.saveUserSettings();
    sendBluetoothState(ws);
}

function handleAddNewDevice(ws) {
    sendBluetoothState(ws);
    sendContextChange(ws, 'btpairing', 'Discoverable');
}

function handleChangePairCode(ws) {
    sendContextChange(ws, 'btpairing', 'ChangePairCode');
}

function handleChangePairCodeYes(ws, params) {
    if (params && params.payload && params.payload.input) {
        pairCode = String(params.payload.input);
    }
    sendBluetoothState(ws);
    const stack = navigationState.goBackStack;
    if (
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'btpairing' &&
        stack[stack.length - 1].ctxtId === 'ChangePairCode'
    ) {
        stack.pop();
    }
    const alreadySettings =
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'btpairing' &&
        stack[stack.length - 1].ctxtId === 'BluetoothSettings';
    sendContextChange(ws, 'btpairing', 'BluetoothSettings', undefined, undefined, alreadySettings);
}

function handleCancel(ws) {
    const currentContext = navigationState.goBackStack[navigationState.goBackStack.length - 1];
    if (
        !currentContext ||
        currentContext.uiaId !== 'btpairing' ||
        currentContext.ctxtId !== 'Discoverable' ||
        navigationState.goBackStack.length < 2
    ) {
        return false;
    }

    navigationState.goBackStack.pop();
    const previousContext = navigationState.goBackStack[navigationState.goBackStack.length - 1];
    sendContextChange(
        ws,
        previousContext.uiaId,
        previousContext.ctxtId,
        previousContext.params,
        previousContext.contextSeq,
        true
    );
    logger.info('btpairing', 'Cancelled discoverable mode');
    return true;
}

// Report the emulator's mock phone to the status bar.
function sendPhoneConnectedStatus(ws) {
    const bluetoothOn = settings.currentSettings.bluetooth === 'On';
    // The mock phone is in the list while Bluetooth is On, but it is connected only when its own Bluetooth is "on"
    // (config/vehicle.json, phoneBluetoothConnection).
    const phoneConnected =
        bluetoothOn && settings.HARDWARE_CONFIG.phoneBluetoothConnection === 'On';
    ws.send(
        JSON.stringify({
            msgType: 'msg',
            uiaId: 'btpairing',
            msgId: 'BTStatusAndList',
            params: {
                payload: {
                    pairedDeviceList: {
                        status: bluetoothOn ? 1 : 0,
                        listItem: bluetoothOn
                            ? [
                                  {
                                      itemLabel: 'Mock Phone',
                                      status: phoneConnected ? 1 : 0,
                                      connect_disconnect_Success: phoneConnected ? 1 : 0
                                  }
                              ]
                            : []
                    }
                }
            }
        })
    );

    ws.send(
        JSON.stringify({
            msgType: 'msg',
            uiaId: 'btpairing',
            msgId: 'SignalStrengthStatus',
            params: { payload: { signalStrengthValue: bluetoothOn ? 4 : -1 } }
        })
    );

    ws.send(
        JSON.stringify({
            msgType: 'msg',
            uiaId: 'btpairing',
            msgId: 'BatteryStatus',
            params: {
                payload: {
                    currValue: bluetoothOn ? 4 : 0,
                    PhoneBatteryStatusAvailable: bluetoothOn
                }
            }
        })
    );
}

// Events of this application (see docs/NATIVE_MAP.md), dispatched by eventId.
const events = {
    SelectBluetooth: (ws) => handleSelectBluetooth(ws),
    SelectBluetoothSettings: (ws) => handleSelectBluetoothSettings(ws),
    ToggleBluetoothOn: (ws) => handleToggleBluetooth(ws, true),
    ToggleBluetoothOff: (ws) => handleToggleBluetooth(ws, false),
    AddNewDevice: (ws) => handleAddNewDevice(ws),
    ChangePairCode: (ws) => handleChangePairCode(ws),
    ChangePairCodeYes: (ws, params) => handleChangePairCodeYes(ws, params)
};

module.exports = {
    events: events,
    sendPhoneConnectedStatus: sendPhoneConnectedStatus,
    sendBluetoothState: sendBluetoothState,
    handleSelectBluetooth: handleSelectBluetooth,
    handleSelectBluetoothSettings: handleSelectBluetoothSettings,
    handleToggleBluetooth: handleToggleBluetooth,
    handleAddNewDevice: handleAddNewDevice,
    handleChangePairCode: handleChangePairCode,
    handleChangePairCodeYes: handleChangePairCodeYes,
    handleCancel: handleCancel,
    getPairCode: () => pairCode,
    setPairCode: (code) => {
        pairCode = String(code);
    }
};
