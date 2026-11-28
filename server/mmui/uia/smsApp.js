const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const mockAppsdk = require('../../services/mockAppsdk');
const mockDbapi = require('../../services/mockDbapi');
const logger = require('../../logger');

const DEFAULT_SMS_DETAIL = {
    name: 'Express Delivery',
    datetime: 'Nov 24, 08:05',
    body: 'Your package PKG92837410 will be delivered today. Use pickup code: 482910.',
    instance: { instanceID: 1 },
    OPTION_Reply: true,
    OPTION_Delete: true,
    OPTION_Call: true
};

let currentMessageId = 1;
let currentSenderName = DEFAULT_SMS_DETAIL.name;

function sendSmsMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'sms',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('sms', 'Sent message msgId=%s', msgId);
}

function sendConversationPayload(ws, detail) {
    sendSmsMsg(ws, 'SelectConversationPayload', {
        messageDisplay: detail || DEFAULT_SMS_DETAIL
    });
}

function sendDownloadedMessagesPayload(ws) {
    sendSmsMsg(ws, 'DownloadedMessagesPayload', {
        messageList: {
            instanceID: 1,
            sender: { typeMask: 0, contactID: 0 },
            isMsgDisambiguate: false
        }
    });
}

function handleSelectSms(ws) {
    const stack = navigationState.goBackStack;
    if (
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'sms' &&
        stack[stack.length - 1].ctxtId === 'SMSMessageDetail'
    ) {
        stack.pop();
    }
    const alreadyInbox =
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'sms' &&
        stack[stack.length - 1].ctxtId === 'SMSInbox';
    sendSmsMsg(ws, 'AutoDownloadStatus', { Status: true });
    sendSmsMsg(ws, 'NotificationPayload', {
        notifyPayload: { NotificationType: 'NOTIFICATION_TYPE_MAP_CONNECTED' }
    });
    sendDownloadedMessagesPayload(ws);
    sendContextChange(ws, 'sms', 'SMSInbox', undefined, undefined, alreadyInbox);
}

function handleImportMessages(ws) {
    sendDownloadedMessagesPayload(ws);
}

function buildDetailForMessage(msg) {
    if (!msg) return DEFAULT_SMS_DETAIL;
    const contact = mockDbapi.getContactsList().find((c) => c.displayName === msg.name);
    return {
        name: msg.name || msg.sender,
        datetime: 'Nov 24, 08:05',
        body: msg.body,
        senderPhotoPath: contact ? mockDbapi.generateContactAvatar(contact.contactId, 116) : '',
        instance: { instanceID: 1 },
        OPTION_Reply: true,
        OPTION_Delete: true,
        OPTION_Call: true
    };
}

function findNumberForSender(senderName) {
    const contact = mockDbapi.getContactsList().find((c) => c.displayName === senderName);
    if (contact && contact.numbers && contact.numbers.length > 0) {
        return contact.numbers[0].number;
    }
    const history = mockDbapi.SEEDED_CALL_HISTORY.find((h) => h.displayName === senderName);
    return history ? history.number : '555-0190';
}

function handleSelectConversation(ws, paramsOrDetail) {
    let detail = DEFAULT_SMS_DETAIL;
    if (paramsOrDetail && paramsOrDetail.payload && paramsOrDetail.payload.conversation != null) {
        const id = paramsOrDetail.payload.conversation;
        const msg =
            mockAppsdk.getMessagesList().find((m) => m.id === id) ||
            mockAppsdk.getMessagesList()[0];
        if (msg) {
            currentMessageId = msg.id;
            currentSenderName = msg.name || msg.sender;
            detail = buildDetailForMessage(msg);
        }
    } else if (paramsOrDetail && paramsOrDetail.body) {
        detail = paramsOrDetail;
        currentSenderName = detail.name || DEFAULT_SMS_DETAIL.name;
    }
    sendConversationPayload(ws, detail);
    sendContextChange(ws, 'sms', 'SMSMessageDetail');
}

function handleCallPhoneNumber(ws) {
    const phoneApp = require('./phoneApp');
    const number = findNumberForSender(currentSenderName);
    phoneApp.triggerSimulatedCall(ws, currentSenderName, number);
}

function handleSelectReply(ws) {
    sendContextChange(ws, 'sms', 'SMSReply');
}

function handleSelectPresetMessages(ws) {
    sendContextChange(ws, 'sms', 'PresetMessages');
}

function handleDelete(ws) {
    const stack = navigationState.goBackStack;
    const onConfirm =
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'sms' &&
        stack[stack.length - 1].ctxtId === 'SMSDeleteConfirm';
    if (onConfirm) {
        mockAppsdk.deleteMessage(currentMessageId);
        stack.pop();
        if (
            stack.length > 0 &&
            stack[stack.length - 1].uiaId === 'sms' &&
            stack[stack.length - 1].ctxtId === 'SMSMessageDetail'
        ) {
            stack.pop();
        }
        const alreadyInbox =
            stack.length > 0 &&
            stack[stack.length - 1].uiaId === 'sms' &&
            stack[stack.length - 1].ctxtId === 'SMSInbox';
        sendDownloadedMessagesPayload(ws);
        sendContextChange(ws, 'sms', 'SMSInbox', undefined, undefined, alreadyInbox);
        return;
    }
    sendContextChange(ws, 'sms', 'SMSDeleteConfirm');
}

const events = {
    SelectInbox: (ws) => handleSelectSms(ws),
    SelectConversation: (ws, params) => handleSelectConversation(ws, params),
    CallPhoneNumber: (ws) => handleCallPhoneNumber(ws),
    SelectReply: (ws) => handleSelectReply(ws),
    SelectPresetMessages: (ws, _params, uiaId) => {
        if (uiaId === 'syssettings') {
            const syssettingsApp = require('./syssettingsApp');
            syssettingsApp.handleSelectPresetMessages(ws);
        } else {
            handleSelectPresetMessages(ws);
        }
    },
    Delete: (ws) => handleDelete(ws),
    ImportMessages: (ws) => handleImportMessages(ws)
};

module.exports = {
    events,
    handleSelectSms,
    handleImportMessages,
    handleSelectConversation,
    handleCallPhoneNumber,
    handleSelectReply,
    handleSelectPresetMessages,
    handleDelete,
    sendConversationPayload,
    sendDownloadedMessagesPayload,
    sendSmsMsg,
    DEFAULT_SMS_DETAIL
};
