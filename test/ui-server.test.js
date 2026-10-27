const test = require('node:test');
const assert = require('node:assert/strict');

const uiServer = require('../server/ui-server');

test('resolveSafePath keeps normalized paths inside the project root', () => {
    assert.match(uiServer.resolveSafePath('/../../etc/passwd'), /^\/home\/dev\/mzd\//);
});

test('resolveSafePath rejects malformed encoded paths', () => {
    assert.throws(() => uiServer.resolveSafePath('/%E0%A4%A'), URIError);
});

test('getContentType returns a safe fallback for unknown extensions', () => {
    assert.equal(uiServer.getContentType('/file.bin'), 'application/octet-stream');
});

test('the emulator controls script is injected only when runtime.json enables it', () => {
    const runtime = require('../server/config/runtime.json');
    const saved = runtime.emulatorControls;
    const html = '<html><head></head><body></body></html>';
    try {
        runtime.emulatorControls = false;
        assert.ok(!uiServer.injectPolyfills(html).includes('ui-controls.js'));
        assert.ok(uiServer.injectPolyfills(html).includes('ui-wayland.js'));

        runtime.emulatorControls = true;
        assert.ok(uiServer.injectPolyfills(html).includes('ui-controls.js'));
    } finally {
        runtime.emulatorControls = saved;
    }
});

test('the emulator controls are off by default', () => {
    assert.equal(require('../server/config/runtime.json').emulatorControls, false);
});
