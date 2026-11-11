const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const audiosettingsApp = require('./audiosettingsApp');
const settings = require('../services/settings');
const { createMockWs } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

const current = settings.currentSettings;

describe('audiosettingsApp', () => {
    const fixture = useCleanState();

    it('the sound state reports every sound setting', () => {
        const ws = createMockWs();
        audiosettingsApp.sendSoundState(ws);
        assert.deepEqual(
            ws.messages.map((m) => m.msgId),
            [
                'BoseAvailable',
                'BassSetting',
                'TrebleSetting',
                'FaderSetting',
                'BalanceSetting',
                'AutoVolumeSetting',
                'CenterPointSetting',
                'AudioPilotSetting',
                'BeepSettings',
                'GuidanceVolSetting',
                'GuidanceVolOnOff'
            ]
        );
    });

    describe('numeric settings', () => {
        for (const [handlerName, payloadField, settingField] of [
            ['handleSetAudioBass', 'audioBass', 'soundBass'],
            ['handleSetAudioTreble', 'audioTreble', 'soundTreble'],
            ['handleSetAudioFader', 'audioFader', 'soundFade'],
            ['handleSetAudioBalance', 'audioBalance', 'soundBalance'],
            ['handleSetAudioAutoVolume', 'audioAutoVolume', 'soundAutoVolume'],
            ['handleSetAudioGuidanceVol', 'audioGuidanceVol', 'soundGuidanceVol']
        ]) {
            it(`${handlerName} saves ${payloadField} as ${settingField}`, () => {
                audiosettingsApp[handlerName]({ payload: { [payloadField]: 7 } });
                assert.equal(current[settingField], 7);
                assert.equal(fixture.saves, 1);
            });
        }

        it('a payload without its field changes nothing', () => {
            const before = current.soundBass;
            audiosettingsApp.handleSetAudioBass({ payload: {} });
            audiosettingsApp.handleSetAudioBass({});
            assert.equal(current.soundBass, before);
        });
    });

    describe('On/Off settings', () => {
        for (const [handlerName, payloadField, settingField] of [
            ['handleSetAudioCenterpoint', 'audioCenterpoint', 'soundCenterPoint'],
            ['handleSetAudioAudioPilot', 'audioAudioPilot', 'soundAudioPilot'],
            ['handleSetBeepOnOff', 'enableBeepOnOff', 'soundBeep']
        ]) {
            it(`${handlerName} saves true/false as On/Off`, () => {
                audiosettingsApp[handlerName]({ payload: { [payloadField]: true } });
                assert.equal(current[settingField], 'On');
                audiosettingsApp[handlerName]({ payload: { [payloadField]: false } });
                assert.equal(current[settingField], 'Off');
            });
        }
    });
});
