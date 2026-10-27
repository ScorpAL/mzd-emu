// Shared fake WebSocket used across tests. Collects every sent frame as a
// parsed message (protocol.js's sequence byte, if present, is stripped
// before parsing) so tests can assert on msgType/msgId/payload directly.
function createMockWs() {
    const messages = [];
    return {
        messages: messages,
        send(raw) {
            try {
                messages.push(JSON.parse(raw));
            } catch {
                // protocol.js appends one extra sequence byte after the JSON payload.
                messages.push(JSON.parse(raw.slice(0, -1)));
            }
        }
    };
}

module.exports = { createMockWs: createMockWs };
