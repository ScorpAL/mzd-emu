const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const protocol = require('./protocol');
const { createMockWs } = require('../testing/mockWs');
const { useCleanState, backStackPaths } = require('../testing/state');

describe('protocol', () => {
    useCleanState();

    it('withSeqByte appends the sequence byte, modulo 128', () => {
        assert.equal(protocol.withSeqByte('message', 130), `message${String.fromCharCode(2)}`);
        assert.equal(protocol.withSeqByte('m', 5), `m${String.fromCharCode(5)}`);
    });

    describe('sendContextChange', () => {
        it('sends the firmware frame sequence, every frame with the same sequence byte', () => {
            const raw = [];
            protocol.sendContextChange({ send: (frame) => raw.push(frame) }, 'system', 'Home', {
                a: 1
            });
            assert.equal(raw.length, 4);
            assert.equal(new Set(raw.map((frame) => frame.at(-1))).size, 1);
            const frames = raw.map((frame) => JSON.parse(frame.slice(0, -1)));
            assert.deepEqual(
                frames.map((f) => f.msgType),
                ['transition', 'ctxtChg', 'focusStack', 'transition']
            );
            assert.deepEqual([frames[0].enabled, frames[3].enabled], [true, false]);
            assert.equal(frames[1].ctxtId, 'Home');
            assert.deepEqual(frames[1].params, { a: 1 });
            assert.deepEqual(frames[2].appIdList, [{ id: 'system' }, { id: 1 }]);
        });

        it('numbers the contexts it sends, unless the caller gives a number', () => {
            const ws = createMockWs();
            protocol.sendContextChange(ws, 'system', 'A');
            protocol.sendContextChange(ws, 'system', 'B');
            protocol.sendContextChange(ws, 'system', 'C', undefined, 77);
            const seqs = ws.messages
                .filter((m) => m.msgType === 'ctxtChg')
                .map((m) => m.contextSeq);
            assert.equal(seqs[1], seqs[0] + 1);
            assert.equal(seqs[2], 77);
        });

        it('pushes the screens of the emulated applications on the back stack', () => {
            const ws = createMockWs();
            protocol.sendContextChange(ws, 'syssettings', 'DisplayTab');
            protocol.sendContextChange(ws, 'stitcher', 'Loading');
            protocol.sendContextChange(ws, 'system', 'SystemWarning', undefined, undefined, true);
            assert.deepEqual(backStackPaths(), ['syssettings/DisplayTab']);
        });
    });
});
