const logger = require('../logger');
const settings = require('../mmui/services/settings');

const SEEDED_MESSAGES = [
    {
        id: 1,
        sender: 'Express Delivery',
        name: 'Express Delivery',
        senderPhotoPath: '',
        datetime: 1732440300,
        status: 2,
        body: 'Your package PKG92837410 will be delivered today. Use pickup code: 482910.',
        readStatus: 'READ',
        messageType: 'SMS'
    },
    {
        id: 2,
        sender: 'Bob Smith',
        name: 'Bob Smith',
        senderPhotoPath: '',
        datetime: 1732436700,
        status: 1,
        body: 'Hey, are we still meeting today at 5 PM?',
        readStatus: 'UNREAD',
        messageType: 'SMS'
    }
];

const PRESET_MESSAGES = [
    { id: 1, text: 'I will be there in 5 minutes.' },
    { id: 2, text: 'I will call you back later.' },
    { id: 3, text: 'I am driving right now.' },
    { id: 4, text: 'Please call me when you can.' }
];

const PRESET_TEXTS = PRESET_MESSAGES.map((m) => m.text);

let activeMessages = SEEDED_MESSAGES.map((m) => ({ ...m }));

function getMessagesList() {
    return settings.HARDWARE_CONFIG.smsData === 'On' ? activeMessages : [];
}

function deleteMessage(id) {
    const before = activeMessages.length;
    activeMessages = activeMessages.filter((m) => m.id !== id);
    return activeMessages.length !== before;
}

function resetMessages() {
    activeMessages = SEEDED_MESSAGES.map((m) => ({ ...m }));
}

function updatePresetMessage(msgIndex, newText) {
    const index = msgIndex - 1;
    if (index >= 0 && index < PRESET_MESSAGES.length) {
        PRESET_MESSAGES[index].text = newText;
        PRESET_TEXTS[index] = newText;
    }
}

function handleMessage(ws, data) {
    const content = data.msgContent || data;
    if (!content || typeof content !== 'object') {
        return;
    }

    const { serviceName, methodName, reqId } = content;
    let responseParams = { status: 100, eCode: 0 };

    if (serviceName === 'msg') {
        if (methodName === 'Connect') {
            responseParams = {
                status: 100,
                connection: 1
            };
        } else if (methodName === 'GetMessageList') {
            const messages = getMessagesList();
            responseParams = {
                status: 100,
                message_list: {
                    totalMessagesCount: messages.length,
                    newMessagesAvailable: false,
                    messages: messages
                },
                totalCount: messages.length,
                count: messages.length,
                offset: 0,
                messageList: messages
            };
        } else if (methodName === 'GetPresetMessageList') {
            responseParams = {
                status: 100,
                list: {
                    presetMessagesCount: PRESET_TEXTS.length,
                    presetMessages: PRESET_TEXTS
                },
                presetMessagesCount: PRESET_TEXTS.length,
                presetMessages: PRESET_TEXTS
            };
        }
    }

    const response = {
        msgType: 'methodResponse',
        serviceName: serviceName,
        methodName: methodName,
        reqId: reqId,
        params: responseParams
    };

    try {
        ws.send(JSON.stringify(response));
        logger.debug(
            'appsdk',
            'Sent methodResponse for %s.%s (reqId=%s)',
            serviceName,
            methodName,
            reqId
        );
    } catch (err) {
        logger.error('appsdk', 'Failed to send methodResponse: %s', err.message);
    }
}

module.exports = {
    handleMessage,
    getMessagesList,
    deleteMessage,
    resetMessages,
    SEEDED_MESSAGES,
    PRESET_MESSAGES,
    updatePresetMessage
};
