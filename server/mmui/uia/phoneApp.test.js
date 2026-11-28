const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const phoneApp = require('./phoneApp');
const { createMockWs, contextPaths, msgIds } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

describe('phoneApp', () => {
    useCleanState();

    it('handleSelectPhone lands on DialPad context', () => {
        const ws = createMockWs();
        phoneApp.handleSelectPhone(ws);
        assert.deepEqual(contextPaths(ws), ['phone/DialPad']);
    });

    it('handleSelectCallHistory sends PbConnectStatus and lands on RecentCalls', () => {
        const ws = createMockWs();
        phoneApp.handleSelectCallHistory(ws);
        assert.deepEqual(contextPaths(ws), ['phone/RecentCalls']);
        assert.ok(msgIds(ws).includes('PbConnectStatus'));
    });

    it('handleCallDialpadNumber triggers ActiveCall with caller details', () => {
        const ws = createMockWs();
        phoneApp.handleCallDialpadNumber(ws, { payload: { number: '123456789' } });

        assert.deepEqual(contextPaths(ws), ['phone/ActiveCall']);
        assert.ok(msgIds(ws).includes('ActiveCallInfo'));
        assert.ok(msgIds(ws).includes('StatusPhoneCall'));

        const callMsg = ws.messages.find((m) => m.msgId === 'ActiveCallInfo');
        assert.equal(callMsg.params.payload.activeCallInfoMsg.type, 'ActiveCall');
        assert.equal(callMsg.params.payload.activeCallInfoMsg.phoneNumber, '123456789');
    });

    it('handleHangUpCall transitions back to Communication and clears active call', () => {
        const ws = createMockWs();
        phoneApp.handleHangUpCall(ws);

        assert.deepEqual(contextPaths(ws), ['system/Communication']);
        assert.ok(msgIds(ws).includes('NoCallState'));
        assert.equal(phoneApp.getCallState().activeCallState, 'Idle');
    });

    it('handleToggleMute toggles mute state and emits MuteStatus', () => {
        const ws = createMockWs();
        phoneApp.setCallState({ isMuted: false });

        phoneApp.handleToggleMute(ws);
        assert.equal(phoneApp.getCallState().isMuted, true);
        const muteMsg = ws.messages.find((m) => m.msgId === 'MuteStatus');
        assert.equal(muteMsg.params.payload.mute, 'on');
    });

    it('handleSelectDtmfShow lands on ActiveCallDTMF', () => {
        const ws = createMockWs();
        phoneApp.handleSelectDtmfShow(ws);
        assert.deepEqual(contextPaths(ws), ['phone/ActiveCallDTMF']);
    });

    it('handleSelectRecentCallsToggle switches between All and Missed tabs', () => {
        const ws = createMockWs();
        phoneApp.handleSelectCallHistory(ws);

        phoneApp.events.SelectRecentCallsToggle(ws, { payload: { recentTab: 2 } });
        const lastMsg = ws.messages.find(
            (m) =>
                m.msgType === 'ctxtChg' &&
                m.params &&
                m.params.payload &&
                m.params.payload.recentTab === 2
        );
        assert.ok(lastMsg);
        assert.equal(lastMsg.ctxtId, 'RecentCalls');

        phoneApp.events.SelectRecentCallsToggle(ws, { payload: { recentTab: 1 } });
        const allMsg = ws.messages.find(
            (m) =>
                m.msgType === 'ctxtChg' &&
                m.params &&
                m.params.payload &&
                m.params.payload.recentTab === 1
        );
        assert.ok(allMsg);
    });

    it('CallRecent and CallRecentByLine start an active call for the selected number', () => {
        const ws = createMockWs();
        phoneApp.events.CallRecent(ws, { payload: { phoneNumber: '555-0123' } });
        assert.deepEqual(contextPaths(ws).slice(-1), ['phone/ActiveCall']);
        assert.equal(phoneApp.getCallState().callerName, 'Bob Smith');
        assert.equal(phoneApp.getCallState().callerNumber, '555-0123');
    });
});
