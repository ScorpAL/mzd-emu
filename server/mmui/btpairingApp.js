const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const settings = require('./settings');
const navigationState = require('./navigationState');
const logger = require('../logger');

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
            pairCode: '0000'
        }
    });
    sendMsg(ws, 'CarPlayConnectionStatus', { isCarPlayConnected: 0 });
    sendMsg(ws, 'AndroidAutoConnectionStatus', { isAndroidAutoConnected: false });
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
                                      status: 1,
                                      connect_disconnect_Success: 1
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

module.exports = {
    sendPhoneConnectedStatus: sendPhoneConnectedStatus,
    sendBluetoothState: sendBluetoothState,
    handleSelectBluetooth: handleSelectBluetooth,
    handleSelectBluetoothSettings: handleSelectBluetoothSettings,
    handleToggleBluetooth: handleToggleBluetooth,
    handleAddNewDevice: handleAddNewDevice,
    handleCancel: handleCancel
};
