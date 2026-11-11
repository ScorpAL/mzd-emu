const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const logger = require('../../logger');
const settings = require('../services/settings');

// Counterpart of libjciuiastitcher.so (uiaid 29). The Stitcher service lives on a paired phone
// (Bluetooth SPP / iAP, see jci/bds/BdsConfiguration.xml), and the emulator has no phone, so this
// application only reproduces what the car shows when Stitcher is selected and nothing answers.
//
// What the firmware does (read from the disassembly of libjciuiasystem.so and
// libjciuiastitcher.so; the screens come from jci/gui/apps/stitcher/js/stitcherApp.js):
//   1. SelectStitcher from the Entertainment list reaches UIA_SYSTEM_ActivateStitcher, which
//      focuses the Stitcher application.
//   2. The Stitcher application shows the "Loading" context (logo, spinner, an
//      "Entertainment Menu" button that sends SelectSource) and asks blm_ira_stitcher to connect
//      to the phone (BLMSTITCHER_Connect, retried by ira_stitcher_Connect_cb).
//   3. When the connection fails it injects an error event and the "ErrorCondition" context
//      opens with payload.errorID, one of MMUI_Stitcher_Possible_Errors: NoConnection,
//      ConnectionLost, MobileDeviceError, StitcherNotFound, NotLoggedIn.
//
// Checked on the car by the owner (2026-11-10):
//   - no phone connected by Bluetooth: touching Stitcher does not open the application; the system window "No Device
//     Connected" ("Would you like to connect a Device now?") appears with the buttons No and Connect. No closes it (back to the
//     Entertainment list); Connect closes it and opens Settings > Devices > Bluetooth (see systemApp.js, SelectConnect).
//   - a phone connected: the Loading screen (logo, spinner, big "Entertainment Menu" button), after 2-3 seconds the window
//     "Stitcher Not Found" ("Make sure the Stitcher application is installed on your mobile device.") with OK; OK goes to the
//     Entertainment list. (The service behind Stitcher is gone since 2023, so the phone cannot answer.)
// Not checked: Back / Home during Loading, a phone with the Stitcher application installed.
//
// The firmware decides this in the system application: UIA_SYSTEM_IsAudioNotConnected (the audio profile of the phone,
// uiaSystem_phoneAudioProfileConnStatus, set by the event StatusUpdateAudioConnection) selects UIA_SYSTEM_JumpToNoDevice.
// The emulator has two inputs for it: the Bluetooth switch of the head unit (settings) and the connection of the mock phone
// (config/vehicle.json, phoneBluetoothConnection): the phone is connected only when both are On.
const config = {
    // Shown after the failed connection.
    errorId: 'StitcherNotFound',
    // How long "Loading" stays before the error appears. 0 shows the error at once.
    connectTimeoutMs: 2500
};

function isPhoneConnected() {
    return (
        settings.currentSettings.bluetooth === 'On' &&
        settings.HARDWARE_CONFIG.phoneBluetoothConnection === 'On'
    );
}

// Dialog state of this application (what the shared Global.Yes / Global.No answer, see commonApp.js).
const dialogs = {
    errorActive: false
};

// One pending "connection failed" timer per GUI connection.
const timers = new WeakMap();

function cancelConnect(ws) {
    const timer = timers.get(ws);
    if (timer) {
        clearTimeout(timer);
        timers.delete(ws);
    }
}

function showError(ws) {
    timers.delete(ws);
    dialogs.errorActive = true;
    logger.info('stitcher', 'connection failed, showing error %s', config.errorId);
    sendContextChange(ws, 'stitcher', 'ErrorCondition', { payload: { errorID: config.errorId } });
}

function handleSelectStitcher(ws) {
    cancelConnect(ws);
    dialogs.errorActive = false;
    if (!isPhoneConnected()) {
        // The system window with No / Connect; it is part of the system application (jci/gui/apps/system).
        logger.info('stitcher', 'no phone connected, showing the No Device window');
        sendContextChange(ws, 'system', 'NoDevice');
        return;
    }
    sendContextChange(ws, 'stitcher', 'Loading');
    if (config.connectTimeoutMs <= 0) {
        showError(ws);
        return;
    }
    // Never keep the process alive just for a simulated connection attempt.
    const timer = setTimeout(() => showError(ws), config.connectTimeoutMs).unref();
    timers.set(ws, timer);
    if (typeof ws.once === 'function') {
        ws.once('close', () => cancelConnect(ws));
    }
}

// Back to the Entertainment list. The list is already on the back stack (it was open when Stitcher was touched), so it is
// shown again WITHOUT being pushed a second time. A second entry would make the Back button of the list "do nothing" once for
// every visit to Stitcher.
function returnToEntertainment(ws) {
    const stack = navigationState.goBackStack;
    const top = stack[stack.length - 1];
    if (top && top.uiaId === 'system' && top.ctxtId === 'Entertainment') {
        sendContextChange(ws, top.uiaId, top.ctxtId, top.params, top.contextSeq, true);
        return;
    }
    sendContextChange(ws, 'system', 'Entertainment');
}

// The "Entertainment Menu" button of the Loading and ReconnectingBtDevice contexts.
function handleSelectSource(ws) {
    cancelConnect(ws);
    dialogs.errorActive = false;
    returnToEntertainment(ws);
}

// OK on the error dialog (the GUI sends Global.Yes) goes back to the Entertainment list.
function dismissError(ws) {
    dialogs.errorActive = false;
    returnToEntertainment(ws);
}

const events = {
    SelectStitcher: (ws) => handleSelectStitcher(ws),
    SelectSource: (ws) => handleSelectSource(ws)
};

// Dialogs this application answers for the shared Global.Yes / Global.No, as [flag, handler]
// in the order they are tried.
const dialogAnswers = {
    yes: [['errorActive', dismissError]],
    no: []
};

module.exports = {
    config: config,
    dialogs: dialogs,
    dialogAnswers: dialogAnswers,
    events: events,
    cancelConnect: cancelConnect,
    isPhoneConnected: isPhoneConnected,
    handleSelectStitcher: handleSelectStitcher,
    handleSelectSource: handleSelectSource,
    dismissError: dismissError
};
