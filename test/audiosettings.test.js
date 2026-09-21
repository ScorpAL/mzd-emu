const test = require('node:test');
const assert = require('node:assert/strict');

const audiosettingsApp = require('../server/mmui/audiosettingsApp');
const settings = require('../server/mmui/settings');
const { createMockWs } = require('./helpers/mockWs');

function withStubbedSave(fn) {
    const originalSave = settings.saveUserSettings;
    settings.saveUserSettings = () => {};
    try {
        fn();
    } finally {
        settings.saveUserSettings = originalSave;
    }
}

test('sendSoundState reports every sound setting field', () => {
    const ws = createMockWs();

    audiosettingsApp.sendSoundState(ws);

    const msgIds = ws.messages.map((m) => m.msgId);
    assert.deepEqual(msgIds, [
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
    ]);
});

test('numeric audio handlers persist the requested value', () => {
    withStubbedSave(() => {
        const cases = [
            ['handleSetAudioBass', 'audioBass', 'soundBass'],
            ['handleSetAudioTreble', 'audioTreble', 'soundTreble'],
            ['handleSetAudioFader', 'audioFader', 'soundFade'],
            ['handleSetAudioBalance', 'audioBalance', 'soundBalance'],
            ['handleSetAudioAutoVolume', 'audioAutoVolume', 'soundAutoVolume'],
            ['handleSetAudioGuidanceVol', 'audioGuidanceVol', 'soundGuidanceVol']
        ];

        cases.forEach(([handlerName, payloadField, settingField]) => {
            const original = settings.currentSettings[settingField];
            audiosettingsApp[handlerName]({ payload: { [payloadField]: 7 } });
            assert.equal(settings.currentSettings[settingField], 7, handlerName);
            settings.currentSettings[settingField] = original;
        });
    });
});

test('numeric audio handlers ignore payloads missing their field', () => {
    withStubbedSave(() => {
        const original = settings.currentSettings.soundBass;
        audiosettingsApp.handleSetAudioBass({ payload: {} });
        assert.equal(settings.currentSettings.soundBass, original);
        audiosettingsApp.handleSetAudioBass({});
        assert.equal(settings.currentSettings.soundBass, original);
    });
});

test('boolean audio handlers persist On/Off strings', () => {
    withStubbedSave(() => {
        const cases = [
            ['handleSetAudioCenterpoint', 'audioCenterpoint', 'soundCenterPoint'],
            ['handleSetAudioAudioPilot', 'audioAudioPilot', 'soundAudioPilot'],
            ['handleSetBeepOnOff', 'enableBeepOnOff', 'soundBeep']
        ];

        cases.forEach(([handlerName, payloadField, settingField]) => {
            const original = settings.currentSettings[settingField];

            audiosettingsApp[handlerName]({ payload: { [payloadField]: true } });
            assert.equal(settings.currentSettings[settingField], 'On', handlerName);

            audiosettingsApp[handlerName]({ payload: { [payloadField]: false } });
            assert.equal(settings.currentSettings[settingField], 'Off', handlerName);

            settings.currentSettings[settingField] = original;
        });
    });
});
