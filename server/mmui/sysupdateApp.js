const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('./navigationState');
const dialogState = require('./dialogState');
const firmwareVersion = require('./firmwareVersion');
const logger = require('../logger');

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
    dialogState.softwareInfoDialogActive = true;
}

// Global.Yes is shared by dialogs; this flag identifies the version popup.
function handleSoftwareInfoOk(ws) {
    dialogState.softwareInfoDialogActive = false;
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
    dialogState.musicDBUpdateActive = true;
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
    dialogState.musicDBUpdateActive = false;
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

module.exports = {
    handleSelectVersion: handleSelectVersion,
    handleSoftwareInfoOk: handleSoftwareInfoOk,
    handleSelectMusicDatabaseUpdate: handleSelectMusicDatabaseUpdate,
    handleSearchForUpdates: handleSearchForUpdates,
    handleMusicDBUpdateClose: handleMusicDBUpdateClose
};
