const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { ivfDurationMs } = require('./splashVideo');

// A Duck IVF file: a 32-byte header with the time base, then frames of a 12-byte header
// (size, 64-bit timestamp) and `size` bytes of data.
function ivf({ signature = 'DKIF', timebase = [1000, 1], timestamps = [] } = {}) {
    const header = Buffer.alloc(32);
    header.write(signature, 0, 'latin1');
    header.writeUInt16LE(32, 6);
    header.writeUInt32LE(timebase[0], 16);
    header.writeUInt32LE(timebase[1], 20);
    const frames = timestamps.map((pts) => {
        const frame = Buffer.alloc(12 + 3);
        frame.writeUInt32LE(3, 0);
        frame.writeBigUInt64LE(BigInt(pts), 4);
        return frame;
    });
    return Buffer.concat([header, ...frames]);
}

describe('splashVideo', () => {
    describe('ivfDurationMs', () => {
        it('measures the firmware boot video', () => {
            const ms = ivfDurationMs('TranLogo.ivf');
            assert.ok(ms >= 4900 && ms <= 5100, `unexpected duration ${ms}`);
        });

        it('is the last timestamp plus one frame', (t) => {
            t.mock.method(fs, 'readFileSync', () => ivf({ timestamps: [0, 40, 80] }));
            assert.equal(ivfDurationMs('any.ivf'), 120);
        });

        it('uses the time base of the file', (t) => {
            // 30 frames per second: a timestamp counts 1/30 s.
            t.mock.method(fs, 'readFileSync', () =>
                ivf({ timebase: [30, 1], timestamps: [0, 1, 2] })
            );
            assert.equal(ivfDurationMs('any.ivf'), 100);
        });

        it('a single frame lasts 0 ms after its timestamp', (t) => {
            t.mock.method(fs, 'readFileSync', () => ivf({ timestamps: [500] }));
            assert.equal(ivfDurationMs('any.ivf'), 500);
        });

        it('returns null for a missing file or one that is not a usable IVF', (t) => {
            assert.equal(ivfDurationMs('DoesNotExist.ivf'), null);
            assert.equal(ivfDurationMs('Mazda.png'), null);
            for (const data of [
                Buffer.alloc(10),
                ivf({ signature: 'RIFF', timestamps: [0] }),
                ivf({ timebase: [0, 1], timestamps: [0] }),
                ivf({ timestamps: [] })
            ]) {
                t.mock.method(fs, 'readFileSync', () => data);
                assert.equal(ivfDurationMs('any.ivf'), null);
                t.mock.restoreAll();
            }
        });
    });
});
