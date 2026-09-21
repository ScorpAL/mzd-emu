const test = require('node:test');
const assert = require('node:assert/strict');

const btpairingApp = require('../server/mmui/btpairingApp');
const navigationState = require('../server/mmui/navigationState');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
});

test('cancelling Discoverable returns to Bluetooth connection manager', () => {
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'BTConnectionManager',
        contextSeq: 1
    });
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'Discoverable',
        contextSeq: 2
    });

    const messages = [];
    const handled = btpairingApp.handleCancel({
        send(message) {
            messages.push(message);
        }
    });

    assert.equal(handled, true);
    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(navigationState.goBackStack[0].ctxtId, 'BTConnectionManager');
    assert.equal(messages.length, 4);
    assert.equal(JSON.parse(messages[1].slice(0, -1)).ctxtId, 'BTConnectionManager');
});

test('cancelling another Bluetooth context is ignored', () => {
    navigationState.goBackStack.push({
        uiaId: 'btpairing',
        ctxtId: 'BTConnectionManager',
        contextSeq: 1
    });

    assert.equal(
        btpairingApp.handleCancel({
            send() {}
        }),
        false
    );
});
