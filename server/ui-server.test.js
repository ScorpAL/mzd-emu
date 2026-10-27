const test = require('node:test');
const assert = require('node:assert/strict');

const uiServer = require('./ui-server');

test('only the jci and emulator mounts are reachable', () => {
    assert.match(uiServer.resolveRequestPath('/jci/gui/index.html'), /\/jci\/gui\/index\.html$/);
    assert.match(
        uiServer.resolveRequestPath('/emulator/ui-wayland.js'),
        /\/client\/ui-wayland\.js$/
    );
    for (const url of [
        '/',
        '/package.json',
        '/.git/config',
        '/server/data/user-settings.json',
        '/server/config/runtime.json',
        '/jci/../package.json',
        '/emulator/../server/ui-server.js',
        '/%2e%2e/package.json'
    ]) {
        assert.equal(uiServer.resolveRequestPath(url), null, url);
    }
});

test('resolveRequestPath rejects malformed encoded paths', () => {
    assert.throws(() => uiServer.resolveRequestPath('/jci/%E0%A4%A'), URIError);
});

test('the server answers 404 outside the mounts and exposes only controlPort', async () => {
    const server = uiServer.createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
        assert.equal((await fetch(base + '/package.json')).status, 404);
        assert.equal((await fetch(base + '/server/ui-server.js')).status, 404);
        assert.equal((await fetch(base + '/emulator/ui-wayland.js')).status, 200);
        const runtime = await (await fetch(base + '/emulator/runtime.json')).json();
        assert.deepEqual(Object.keys(runtime), ['controlPort']);
        const gui = await (await fetch(base + '/jci/gui/index.html')).text();
        assert.ok(gui.includes('/emulator/ui-wayland.js'));
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('getContentType returns a safe fallback for unknown extensions', () => {
    assert.equal(uiServer.getContentType('/file.bin'), 'application/octet-stream');
});

test('the emulator controls script is injected only when runtime.json enables it', () => {
    const runtime = require('./config/runtime.json');
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
    assert.equal(require('./config/runtime.json').emulatorControls, false);
});
