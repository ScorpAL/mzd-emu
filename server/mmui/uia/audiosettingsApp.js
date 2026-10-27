const settings = require('../services/settings');

function sendSoundState(ws) {
    const values = settings.currentSettings;
    const boseAvailable = settings.HARDWARE_CONFIG.bose === 'On';
    const naviAvailable = settings.HARDWARE_CONFIG.navigationSdCard === 'On';

    [
        ['BoseAvailable', { status: boseAvailable ? 1 : 0 }],
        ['BassSetting', { audioBass: values.soundBass }],
        ['TrebleSetting', { audioTreble: values.soundTreble }],
        ['FaderSetting', { audioFader: values.soundFade }],
        ['BalanceSetting', { audioBalance: values.soundBalance }],
        ['AutoVolumeSetting', { audioAutoVolume: values.soundAutoVolume }],
        ['CenterPointSetting', { audioCenterPoint: values.soundCenterPoint === 'On' }],
        ['AudioPilotSetting', { audioAudioPilot: values.soundAudioPilot === 'On' }],
        ['BeepSettings', { enableBeepOnOff: values.soundBeep === 'On' }],
        ['GuidanceVolSetting', { audioGuidanceVol: values.soundGuidanceVol }],
        ['GuidanceVolOnOff', { enableOnOff: naviAvailable }]
    ].forEach(function (entry) {
        ws.send(
            JSON.stringify({
                msgType: 'msg',
                uiaId: 'audiosettings',
                msgId: entry[0],
                params: { payload: entry[1] }
            })
        );
    });
}

function handleSetAudioBass(params) {
    if (params && params.payload && params.payload.audioBass != null) {
        settings.currentSettings.soundBass = params.payload.audioBass;
        settings.saveUserSettings();
    }
}

function handleSetAudioTreble(params) {
    if (params && params.payload && params.payload.audioTreble != null) {
        settings.currentSettings.soundTreble = params.payload.audioTreble;
        settings.saveUserSettings();
    }
}

function handleSetAudioFader(params) {
    if (params && params.payload && params.payload.audioFader != null) {
        settings.currentSettings.soundFade = params.payload.audioFader;
        settings.saveUserSettings();
    }
}

function handleSetAudioBalance(params) {
    if (params && params.payload && params.payload.audioBalance != null) {
        settings.currentSettings.soundBalance = params.payload.audioBalance;
        settings.saveUserSettings();
    }
}

// Persist this value even when the Bose row is hidden by hardware config.
function handleSetAudioAutoVolume(params) {
    if (params && params.payload && params.payload.audioAutoVolume != null) {
        settings.currentSettings.soundAutoVolume = params.payload.audioAutoVolume;
        settings.saveUserSettings();
    }
}

// The real GUI also sends a TTS prompt; only the level is persisted here.
function handleSetAudioGuidanceVol(params) {
    if (params && params.payload && params.payload.audioGuidanceVol != null) {
        settings.currentSettings.soundGuidanceVol = params.payload.audioGuidanceVol;
        settings.saveUserSettings();
    }
}

// Bose-only setting; the payload uses lowercase "point".
function handleSetAudioCenterpoint(params) {
    if (params && params.payload && params.payload.audioCenterpoint != null) {
        settings.currentSettings.soundCenterPoint = params.payload.audioCenterpoint ? 'On' : 'Off';
        settings.saveUserSettings();
    }
}

// Bose-only setting; the label varies by region.
function handleSetAudioAudioPilot(params) {
    if (params && params.payload && params.payload.audioAudioPilot != null) {
        settings.currentSettings.soundAudioPilot = params.payload.audioAudioPilot ? 'On' : 'Off';
        settings.saveUserSettings();
    }
}

// This setting is always shown.
function handleSetBeepOnOff(params) {
    if (params && params.payload && params.payload.enableBeepOnOff != null) {
        settings.currentSettings.soundBeep = params.payload.enableBeepOnOff ? 'On' : 'Off';
        settings.saveUserSettings();
    }
}

// Events of this application (see docs/NATIVE_MAP.md), dispatched by eventId.
const events = {
    SetAudioBass: (_ws, params) => handleSetAudioBass(params),
    SetAudioTreble: (_ws, params) => handleSetAudioTreble(params),
    SetAudioFader: (_ws, params) => handleSetAudioFader(params),
    SetAudioBalance: (_ws, params) => handleSetAudioBalance(params),
    SetAudioAutoVolume: (_ws, params) => handleSetAudioAutoVolume(params),
    SetAudioGuidanceVol: (_ws, params) => handleSetAudioGuidanceVol(params),
    SetAudioCenterpoint: (_ws, params) => handleSetAudioCenterpoint(params),
    SetAudioAudioPilot: (_ws, params) => handleSetAudioAudioPilot(params),
    SetBeepOnOff: (_ws, params) => handleSetBeepOnOff(params)
};

module.exports = {
    events: events,
    sendSoundState: sendSoundState,
    handleSetAudioBass: handleSetAudioBass,
    handleSetAudioTreble: handleSetAudioTreble,
    handleSetAudioFader: handleSetAudioFader,
    handleSetAudioBalance: handleSetAudioBalance,
    handleSetAudioAutoVolume: handleSetAudioAutoVolume,
    handleSetAudioGuidanceVol: handleSetAudioGuidanceVol,
    handleSetAudioCenterpoint: handleSetAudioCenterpoint,
    handleSetAudioAudioPilot: handleSetAudioAudioPilot,
    handleSetBeepOnOff: handleSetBeepOnOff
};
