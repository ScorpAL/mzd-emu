const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const mockDbapi = require('./mockDbapi');
const mockAppsdk = require('./mockAppsdk');

function createCaptureWs() {
    return {
        sent: [],
        send(msg) {
            this.sent.push(JSON.parse(msg));
        }
    };
}

describe('mockDbapi', () => {
    it('handles OpenCallHistoryDb and CloseCallHistoryDb', () => {
        const ws = createCaptureWs();
        mockDbapi.handleMessage(ws, {
            msgType: 'method',
            msgContent: { api: 'pb', methodName: 'OpenCallHistoryDb', reqId: 10 }
        });
        assert.equal(ws.sent.length, 1);
        assert.equal(ws.sent[0].msgType, 'methodResponse');
        assert.equal(ws.sent[0].msgContent.params.eCode, 0);
    });

    it('handles GetCallHistory returning call histories', () => {
        const ws = createCaptureWs();
        mockDbapi.handleMessage(ws, {
            msgType: 'method',
            msgContent: {
                api: 'pb',
                methodName: 'GetCallHistory',
                reqId: 11,
                params: { category: 'LastAll' }
            }
        });
        assert.equal(ws.sent.length, 1);
        const res = ws.sent[0].msgContent;
        assert.equal(res.params.eCode, 0);
        assert.ok(res.params.callHistories.length > 0);
        assert.ok(res.params.callHistories[0].number);
        assert.ok(res.params.callHistories[0].displayName);
    });

    it('handles FmStationList returning stations', () => {
        const ws = createCaptureWs();
        mockDbapi.handleMessage(ws, {
            msgType: 'method',
            msgContent: { api: 'radio', methodName: 'FmStationList', reqId: 12 }
        });
        assert.equal(ws.sent.length, 1);
        const res = ws.sent[0].msgContent;
        assert.equal(res.params.eCode, 0);
        assert.ok(res.params.stationList.length > 0);
        assert.ok(res.params.stationList[0].stationName);
    });

    it('handles GetContacts and GetContactDetails with generated SVG avatars and placeholder fallback', () => {
        const ws = createCaptureWs();
        mockDbapi.handleMessage(ws, {
            msgType: 'method',
            msgContent: { api: 'pb', methodName: 'GetContacts', reqId: 13 }
        });
        mockDbapi.handleMessage(ws, {
            msgType: 'method',
            msgContent: {
                api: 'pb',
                methodName: 'GetContactDetails',
                reqId: 14,
                params: { contactId: 1 }
            }
        });
        mockDbapi.handleMessage(ws, {
            msgType: 'method',
            msgContent: {
                api: 'pb',
                methodName: 'GetContactDetails',
                reqId: 15,
                params: { contactId: 6 }
            }
        });

        assert.equal(ws.sent.length, 3);
        const list = ws.sent[0].msgContent.params.contacts;
        assert.ok(list[0].ctoPath.startsWith('data:image/svg+xml;base64,'));
        assert.equal(list[5].ctoPath, '');

        const details1 = ws.sent[1].msgContent.params;
        assert.ok(details1.ctoPath.startsWith('data:image/svg+xml;base64,'));
        assert.equal(ws.sent[2].msgContent.params.ctoPath, '');
    });
});

describe('mockAppsdk', () => {
    it('handles Connect and responds with status 100', () => {
        const ws = createCaptureWs();
        mockAppsdk.handleMessage(ws, {
            msgType: 'method',
            serviceName: 'msg',
            methodName: 'Connect',
            reqId: 20
        });
        assert.equal(ws.sent.length, 1);
        const res = ws.sent[0];
        assert.equal(res.msgType, 'methodResponse');
        assert.equal(res.serviceName, 'msg');
        assert.equal(res.methodName, 'Connect');
        assert.equal(res.params.status, 100);
        assert.equal(res.params.connection, 1);
    });

    it('handles GetMessageList and responds with messages and status 100', () => {
        const ws = createCaptureWs();
        mockAppsdk.handleMessage(ws, {
            msgType: 'method',
            serviceName: 'msg',
            methodName: 'GetMessageList',
            reqId: 21
        });
        assert.equal(ws.sent.length, 1);
        const res = ws.sent[0];
        assert.equal(res.msgType, 'methodResponse');
        assert.equal(res.params.status, 100);
        assert.ok(res.params.message_list);
        assert.ok(res.params.message_list.messages.length > 0);
        assert.ok(res.params.message_list.messages[0].sender);
    });

    it('handles GetPresetMessageList with status 100', () => {
        const ws = createCaptureWs();
        mockAppsdk.handleMessage(ws, {
            msgType: 'method',
            serviceName: 'msg',
            methodName: 'GetPresetMessageList',
            reqId: 22
        });
        assert.equal(ws.sent.length, 1);
        const res = ws.sent[0];
        assert.equal(res.msgType, 'methodResponse');
        assert.equal(res.params.status, 100);
        assert.ok(res.params.list.presetMessages.length > 0);
    });

    it('updatePresetMessage updates text of preset messages', () => {
        mockAppsdk.updatePresetMessage(2, 'See you tomorrow!');
        assert.equal(mockAppsdk.PRESET_MESSAGES[1].text, 'See you tomorrow!');
    });
});
