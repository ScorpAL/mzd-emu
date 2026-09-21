const test = require('node:test');
const assert = require('node:assert/strict');

const protocol = require('../server/mmui/protocol');

test('withSeqByte appends the protocol sequence byte', () => {
    assert.equal(protocol.withSeqByte('message', 130), `message${String.fromCharCode(2)}`);
});

test('sendContextChange sends the firmware message sequence', () => {
    const messages = [];
    protocol.sendContextChange(
        {
            send(message) {
                messages.push(message);
            }
        },
        'system',
        'Home'
    );

    assert.equal(messages.length, 4);
    assert.equal(JSON.parse(messages[0].slice(0, -1)).msgType, 'transition');
    assert.equal(JSON.parse(messages[1].slice(0, -1)).msgType, 'ctxtChg');
    assert.equal(JSON.parse(messages[2].slice(0, -1)).msgType, 'focusStack');
});
