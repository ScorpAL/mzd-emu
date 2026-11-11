const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const sysupdateApp = require('./sysupdateApp');
const { createMockWs, contexts, msgIds } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');
const { useMockTimers } = require('../../testing/timers');

const { dialogs } = sysupdateApp;

describe('sysupdateApp', () => {
    useCleanState();

    describe('software information', () => {
        it('Version sends the version fields and opens the SoftwareInfo dialog', () => {
            const ws = createMockWs();
            sysupdateApp.handleSelectVersion(ws);
            for (const msgId of ['OSVersion', 'GraceNoteVersion', 'FailSafeVersion']) {
                assert.ok(msgIds(ws).includes(msgId), msgId);
            }
            assert.deepEqual(contexts(ws), ['SoftwareInfo']);
            assert.equal(dialogs.softwareInfoDialogActive, true);
        });

        it('OK closes the dialog and returns to the previous context', () => {
            setBackStack(['sysupdate', 'SystemTab'], ['sysupdate', 'SoftwareInfo']);
            dialogs.softwareInfoDialogActive = true;
            const ws = createMockWs();
            sysupdateApp.handleSoftwareInfoOk(ws);
            assert.equal(dialogs.softwareInfoDialogActive, false);
            assert.deepEqual(backStack(), ['SystemTab']);
            assert.deepEqual(contexts(ws), ['SystemTab']);
        });
    });

    describe('music database update', () => {
        it('opens the search dialog', () => {
            const ws = createMockWs();
            sysupdateApp.handleSelectMusicDatabaseUpdate(ws);
            assert.deepEqual(contexts(ws), ['SearchMusicDBUpdates']);
            assert.equal(dialogs.musicDBUpdateActive, true);
        });

        it('the search reports that no new packages were found', (t) => {
            const timers = useMockTimers(t);
            const ws = createMockWs();
            sysupdateApp.handleSearchForUpdates(ws);
            assert.deepEqual(contexts(ws), ['SearchingForMusicUpdates']);

            timers.tick(1500);
            assert.deepEqual(contexts(ws), ['SearchingForMusicUpdates', 'NoNewMusicPackages']);
        });

        it('Close cancels a pending search and returns to the previous context', (t) => {
            const timers = useMockTimers(t);
            setBackStack(['sysupdate', 'SystemTab'], ['sysupdate', 'SearchMusicDBUpdates']);
            dialogs.musicDBUpdateActive = true;
            const ws = createMockWs();
            sysupdateApp.handleSearchForUpdates(ws);
            sysupdateApp.handleMusicDBUpdateClose(ws);

            assert.equal(dialogs.musicDBUpdateActive, false);
            assert.deepEqual(backStack(), ['SystemTab']);
            timers.tick(10000);
            assert.ok(!contexts(ws).includes('NoNewMusicPackages'), 'the search was cancelled');
        });
    });
});
