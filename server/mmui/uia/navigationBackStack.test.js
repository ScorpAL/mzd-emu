const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const systemApp = require('./systemApp');
const syssettingsApp = require('./syssettingsApp');
const fmradioApp = require('./fmradioApp');
const phoneApp = require('./phoneApp');
const commonApp = require('./commonApp');
const navigationState = require('../state/navigationState');
const { createMockWs, contextPaths } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

describe('navigationBackStack', () => {
    useCleanState();

    it('navigating to Communication, then DialPad, and pressing GoBack returns to Communication', () => {
        const ws = createMockWs();
        systemApp.handleIntentHome(ws);
        systemApp.handleSelectCommunication(ws);
        phoneApp.handleSelectPhone(ws);

        assert.equal(navigationState.goBackStack.length, 3);
        assert.equal(navigationState.goBackStack[2].uiaId, 'phone');
        assert.equal(navigationState.goBackStack[2].ctxtId, 'DialPad');

        // User triggers GoBack
        commonApp.events['Global.GoBack'](ws);

        assert.deepEqual(contextPaths(ws).slice(-1), ['system/Communication']);
        assert.equal(navigationState.goBackStack.length, 2);
    });

    it('navigating to Entertainment, then FM Radio, then Tune, and pressing GoBack returns to NowPlaying', () => {
        const ws = createMockWs();
        systemApp.handleIntentHome(ws);
        systemApp.handleSelectEntertainment(ws);
        fmradioApp.handleSelectRadioFM(ws);
        fmradioApp.handleSelectTune(ws);

        assert.equal(navigationState.goBackStack.length, 4);
        assert.equal(navigationState.goBackStack[3].uiaId, 'fmradio');
        assert.equal(navigationState.goBackStack[3].ctxtId, 'Tune');

        // User triggers GoBack
        commonApp.events['Global.GoBack'](ws);

        assert.deepEqual(contextPaths(ws).slice(-1), ['fmradio/NowPlaying']);
        assert.equal(navigationState.goBackStack.length, 3);
    });

    it('SelectFMSettings in fmradioApp navigates to Settings context', () => {
        const ws = createMockWs();
        fmradioApp.events.SelectFMSettings(ws);

        assert.deepEqual(contextPaths(ws).slice(-1), ['fmradio/Settings']);
    });

    it('navigating to DisplayOff and sending DisplayOffGUIActivity returns to DisplayTab', () => {
        const ws = createMockWs();
        systemApp.handleIntentHome(ws);
        systemApp.handleIntentSettingsTab(ws, { payload: { settingsTab: 'Display' } });
        syssettingsApp.handleSelectDisplayOff(ws);

        assert.equal(navigationState.goBackStack.length, 2);
        assert.equal(navigationState.goBackStack[1].uiaId, 'system');
        assert.equal(navigationState.goBackStack[1].ctxtId, 'DisplayOff');

        // User taps screen to wake up
        systemApp.events.DisplayOffGUIActivity(ws);

        assert.deepEqual(contextPaths(ws).slice(-1), ['syssettings/DisplayTab']);
        assert.equal(navigationState.goBackStack.length, 1);
    });

    it('from fmradio/NowPlaying, SelectSettings opens audiosettings/SoundTab and GoBack returns to NowPlaying', () => {
        const ws = createMockWs();
        systemApp.handleIntentHome(ws);
        systemApp.handleSelectEntertainment(ws);
        fmradioApp.handleSelectRadioFM(ws);

        assert.equal(navigationState.goBackStack.length, 3);
        assert.equal(navigationState.goBackStack[2].uiaId, 'fmradio');
        assert.equal(navigationState.goBackStack[2].ctxtId, 'NowPlaying');

        // Click equalizer/sound settings button
        commonApp.events.SelectSettings(ws, {}, 'fmradio');

        assert.deepEqual(contextPaths(ws).slice(-1), ['audiosettings/SoundTab']);
        assert.equal(navigationState.goBackStack.length, 4);
        assert.equal(navigationState.goBackStack[3].uiaId, 'audiosettings');
        assert.equal(navigationState.goBackStack[3].ctxtId, 'SoundTab');

        // Go back returns to fmradio/NowPlaying
        commonApp.events['Global.GoBack'](ws);

        assert.deepEqual(contextPaths(ws).slice(-1), ['fmradio/NowPlaying']);
        assert.equal(navigationState.goBackStack.length, 3);
    });
});
