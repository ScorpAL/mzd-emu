// Parses one frame the MMUI sends to the GUI. protocol.js appends one extra sequence byte after
// the JSON of context changes; plain messages have none.
function parseFrame(raw) {
    const text = String(raw);
    try {
        return JSON.parse(text);
    } catch {
        return JSON.parse(text.slice(0, -1));
    }
}

// Shared fake WebSocket used across tests. Collects every sent frame as a
// parsed message so tests can assert on msgType/msgId/payload directly.
// Services that watch for 'close' (temperatureService, the cold start and
// Stitcher timers) can hook it with once(); close() runs those hooks, like a
// GUI that disconnects.
function createMockWs() {
    const messages = [];
    const onClose = [];
    return {
        messages: messages,
        once(event, listener) {
            if (event === 'close') {
                onClose.push(listener);
            }
        },
        close() {
            onClose.splice(0).forEach((listener) => listener());
        },
        send(raw) {
            messages.push(parseFrame(raw));
        }
    };
}

// The ctxtIds of every context change sent, in order.
function contexts(ws) {
    return ws.messages.filter((m) => m.msgType === 'ctxtChg').map((m) => m.ctxtId);
}

// The same as "uiaId/ctxtId", for tests that cross applications.
function contextPaths(ws) {
    return ws.messages.filter((m) => m.msgType === 'ctxtChg').map((m) => `${m.uiaId}/${m.ctxtId}`);
}

// The msgIds of every plain message (msgType "msg") sent, in order.
function msgIds(ws) {
    return ws.messages.filter((m) => m.msgType === 'msg').map((m) => m.msgId);
}

// The first message with this msgId, or undefined.
function messageOf(ws, msgId) {
    return ws.messages.find((m) => m.msgId === msgId);
}

// The payload of the first message with this msgId (fails loudly if there is none).
function payloadOf(ws, msgId) {
    const message = messageOf(ws, msgId);
    if (!message) {
        throw new Error(`no ${msgId} message was sent; sent: ${msgIds(ws).join(', ')}`);
    }
    return message.params.payload;
}

module.exports = {
    parseFrame,
    createMockWs,
    contexts,
    contextPaths,
    msgIds,
    messageOf,
    payloadOf
};
