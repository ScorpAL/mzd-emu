const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const firmwareVersion = require('../services/firmwareVersion');
const logger = require('../../logger');

// Dialog state of this application (what the shared Global.Yes / Global.No answer, see commonApp.js).
const dialogs = {
    softwareInfoDialogActive: false,
    musicDBUpdateActive: false
};

// Open the firmware version dialog with values from version.ini.
function handleSelectVersion(ws) {
    function sendSysupdateVersionMsg(msgId, version) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'sysupdate',
            msgId: msgId,
            params: { payload: { version: version } }
        });
        ws.send(msg);
        logger.debug('sysupdate', 'Sent version message msgId=%s', msgId);
    }

    sendSysupdateVersionMsg('OSVersion', firmwareVersion.FIRMWARE_VERSION_INFO.osVersion);
    sendSysupdateVersionMsg(
        'GraceNoteVersion',
        firmwareVersion.FIRMWARE_VERSION_INFO.musicDbVersion
    );
    sendSysupdateVersionMsg(
        'FailSafeVersion',
        firmwareVersion.FIRMWARE_VERSION_INFO.failSafeVersion
    );
    sendContextChange(ws, 'sysupdate', 'SoftwareInfo');
    dialogs.softwareInfoDialogActive = true;
}

// Global.Yes is shared by dialogs; this flag identifies the version popup.
function handleSoftwareInfoOk(ws) {
    dialogs.softwareInfoDialogActive = false;
    if (navigationState.goBackStack.length > 1) {
        navigationState.goBackStack.pop();
        const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
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

// The emulator reports no package because it has no USB storage to scan.
function handleSelectMusicDatabaseUpdate(ws) {
    sendContextChange(ws, 'sysupdate', 'SearchMusicDBUpdates');
    dialogs.musicDBUpdateActive = true;
}

// Allows Back/Cancel to stop the pending search result.
let pendingMusicDBSearchTimeout = null;

// Show the search spinner, then report that no package was found.
function handleSearchForUpdates(ws) {
    sendContextChange(ws, 'sysupdate', 'SearchingForMusicUpdates', undefined, undefined, true);
    pendingMusicDBSearchTimeout = setTimeout(function () {
        pendingMusicDBSearchTimeout = null;
        sendContextChange(ws, 'sysupdate', 'NoNewMusicPackages', undefined, undefined, true);
    }, 1500);
}

// All screens in this flow share one back-stack entry.
function handleMusicDBUpdateClose(ws) {
    if (pendingMusicDBSearchTimeout) {
        clearTimeout(pendingMusicDBSearchTimeout);
        pendingMusicDBSearchTimeout = null;
    }
    dialogs.musicDBUpdateActive = false;
    if (navigationState.goBackStack.length > 1) {
        navigationState.goBackStack.pop();
        const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
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

// Events of this application (see docs/NATIVE_MAP.md), dispatched by eventId.
const events = {
    SelectVersion: (ws) => handleSelectVersion(ws),
    SelectMusicDatabaseUpdate: (ws) => handleSelectMusicDatabaseUpdate(ws),
    SearchForUpdates: (ws) => handleSearchForUpdates(ws)
};

// Dialogs this application answers for the shared Global.Yes / Global.No, as [flag, handler]
// in the order they are tried.
const dialogAnswers = {
    yes: [
        ['softwareInfoDialogActive', handleSoftwareInfoOk],
        ['musicDBUpdateActive', handleMusicDBUpdateClose]
    ],
    no: []
};

// Going back closes the dialog on top of the stack, so its flags must be cleared.
function closeDialogsOf(top) {
    if (top.uiaId === 'sysupdate' && top.ctxtId === 'SoftwareInfo') {
        dialogs.softwareInfoDialogActive = false;
    }
    if (top.uiaId === 'sysupdate' && top.ctxtId === 'SearchMusicDBUpdates') {
        dialogs.musicDBUpdateActive = false;
    }
}

module.exports = {
    dialogs: dialogs,
    dialogAnswers: dialogAnswers,
    closeDialogsOf: closeDialogsOf,
    events: events,
    handleSelectVersion: handleSelectVersion,
    handleSoftwareInfoOk: handleSoftwareInfoOk,
    handleSelectMusicDatabaseUpdate: handleSelectMusicDatabaseUpdate,
    handleSearchForUpdates: handleSearchForUpdates,
    handleMusicDBUpdateClose: handleMusicDBUpdateClose
};
