const net = require('node:net');
const WebSocket = require('ws');

const { parseFrame } = require('./mockWs');

// Opens a real WebSocket client to localhost:`port` and collects what the server sends.
// `next(predicate)` resolves with the first message (parsed, see parseFrame) that matches, whether
// it already arrived or arrives later; it rejects if the connection closes first, so a test fails
// at once instead of hanging. The client is terminated when test `t` ends.
async function connect(t, port) {
    const client = new WebSocket(`ws://localhost:${port}`);
    const received = [];
    const waiters = [];
    let closed = false;
    const settle = (waiter, message) => {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
    };
    client.on('message', (raw) => {
        const message = parseFrame(raw);
        received.push(message);
        waiters.filter((waiter) => waiter.predicate(message)).forEach((w) => settle(w, message));
    });
    client.on('close', () => {
        closed = true;
        waiters.splice(0).forEach((waiter) => waiter.reject(new Error('the connection closed')));
    });
    // Errors also end in 'close' (handled above); only one before 'open' fails connect().
    client.on('error', () => {});
    t.after(() => client.terminate());
    await new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
    });
    return {
        client,
        received,
        send: (data) => client.send(typeof data === 'string' ? data : JSON.stringify(data)),
        next(predicate) {
            const found = received.find(predicate);
            if (found) {
                return Promise.resolve(found);
            }
            if (closed) {
                return Promise.reject(new Error('the connection closed'));
            }
            return new Promise((resolve, reject) => waiters.push({ predicate, resolve, reject }));
        },
        closed: () =>
            closed ? Promise.resolve() : new Promise((resolve) => client.once('close', resolve))
    };
}

// Listens on a free port as a stand-in for another program holding it; closed when `t` ends.
async function occupyPort(t) {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    return server.address().port;
}

module.exports = { connect, occupyPort };
