const test = require('node:test');
const assert = require('node:assert/strict');

const sysupdateApp = require('../../../server/mmui/uia/sysupdateApp');
const navigationState = require('../../../server/mmui/state/navigationState');
const { createMockWs } = require('../../helpers/mockWs');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
    sysupdateApp.dialogs.softwareInfoDialogActive = false;
    sysupdateApp.dialogs.musicDBUpdateActive = false;
});

test('handleSelectVersion sends version fields and opens the SoftwareInfo dialog', () => {
    const ws = createMockWs();

    sysupdateApp.handleSelectVersion(ws);

    const msgIds = ws.messages.map((m) => m.msgId).filter(Boolean);
    assert.ok(msgIds.includes('OSVersion'));
    assert.ok(msgIds.includes('GraceNoteVersion'));
    assert.ok(msgIds.includes('FailSafeVersion'));
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'SoftwareInfo');
    assert.equal(sysupdateApp.dialogs.softwareInfoDialogActive, true);
});

test('handleSoftwareInfoOk closes the dialog and returns to the previous context', () => {
    navigationState.goBackStack.push({ uiaId: 'sysupdate', ctxtId: 'SystemTab', contextSeq: 1 });
    navigationState.goBackStack.push({ uiaId: 'sysupdate', ctxtId: 'SoftwareInfo', contextSeq: 2 });
    sysupdateApp.dialogs.softwareInfoDialogActive = true;

    const ws = createMockWs();
    sysupdateApp.handleSoftwareInfoOk(ws);

    assert.equal(sysupdateApp.dialogs.softwareInfoDialogActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'SystemTab');
});

test('handleSelectMusicDatabaseUpdate opens the search context and flags the dialog active', () => {
    const ws = createMockWs();

    sysupdateApp.handleSelectMusicDatabaseUpdate(ws);

    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'SearchMusicDBUpdates');
    assert.equal(sysupdateApp.dialogs.musicDBUpdateActive, true);
});

test('handleSearchForUpdates eventually reports no new packages found', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const ws = createMockWs();

    sysupdateApp.handleSearchForUpdates(ws);
    const searching = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(searching.ctxtId, 'SearchingForMusicUpdates');

    t.mock.timers.tick(1500);

    const noPackages = ws.messages.filter((m) => m.msgType === 'ctxtChg').pop();
    assert.equal(noPackages.ctxtId, 'NoNewMusicPackages');
});

test('handleMusicDBUpdateClose cancels any pending search and returns to the previous context', () => {
    navigationState.goBackStack.push({ uiaId: 'sysupdate', ctxtId: 'SystemTab', contextSeq: 1 });
    navigationState.goBackStack.push({
        uiaId: 'sysupdate',
        ctxtId: 'SearchMusicDBUpdates',
        contextSeq: 2
    });
    sysupdateApp.dialogs.musicDBUpdateActive = true;

    const ws = createMockWs();
    sysupdateApp.handleSearchForUpdates(ws);
    sysupdateApp.handleMusicDBUpdateClose(ws);

    assert.equal(sysupdateApp.dialogs.musicDBUpdateActive, false);
    assert.equal(navigationState.goBackStack.length, 1);
});
