const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const logger = require('../../logger');

let activeCallState = 'Idle'; // 'Idle', 'Connecting', 'ActiveCall'
let callerName = 'John Doe';
let callerNumber = '555-0142';
let isMuted = false;

function sendPhoneMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'phone',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('phone', 'Sent message msgId=%s', msgId);
}

function sendActiveCallInfo(ws) {
    sendPhoneMsg(ws, 'ActiveCallInfo', {
        activeCallInfoMsg: {
            type: activeCallState === 'Idle' ? 'ActiveCall' : activeCallState,
            callId: 'call1',
            cmuorphone: 'Vehicle',
            mute: isMuted ? 'Unmute' : 'Mute',
            phoneNumber: callerNumber,
            contactName: callerName
        }
    });
}

function handleSelectPhone(ws) {
    sendPhoneMsg(ws, 'PbConnectStatus', { connStatus: 'connected', deviceId: 1, status: true });
    sendPhoneMsg(ws, 'DbGreyOut', { ContactsDb: false, CallHistoryDb: false });
    sendContextChange(ws, 'phone', 'DialPad');
}

function handleSelectCallHistory(ws) {
    sendPhoneMsg(ws, 'PbConnectStatus', { connStatus: 'connected', deviceId: 1, status: true });
    sendPhoneMsg(ws, 'DbGreyOut', { ContactsDb: false, CallHistoryDb: false });
    sendContextChange(ws, 'phone', 'RecentCalls');
}

function handleSelectRecentCallsToggle(ws, params) {
    const tab = params && params.payload && params.payload.recentTab ? params.payload.recentTab : 1;
    const stack = navigationState.goBackStack;
    const skipGoBack =
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'phone' &&
        stack[stack.length - 1].ctxtId === 'RecentCalls';
    if (skipGoBack) {
        stack[stack.length - 1].params = { payload: { recentTab: tab } };
    }
    sendContextChange(
        ws,
        'phone',
        'RecentCalls',
        { payload: { recentTab: tab } },
        undefined,
        skipGoBack
    );
}

function handleCallDialpadNumber(ws, params) {
    activeCallState = 'ActiveCall';
    if (params && params.payload && params.payload.number) {
        callerNumber = params.payload.number;
    }
    const systemApp = require('./systemApp');
    systemApp.sendPhoneCallStatus(ws, 'ActiveCall');

    sendActiveCallInfo(ws);
    sendContextChange(ws, 'phone', 'ActiveCall');
}

function handleSelectActiveCall(ws) {
    sendActiveCallInfo(ws);
    sendContextChange(ws, 'phone', 'ActiveCall');
}

function handleHangUpCall(ws) {
    activeCallState = 'Idle';
    const systemApp = require('./systemApp');
    systemApp.sendPhoneCallStatus(ws, 'Idle');
    sendPhoneMsg(ws, 'NoCallState', {});
    sendContextChange(ws, 'system', 'Communication');
}

function handleSelectDtmfShow(ws) {
    sendContextChange(ws, 'phone', 'ActiveCallDTMF');
}

function handleToggleMute(ws) {
    isMuted = !isMuted;
    sendPhoneMsg(ws, 'MuteStatus', { mute: isMuted ? 'on' : 'off' });
}

function triggerSimulatedCall(ws, name, number) {
    activeCallState = 'ActiveCall';
    if (name) callerName = name;
    if (number) callerNumber = number;
    const systemApp = require('./systemApp');
    systemApp.sendPhoneCallStatus(ws, 'ActiveCall');
    sendActiveCallInfo(ws);
    sendContextChange(ws, 'phone', 'ActiveCall');
}

function findCallerNameByNumber(phoneNumber) {
    if (!phoneNumber) return '';
    const mockDbapi = require('../../services/mockDbapi');
    const contact = mockDbapi
        .getContactsList()
        .find((c) => c.numbers.some((n) => n.number === phoneNumber));
    if (contact) return contact.displayName;
    const history = mockDbapi.SEEDED_CALL_HISTORY.find((h) => h.number === phoneNumber);
    return history ? history.displayName : '';
}

function handleCallRecent(ws, params) {
    const phoneNumber =
        params && params.payload && params.payload.phoneNumber ? params.payload.phoneNumber : '';
    const name = findCallerNameByNumber(phoneNumber) || phoneNumber || 'Unknown';
    triggerSimulatedCall(ws, name, phoneNumber);
}

const events = {
    CallDialpadNumber: (ws, params) => handleCallDialpadNumber(ws, params),
    CallRecent: (ws, params) => handleCallRecent(ws, params),
    CallRecentByLine: (ws, params) => handleCallRecent(ws, params),
    SelectEndCall: (ws) => handleHangUpCall(ws),
    HangUpCall: (ws) => handleHangUpCall(ws),
    SelectMuteCall: (ws) => handleToggleMute(ws),
    SelectDtmfShow: (ws) => handleSelectDtmfShow(ws),
    SelectRecentCallsToggle: (ws, params) => handleSelectRecentCallsToggle(ws, params)
};

module.exports = {
    events,
    handleSelectPhone,
    handleSelectCallHistory,
    handleSelectRecentCallsToggle,
    handleCallDialpadNumber,
    handleCallRecent,
    handleSelectActiveCall,
    handleHangUpCall,
    handleSelectDtmfShow,
    handleToggleMute,
    triggerSimulatedCall,
    sendActiveCallInfo,
    sendPhoneMsg,
    getCallState: () => ({ activeCallState, callerName, callerNumber, isMuted }),
    setCallState: (newState) => {
        if (newState.activeCallState !== undefined) activeCallState = newState.activeCallState;
        if (newState.callerName !== undefined) callerName = newState.callerName;
        if (newState.callerNumber !== undefined) callerNumber = newState.callerNumber;
        if (newState.isMuted !== undefined) isMuted = newState.isMuted;
    }
};
