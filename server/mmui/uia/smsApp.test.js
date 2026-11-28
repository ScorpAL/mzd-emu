const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const smsApp = require('./smsApp');
const { createMockWs, contextPaths, msgIds } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

describe('smsApp', () => {
    useCleanState();

    it('handleSelectSms lands on SMSInbox context and preloads messages', () => {
        const ws = createMockWs();
        smsApp.handleSelectSms(ws);
        assert.deepEqual(contextPaths(ws), ['sms/SMSInbox']);
        const ids = msgIds(ws);
        assert.ok(ids.includes('AutoDownloadStatus'));
        assert.ok(ids.includes('NotificationPayload'));
        assert.ok(ids.includes('DownloadedMessagesPayload'));
    });

    it('handleImportMessages re-sends DownloadedMessagesPayload', () => {
        const ws = createMockWs();
        smsApp.handleImportMessages(ws);
        assert.ok(msgIds(ws).includes('DownloadedMessagesPayload'));
    });

    it('handleSelectConversation sends SelectConversationPayload and lands on SMSMessageDetail', () => {
        const ws = createMockWs();
        smsApp.handleSelectConversation(ws);

        assert.deepEqual(contextPaths(ws), ['sms/SMSMessageDetail']);
        assert.ok(msgIds(ws).includes('SelectConversationPayload'));

        const payloadMsg = ws.messages.find((m) => m.msgId === 'SelectConversationPayload');
        assert.equal(payloadMsg.params.payload.messageDisplay.name, 'Express Delivery');
        assert.ok(payloadMsg.params.payload.messageDisplay.body.includes('PKG92837410'));
    });

    it('handleSelectReply lands on SMSReply', () => {
        const ws = createMockWs();
        smsApp.handleSelectReply(ws);
        assert.deepEqual(contextPaths(ws), ['sms/SMSReply']);
    });

    it('handleSelectPresetMessages lands on PresetMessages', () => {
        const ws = createMockWs();
        smsApp.handleSelectPresetMessages(ws);
        assert.deepEqual(contextPaths(ws), ['sms/PresetMessages']);
    });

    it('handleDelete lands on SMSDeleteConfirm', () => {
        const ws = createMockWs();
        smsApp.handleDelete(ws);
        assert.deepEqual(contextPaths(ws), ['sms/SMSDeleteConfirm']);
    });

    it('SelectInbox event returns from SMSMessageDetail to SMSInbox', () => {
        const ws = createMockWs();
        smsApp.handleSelectSms(ws);
        smsApp.handleSelectConversation(ws);
        assert.deepEqual(contextPaths(ws).slice(-2), ['sms/SMSInbox', 'sms/SMSMessageDetail']);

        smsApp.events.SelectInbox(ws);
        assert.deepEqual(contextPaths(ws).slice(-1), ['sms/SMSInbox']);
    });

    it('CallPhoneNumber starts an active call for the current message sender', () => {
        const ws = createMockWs();
        smsApp.events.SelectConversation(ws, { payload: { conversation: 2 } });
        smsApp.events.CallPhoneNumber(ws);
        assert.deepEqual(contextPaths(ws).slice(-1), ['phone/ActiveCall']);
    });

    it('Delete from SMSDeleteConfirm removes the message and returns to SMSInbox', () => {
        const mockAppsdk = require('../../services/mockAppsdk');
        try {
            const ws = createMockWs();
            smsApp.handleSelectSms(ws);
            smsApp.events.SelectConversation(ws, { payload: { conversation: 1 } });
            smsApp.events.Delete(ws);
            assert.deepEqual(contextPaths(ws).slice(-1), ['sms/SMSDeleteConfirm']);

            smsApp.events.Delete(ws);
            assert.deepEqual(contextPaths(ws).slice(-1), ['sms/SMSInbox']);
            assert.equal(
                mockAppsdk.getMessagesList().some((m) => m.id === 1),
                false
            );
        } finally {
            mockAppsdk.resetMessages();
        }
    });
});
