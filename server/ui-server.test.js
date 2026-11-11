const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { Readable } = require('node:stream');

const uiServer = require('./ui-server');
const runtime = require('./config/runtime.json');
const { captureLogs } = require('./testing/logs');
const { occupyPort } = require('./testing/wsClient');

const PAGE = '<html><head></head><body></body></html>';

// Sends `rawPath` exactly as given: fetch() would normalize "/../" away before it reaches the
// server, hiding the attack.
function request(port, rawPath) {
    return new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: rawPath }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () =>
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: Buffer.concat(chunks).toString('utf8')
                })
            );
            res.on('error', reject);
        }).on('error', reject);
    });
}

function listen(server, port = 0) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, () => resolve(server.address().port));
    });
}

describe('ui-server', { timeout: 10000 }, () => {
    describe('resolveRequestPath', () => {
        it('maps the jci and emulator mounts to their directories', () => {
            assert.match(
                uiServer.resolveRequestPath('/jci/gui/index.html'),
                /\/jci\/gui\/index\.html$/
            );
            assert.match(
                uiServer.resolveRequestPath('/emulator/ui-wayland.js?v=1'),
                /\/client\/ui-wayland\.js$/
            );
        });

        it('reaches nothing outside the mounts', () => {
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

        it('throws on a malformed encoded path', () => {
            assert.throws(() => uiServer.resolveRequestPath('/jci/%E0%A4%A'), URIError);
        });
    });

    describe('getContentType', () => {
        it('knows the usual types, whatever the case of the extension', () => {
            assert.match(uiServer.getContentType('/a/B.JS'), /^application\/javascript/);
            assert.equal(uiServer.getContentType('/a/b.png'), 'image/png');
        });

        it('returns a safe fallback for unknown extensions', () => {
            assert.equal(uiServer.getContentType('/file.bin'), 'application/octet-stream');
        });
    });

    describe('injectPolyfills', () => {
        it('inserts the polyfills before </head>, whatever its case', () => {
            const html = uiServer.injectPolyfills('<html><HEAD></HEAD></html>');
            assert.ok(html.indexOf('ui-wayland.js') < html.indexOf('</HEAD>'));
        });

        it('adds the emulator controls script only when runtime.json enables it', (t) => {
            const saved = runtime.emulatorControls;
            t.after(() => {
                runtime.emulatorControls = saved;
            });
            runtime.emulatorControls = false;
            assert.ok(!uiServer.injectPolyfills(PAGE).includes('ui-controls.js'));
            runtime.emulatorControls = true;
            assert.ok(uiServer.injectPolyfills(PAGE).includes('ui-controls.js'));
        });

        it('leaves a page without </head> unchanged, with a warning', (t) => {
            const logs = captureLogs(t, 'warn');
            const html = '<html><body>no head here</body></html>';
            assert.equal(uiServer.injectPolyfills(html), html);
            assert.ok(logs.find({ level: 'warn', scope: 'ui-server', message: 'not found' }));
        });
    });

    describe('runtime settings', () => {
        it('the emulator controls are off by default', () => {
            assert.equal(runtime.emulatorControls, false);
        });

        it('the browser gets only the control port', () => {
            assert.deepEqual(JSON.parse(uiServer.clientRuntime()), {
                controlPort: runtime.controlPort
            });
        });
    });

    describe('serving', () => {
        const server = uiServer.createServer();
        let port;
        before(async () => {
            port = await listen(server);
        });
        after(() => new Promise((resolve) => server.close(resolve)));
        const get = (rawPath) => request(port, rawPath);

        it('serves the emulator files and the GUI with the polyfills injected', async () => {
            const script = await get('/emulator/ui-wayland.js');
            assert.equal(script.status, 200);
            assert.match(script.headers['content-type'], /^application\/javascript/);

            const gui = await get('/jci/gui/index.html');
            assert.equal(gui.status, 200);
            assert.ok(gui.body.includes('/emulator/ui-wayland.js'));
            assert.equal(Number(gui.headers['content-length']), Buffer.byteLength(gui.body));
        });

        it('answers the runtime settings uncached, with only the control port', async () => {
            const res = await get('/emulator/runtime.json?x=1');
            assert.equal(res.status, 200);
            assert.equal(res.headers['cache-control'], 'no-store');
            assert.deepEqual(Object.keys(JSON.parse(res.body)), ['controlPort']);
        });

        it('ignores a query string when serving and when deciding to inject', async () => {
            assert.equal((await get('/emulator/ui-wayland.js?cache=1')).status, 200);
            const gui = await get('/jci/gui/index.html?v=2');
            assert.ok(gui.body.includes('/emulator/ui-wayland.js'));
        });

        it('answers 404 outside the mounts, for a mount root, a directory and a missing file', async () => {
            for (const rawPath of [
                '/package.json',
                '/server/ui-server.js',
                '/jci/',
                '/jci/gui/',
                '/jci/gui/no-such-file.js',
                '/emulator/no-such-file.js'
            ]) {
                assert.equal((await get(rawPath)).status, 404, rawPath);
            }
        });

        it('never leaves the mounts for path traversal sent as raw HTTP', async () => {
            for (const rawPath of [
                '/jci/../package.json',
                '/jci/../../etc/passwd',
                '/jci/%2e%2e/package.json',
                '/jci/%2e%2e%2fpackage.json',
                '/emulator/../server/ui-server.js',
                '/emulator/..%2fserver%2fui-server.js',
                '/jci/gui/../../package.json'
            ]) {
                const res = await get(rawPath);
                assert.equal(res.status, 404, rawPath);
                assert.ok(!res.body.includes('"name": "mzd-emu"'), rawPath);
            }
        });

        it('answers 400 for a malformed encoded path', async (t) => {
            captureLogs(t, 'error'); // the warning is expected; keep it out of the output
            const res = await get('/jci/%E0%A4%A');
            assert.equal(res.status, 400);
            assert.equal(res.body, '400 Bad Request');
        });

        describe('when reading fails', () => {
            it('answers 500 when the page to inject cannot be read', async (t) => {
                const logs = captureLogs(t, 'error');
                const readFile = fs.readFile;
                t.mock.method(fs, 'readFile', (file, encoding, callback) => {
                    if (String(file).endsWith('index.html')) {
                        callback(new Error('disk failure'));
                    } else {
                        readFile(file, encoding, callback);
                    }
                });
                const res = await get('/jci/gui/index.html');
                assert.equal(res.status, 500);
                assert.equal(res.body, '500 Internal Server Error');
                assert.ok(logs.find({ level: 'error', message: 'disk failure' }));
            });

            it('answers 500 when a file cannot be opened', async (t) => {
                captureLogs(t, 'error');
                t.mock.method(fs, 'createReadStream', () => {
                    const stream = new Readable({ read() {} });
                    process.nextTick(() => stream.destroy(new Error('cannot open')));
                    return stream;
                });
                const res = await get('/emulator/ui-wayland.js');
                assert.equal(res.status, 500);
                assert.equal(res.body, '500 Internal Server Error');
            });

            it('cuts the connection when reading fails after the file was opened', async (t) => {
                captureLogs(t, 'error');
                t.mock.method(fs, 'createReadStream', () => {
                    const stream = new Readable({ read() {} });
                    process.nextTick(() => {
                        stream.emit('open');
                        stream.destroy(new Error('read failure'));
                    });
                    return stream;
                });
                // The 200 header is already sent by then, so the server can only destroy the response.
                await assert.rejects(
                    get('/emulator/ui-wayland.js'),
                    /ECONNRESET|aborted|socket hang up/i
                );
            });
        });
    });

    describe('start', () => {
        it('listens on the given port and announces the GUI address with the real port', async (t) => {
            const logs = captureLogs(t, 'info');
            const opened = [];
            const server = uiServer.start({ port: 0, open: (url) => opened.push(url) });
            t.after(() => new Promise((resolve) => server.close(resolve)));
            await new Promise((resolve) => server.once('listening', resolve));

            const { port } = server.address();
            const url = `http://localhost:${port}/jci/gui/index.html`;
            assert.deepEqual(opened, [url]);
            assert.ok(logs.find({ level: 'info', message: `http://localhost:${port}/` }));
            assert.ok(logs.find({ level: 'banner', message: url }));
            assert.equal((await request(port, '/emulator/runtime.json')).status, 200);
        });

        it('logs an error when the port is taken, and opens nothing', async (t) => {
            const taken = await occupyPort(t);
            const logs = captureLogs(t, 'error');
            const opened = [];
            const server = uiServer.start({ port: taken, open: (url) => opened.push(url) });
            await new Promise((resolve) => server.once('error', resolve));

            assert.ok(logs.find({ level: 'error', scope: 'ui-server', message: 'EADDRINUSE' }));
            assert.deepEqual(opened, []);
        });
    });
});
