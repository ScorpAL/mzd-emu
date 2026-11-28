const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const fmradioApp = require('./fmradioApp');
const settings = require('../services/settings');
const { createMockWs, contextPaths, msgIds, payloadOf } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

describe('fmradioApp', () => {
    useCleanState();

    it('handleSelectRadioFM sends RegionInformation, RadioTunerStatus, MetaDataInformation and lands on NowPlaying', () => {
        const ws = createMockWs();
        fmradioApp.handleSelectRadioFM(ws);

        assert.deepEqual(contextPaths(ws), ['fmradio/NowPlaying']);
        const ids = msgIds(ws);
        assert.ok(ids.includes('RegionInformation'));
        assert.ok(ids.includes('RadioTunerStatus'));
        assert.ok(ids.includes('MetaDataInformation'));

        const tunerStatusMsg = ws.messages.find((m) => m.msgId === 'RadioTunerStatus');
        assert.equal(tunerStatusMsg.params.payload.radioTunerStatus.freq, 95.3);
        assert.equal(tunerStatusMsg.params.payload.radioTunerStatus.stationName, 'Rock Classics');
    });

    it('handleSelectTune navigates to Tune context with tuner status', () => {
        const ws = createMockWs();
        fmradioApp.handleSelectTune(ws);

        assert.deepEqual(contextPaths(ws), ['fmradio/Tune']);
        assert.ok(msgIds(ws).includes('RadioTunerStatus'));
    });

    it('handleSelectStationList navigates to StationList context and announces available stations', () => {
        const ws = createMockWs();
        fmradioApp.handleSelectStationList(ws);

        assert.deepEqual(contextPaths(ws), ['fmradio/StationList']);
        assert.ok(msgIds(ws).includes('RadioStationInfo'));
    });

    it('handleSelectSettings navigates to Settings context', () => {
        const ws = createMockWs();
        fmradioApp.handleSelectSettings(ws);

        assert.deepEqual(contextPaths(ws), ['fmradio/Settings']);
    });

    it('handleTuneUp and handleTuneDown step frequency by 0.1 MHz', () => {
        const ws = createMockWs();
        fmradioApp.setState({ currentFreq: 95.3, currentStationName: 'Rock Classics' });

        fmradioApp.handleTuneUp(ws);
        assert.equal(fmradioApp.getState().currentFreq, 95.4);

        fmradioApp.handleTuneDown(ws);
        assert.equal(fmradioApp.getState().currentFreq, 95.3);
    });

    it('handleSeekUp and handleSeekDown cycle through preset stations', () => {
        const ws = createMockWs();
        fmradioApp.setState({ currentFreq: 95.3, currentStationName: 'Rock Classics' });

        fmradioApp.handleSeekUp(ws);
        assert.equal(fmradioApp.getState().currentFreq, 100.5);
        assert.equal(fmradioApp.getState().currentStationName, 'Top 40 Hits');

        fmradioApp.handleSeekDown(ws);
        assert.equal(fmradioApp.getState().currentFreq, 95.3);
        assert.equal(fmradioApp.getState().currentStationName, 'Rock Classics');
    });

    it('handleSelectStationName tunes to selected station and returns to NowPlaying', () => {
        const ws = createMockWs();
        fmradioApp.handleSelectStationList(ws);

        fmradioApp.events.SelectStationName(ws, {
            payload: {
                FMStationName: 'Top 40 Hits',
                FMStationData: { FMFrequency: 100.5, FMPiCode: 1003 }
            }
        });

        assert.equal(fmradioApp.getState().currentFreq, 100.5);
        assert.equal(fmradioApp.getState().currentStationName, 'Top 40 Hits');
        assert.deepEqual(contextPaths(ws).slice(-1), ['fmradio/NowPlaying']);
    });

    it('fmRadioData config switches station list and metadata availability', () => {
        const prev = settings.HARDWARE_CONFIG.fmRadioData;
        try {
            settings.HARDWARE_CONFIG.fmRadioData = 'Off';
            const ws = createMockWs();
            fmradioApp.handleSelectStationList(ws);
            assert.equal(
                payloadOf(ws, 'MetaDataInformation').metaDataStatus,
                'METADATA_UNAVAILABLE'
            );
            assert.equal(payloadOf(ws, 'StationListStatusInfo').StationListStatus, 'UNAVAILABLE');
        } finally {
            settings.HARDWARE_CONFIG.fmRadioData = prev;
        }
    });
});
