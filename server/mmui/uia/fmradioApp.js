const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const settings = require('../services/settings');
const logger = require('../../logger');

let currentFreq = 95.3;
let currentStationName = 'Rock Classics';
let isScanning = false;
let isPlaying = true;

const PRESET_STATIONS = [
    { freq: 88.5, name: 'Jazz 24/7' },
    { freq: 95.3, name: 'Rock Classics' },
    { freq: 100.5, name: 'Top 40 Hits' },
    { freq: 103.0, name: 'Public Radio' },
    { freq: 106.9, name: 'Urban Beats' }
];

function sendFmRadioMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'fmradio',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('fmradio', 'Sent message msgId=%s', msgId);
}

function sendRadioTunerStatus(ws) {
    sendFmRadioMsg(ws, 'RadioTunerStatus', {
        radioTunerStatus: {
            freq: currentFreq,
            stationName: currentStationName,
            radioBand: 'FM',
            operationMode: 'Normal',
            relayName: '',
            nickName: '',
            piCode: 1234
        }
    });
}

function sendFmRadioState(ws) {
    const hasData = settings.HARDWARE_CONFIG.fmRadioData === 'On';
    sendFmRadioMsg(ws, 'RegionInformation', {
        region: 'REGION_EU'
    });
    sendRadioTunerStatus(ws);
    sendFmRadioMsg(ws, 'MetaDataInformation', {
        metaDataStatus: hasData ? 'METADATA_AVAILABLE' : 'METADATA_UNAVAILABLE'
    });
}

function handleSelectRadioFM(ws) {
    sendFmRadioState(ws);
    sendContextChange(ws, 'fmradio', 'NowPlaying');
}

function handleSelectTune(ws) {
    sendRadioTunerStatus(ws);
    sendContextChange(ws, 'fmradio', 'Tune');
}

function handleSelectStationList(ws) {
    const hasData = settings.HARDWARE_CONFIG.fmRadioData === 'On';
    sendFmRadioState(ws);
    sendContextChange(ws, 'fmradio', 'StationList');
    sendFmRadioMsg(ws, 'StationListStatusInfo', {
        StationListStatus: hasData ? 'AVAILABLE' : 'UNAVAILABLE'
    });
    sendFmRadioMsg(ws, 'RadioStationInfo', {
        StationListStatus: hasData ? 'AVAILABLE' : 'UNAVAILABLE'
    });
}

function handleSelectSettings(ws) {
    sendFmRadioState(ws);
    sendContextChange(ws, 'fmradio', 'Settings');
}

function handleSelectAutoMemory(ws) {
    sendFmRadioState(ws);
    sendContextChange(ws, 'fmradio', 'AutoMemory');
}

function handleTuneUp(ws) {
    currentFreq = Math.round((currentFreq + 0.1) * 10) / 10;
    if (currentFreq > 108.0) {
        currentFreq = 87.5;
    }
    const preset = PRESET_STATIONS.find((s) => Math.abs(s.freq - currentFreq) < 0.05);
    currentStationName = preset ? preset.name : '';
    sendRadioTunerStatus(ws);
}

function handleTuneDown(ws) {
    currentFreq = Math.round((currentFreq - 0.1) * 10) / 10;
    if (currentFreq < 87.5) {
        currentFreq = 108.0;
    }
    const preset = PRESET_STATIONS.find((s) => Math.abs(s.freq - currentFreq) < 0.05);
    currentStationName = preset ? preset.name : '';
    sendRadioTunerStatus(ws);
}

function handleSeekUp(ws) {
    const next = PRESET_STATIONS.find((s) => s.freq > currentFreq);
    if (next) {
        currentFreq = next.freq;
        currentStationName = next.name;
    } else {
        currentFreq = PRESET_STATIONS[0].freq;
        currentStationName = PRESET_STATIONS[0].name;
    }
    sendRadioTunerStatus(ws);
}

function handleSeekDown(ws) {
    const reversed = [...PRESET_STATIONS].reverse();
    const prev = reversed.find((s) => s.freq < currentFreq);
    if (prev) {
        currentFreq = prev.freq;
        currentStationName = prev.name;
    } else {
        currentFreq = reversed[0].freq;
        currentStationName = reversed[0].name;
    }
    sendRadioTunerStatus(ws);
}

function handlePlay(ws) {
    isPlaying = true;
    sendFmRadioMsg(ws, 'ScanStatus', { scanStatus: false });
}

function handlePause(ws) {
    isPlaying = false;
    sendFmRadioMsg(ws, 'ScanStatus', { scanStatus: false });
}

function handleSelectStationName(ws, params) {
    if (params && params.payload) {
        if (params.payload.FMStationData && params.payload.FMStationData.FMFrequency) {
            currentFreq = params.payload.FMStationData.FMFrequency;
        } else if (params.payload.frequency) {
            currentFreq = params.payload.frequency;
        }
        if (params.payload.FMStationName) {
            currentStationName = params.payload.FMStationName;
        } else if (params.payload.stationName) {
            currentStationName = params.payload.stationName;
        }
    }
    const stack = navigationState.goBackStack;
    if (
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'fmradio' &&
        stack[stack.length - 1].ctxtId === 'StationList'
    ) {
        stack.pop();
    }
    sendRadioTunerStatus(ws);
    sendContextChange(ws, 'fmradio', 'NowPlaying', undefined, undefined, true);
}

const events = {
    SelectTune: (ws) => handleSelectTune(ws),
    SelectStationList: (ws) => handleSelectStationList(ws),
    SelectStationName: (ws, params) => handleSelectStationName(ws, params),
    SelectAutoMemory: (ws) => handleSelectAutoMemory(ws),
    SelectFMSettings: (ws) => handleSelectSettings(ws),
    TuneUp: (ws) => handleTuneUp(ws),
    TuneDown: (ws) => handleTuneDown(ws),
    SeekUp: (ws) => handleSeekUp(ws),
    SeekDown: (ws) => handleSeekDown(ws),
    Play: (ws) => handlePlay(ws),
    Pause: (ws) => handlePause(ws),
    TurnOnAF: () => {},
    TurnOffAF: () => {},
    TurnOnReg: () => {},
    TurnOffReg: () => {}
};

module.exports = {
    events,
    handleSelectRadioFM,
    handleSelectTune,
    handleSelectStationList,
    handleSelectStationName,
    handleSelectSettings,
    handleSelectAutoMemory,
    handleTuneUp,
    handleTuneDown,
    handleSeekUp,
    handleSeekDown,
    sendFmRadioState,
    sendRadioTunerStatus,
    PRESET_STATIONS,
    getState: () => ({ currentFreq, currentStationName, isScanning, isPlaying }),
    setState: (newState) => {
        if (newState.currentFreq !== undefined) currentFreq = newState.currentFreq;
        if (newState.currentStationName !== undefined)
            currentStationName = newState.currentStationName;
    }
};
