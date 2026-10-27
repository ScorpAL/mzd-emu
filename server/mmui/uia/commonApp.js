const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const systemApp = require('./systemApp');
const syssettingsApp = require('./syssettingsApp');
const sysupdateApp = require('./sysupdateApp');
const vehsettingsApp = require('./vehsettingsApp');
const btpairingApp = require('./btpairingApp');
const schedmaintApp = require('./schedmaintApp');
const ecoenergyApp = require('./ecoenergyApp');

// Counterpart of libjciuiacommon.so (uiaid 0): the Global.* events that every dialog shares.
// The firmware sends them to the application that owns the open dialog. Here each application
// declares its dialogs (`dialogs` state and `dialogAnswers`), and this module finds the open one.

function isCommon(uiaId) {
    return uiaId === 'common' || uiaId === 'Common';
}

// Applications with dialogs, in the order their dialogs are tried.
const DIALOG_OWNERS = [systemApp, sysupdateApp, syssettingsApp, vehsettingsApp, schedmaintApp];

// The handler of the first open dialog that answers `answer` ("yes" or "no"), or null.
function findOpenDialog(answer) {
    for (const app of DIALOG_OWNERS) {
        for (const [flag, handler] of app.dialogAnswers[answer]) {
            if (app.dialogs[flag]) {
                return handler;
            }
        }
    }
    return null;
}

function handleYes(ws, _params, uiaId) {
    if (isCommon(uiaId)) {
        if (systemApp.isSystemWarningOpen(ws)) {
            systemApp.dismissSystemWarning(ws);
            return;
        }
        const handler = findOpenDialog('yes');
        if (handler) {
            handler(ws);
            return;
        }
    }
    if (uiaId === 'ecoenergy') {
        ecoenergyApp.handleResetConfirmYes(ws);
    }
}

// Global.No is shared by dialogs; guard it with dialog state.
function handleNo(ws, _params, uiaId) {
    if (!isCommon(uiaId)) {
        return;
    }
    const handler = findOpenDialog('no');
    if (handler) {
        handler(ws);
    }
}

// Global.Cancel is shared by the Bluetooth pairing and the music database dialogs.
function handleCancel(ws, _params, uiaId) {
    if (btpairingApp.handleCancel(ws)) {
        return;
    }
    if (sysupdateApp.dialogs.musicDBUpdateActive && isCommon(uiaId)) {
        sysupdateApp.handleMusicDBUpdateClose(ws);
    } else if ((uiaId === 'ecoenergy' || isCommon(uiaId)) && ecoenergyApp.isResetConfirmActive()) {
        ecoenergyApp.handleResetCancel(ws);
    }
}

// Timeout is shared by system dialogs; only handle it for the disclaimer.
function handleTimeout(ws, _params, uiaId) {
    if (systemApp.dialogs.disclaimerActive && uiaId === 'system') {
        systemApp.dismissDisclaimer(ws);
    }
}

function handleGoBack(ws, _params, uiaId) {
    if (schedmaintApp.dialogs.schedMaintResetConfirmActive && isCommon(uiaId)) {
        schedmaintApp.handleResetNo(ws);
        return;
    }
    if (schedmaintApp.dialogs.schedMaintOffConfirmActive && isCommon(uiaId)) {
        schedmaintApp.handleOffNo(ws);
        return;
    }
    const stack = navigationState.goBackStack;
    if (stack.length > 1) {
        const top = stack[stack.length - 1];
        DIALOG_OWNERS.forEach((app) => {
            if (app.closeDialogsOf) {
                app.closeDialogsOf(top);
            }
        });
        stack.pop();
        const context = stack[stack.length - 1];
        // Re-display the new stack top without pushing it again.
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

// The same event name belongs to two applications; the sender tells which.
function handleSelectReset(ws, _params, uiaId) {
    if (uiaId === 'ecoenergy') {
        ecoenergyApp.handleResetConfirmYes(ws);
    } else {
        schedmaintApp.handleSelectReset(ws);
    }
}

function handleSelectSettings(ws, _params, uiaId) {
    if (uiaId === 'ecoenergy') {
        ecoenergyApp.handleSelectSettings(ws);
    } else {
        systemApp.handleSelectSettings(ws);
    }
}

const events = {
    'Global.Yes': handleYes,
    'Global.No': handleNo,
    'Global.Cancel': handleCancel,
    'Global.GoBack': handleGoBack,
    Timeout: handleTimeout,
    SelectReset: handleSelectReset,
    SelectSettings: handleSelectSettings,
    SelectDriveRecord: (ws) => sendContextChange(ws, 'vdt', 'DriveChartDetails')
};

module.exports = { events: events };
