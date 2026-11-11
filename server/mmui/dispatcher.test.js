const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const dispatcher = require('./dispatcher');
const coldStart = require('./services/coldStart');
const settings = require('./services/settings');
const systemApp = require('./uia/systemApp');
const syssettingsApp = require('./uia/syssettingsApp');
const sysupdateApp = require('./uia/sysupdateApp');
const vehsettingsApp = require('./uia/vehsettingsApp');
const { createMockWs, contexts, contextPaths, msgIds } = require('../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../testing/state');

// Sends one GUI event through the dispatcher and returns the fake socket with the answers.
function dispatch(uiaId, eventId, params = {}) {
    const ws = createMockWs();
    assert.equal(dispatcher(ws, uiaId, eventId, params), true, 'the dispatcher always answers');
    return ws;
}

describe('dispatcher', () => {
    useCleanState();
    // The simulated boot wait would defer every startup reply in these synchronous tests.
    before(() => {
        coldStart.config.bootDelayMs = 0;
    });

    describe('the event table', () => {
        it('every application owns a disjoint part of it', () => {
            const owners = new Map();
            for (const name of [
                'system',
                'syssettings',
                'vehsettings',
                'audiosettings',
                'btpairing',
                'netmgmt'
            ]) {
                for (const eventId of Object.keys(require(`./uia/${name}App`).events)) {
                    assert.equal(owners.has(eventId), false, `${eventId} claimed twice`);
                    owners.set(eventId, name);
                }
            }
            assert.ok(owners.size > 100);
            assert.ok('Global.InitGui' in dispatcher.eventTable);
        });

        it('buildEventTable refuses an event claimed by two applications', () => {
            const handler = () => {};
            assert.throws(
                () =>
                    dispatcher.buildEventTable([
                        { events: { Foo: handler } },
                        { events: { Foo: handler } }
                    ]),
                /more than one application: Foo/
            );
        });

        it('events owned by an application are routed to it', () => {
            assert.deepEqual(contextPaths(dispatch('system', 'SelectApplications')), [
                'system/Applications'
            ]);
            assert.deepEqual(contexts(dispatch('vehsettings', 'SelectDRSS')), ['DRSS']);
            assert.deepEqual(contexts(dispatch('btpairing', 'SelectBluetooth')), [
                'BTConnectionManager'
            ]);
            // SelectTimeZone is the firmware's own context name, opened as-is.
            assert.deepEqual(contexts(dispatch('syssettings', 'SelectTimeZone')), [
                'SelectTimeZone'
            ]);
            assert.ok(dispatch('syssettings', 'SetAppleCarPlay').messages.length > 0);
        });

        it('SelectDisplayOff and SelectDisplayClock are native no-ops', () => {
            assert.deepEqual(dispatch('syssettings', 'SelectDisplayOff').messages, []);
            assert.deepEqual(dispatch('syssettings', 'SelectDisplayClock').messages, []);
        });
    });

    describe('events no application owns', () => {
        it('an unknown "SelectXyz" event becomes a plain context change to Xyz', () => {
            assert.deepEqual(contexts(dispatch('system', 'SelectFoobar')), ['Foobar']);
        });

        it('other unknown events are ignored entirely', () => {
            assert.deepEqual(dispatch('system', 'SomethingElseEntirely').messages, []);
            assert.deepEqual(dispatch('common', 'TotallyUnknownEvent').messages, []);
        });
    });

    describe('startup', () => {
        it('Global.GetStartupSettings runs the full startup sequence', () => {
            const ws = dispatch('system', 'Global.GetStartupSettings');
            systemApp.cancelColdStart(ws);
            assert.ok(msgIds(ws).includes('Region'));
            assert.equal(contexts(ws).at(-1), 'IntroAnimation');
        });
    });

    describe('events shared by several applications', () => {
        it('SelectReset is the eco energy reset confirmation when sent by ecoenergy', () => {
            setBackStack(['ecoenergy', 'FuelConsumption'], ['ecoenergy', 'ResetConfirm']);
            assert.ok(msgIds(dispatch('ecoenergy', 'SelectReset')).includes('ResetSuccess'));
        });

        it('SelectSettings opens the eco energy settings for ecoenergy, otherwise the system Settings', () => {
            assert.deepEqual(contexts(dispatch('ecoenergy', 'SelectSettings')), ['Settings']);
            const [tab] = contexts(dispatch('system', 'SelectSettings'));
            assert.ok(['DisplayTab', 'HUDTab', 'HUDTabJ78'].includes(tab), tab);
        });

        it('Global.Yes dismisses the Disclaimer while it is open', () => {
            systemApp.dialogs.disclaimerActive = true;
            setBackStack(['system', 'Disclaimer']);
            const ws = dispatch('common', 'Global.Yes');
            assert.equal(systemApp.dialogs.disclaimerActive, false);
            assert.deepEqual(contexts(ws), ['HomeScreen']);
        });

        it('Global.Yes answers the HUD reset when that dialog is open', () => {
            vehsettingsApp.dialogs.hudResetConfirmActive = true;
            setBackStack(['vehsettings', 'HUDTab']);
            settings.currentSettings.hudHeight = 4;
            dispatch('common', 'Global.Yes');
            assert.equal(settings.currentSettings.hudHeight, 0);
            assert.equal(vehsettingsApp.dialogs.hudResetConfirmActive, false);
        });

        it('Global.Yes does nothing when no dialog is open and the sender is not ecoenergy', () => {
            assert.deepEqual(dispatch('common', 'Global.Yes').messages, []);
        });

        it('Global.No answers the language confirmation when it is open', () => {
            setBackStack(['syssettings', 'ChangeLanguage'], ['syssettings', 'LanguageConf']);
            syssettingsApp.dialogs.languageConfActive = true;
            dispatch('common', 'Global.No');
            assert.equal(syssettingsApp.dialogs.languageConfActive, false);
            assert.deepEqual(backStack(), ['ChangeLanguage']);
        });

        it('Global.Cancel goes to an open Bluetooth Discoverable screen first', () => {
            setBackStack(['btpairing', 'BTConnectionManager'], ['btpairing', 'Discoverable']);
            dispatch('btpairing', 'Global.Cancel');
            assert.deepEqual(backStack(), ['BTConnectionManager']);
        });

        it('Global.Cancel otherwise closes an open music database update dialog', () => {
            setBackStack(['sysupdate', 'SystemTab'], ['sysupdate', 'SearchMusicDBUpdates']);
            sysupdateApp.dialogs.musicDBUpdateActive = true;
            dispatch('common', 'Global.Cancel');
            assert.equal(sysupdateApp.dialogs.musicDBUpdateActive, false);
            assert.deepEqual(backStack(), ['SystemTab']);
        });

        it('Global.GoBack pops the stack and shows the previous context again', () => {
            setBackStack(['system', 'Applications'], ['system', 'Entertainment']);
            const ws = dispatch('system', 'Global.GoBack');
            assert.deepEqual(backStack(), ['Applications']);
            assert.deepEqual(contexts(ws), ['Applications']);
        });

        it('Global.GoBack clears the SoftwareInfo dialog flag when it leaves that context', () => {
            setBackStack(['sysupdate', 'SystemTab'], ['sysupdate', 'SoftwareInfo']);
            sysupdateApp.dialogs.softwareInfoDialogActive = true;
            dispatch('sysupdate', 'Global.GoBack');
            assert.equal(sysupdateApp.dialogs.softwareInfoDialogActive, false);
        });
    });

    describe('grouped Set* events', () => {
        it('safety, lighting and system settings reach their handler', () => {
            dispatch('vehsettings', 'SetDRSS', { payload: { evData: 'DRSS_On' } });
            assert.equal(settings.currentSettings.drssMode, 'DRSS_On');
            dispatch('vehsettings', 'SetHBC', { payload: { evData: 'HBC_On' } });
            assert.equal(settings.currentSettings.lightingHighBeamControl, 'HBC_On');
            dispatch('syssettings', 'SetTimeFormat', { payload: { formatTime: 'hrs24' } });
            assert.equal(settings.currentSettings.timeFormat, 'hrs24');
        });
    });
});
