const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const SCRIPT = path.join(__dirname, 'mmui-server.js');

// A port nothing listens on right now, so the test does not depend on a running emulator or on
// another test run holding the ports from runtime.json.
function freePort() {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.on('error', reject);
        probe.listen(0, () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

test('mmui-server exits on SIGTERM even while a client stays connected', async () => {
    const guiifmPort = await freePort();
    const child = spawn(process.execPath, [SCRIPT], {
        stdio: ['ignore', 'pipe', 'inherit'],
        env: {
            ...process.env,
            // Under node --test the logger is quiet by default; this test reads the startup line.
            MZD_LOG_LEVEL: 'info',
            MZD_GUIIFM_PORT: String(guiifmPort),
            MZD_APPSDK_PORT: String(await freePort()),
            MZD_DBAPI_PORT: String(await freePort()),
            MZD_CONTROL_PORT: String(await freePort())
        }
    });
    const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve(signal)));
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
    try {
        // A server that dies before it listens must fail the test at once, not hang until the timeout.
        await Promise.race([
            new Promise((resolve) =>
                child.stdout.on('data', (chunk) => {
                    if (String(chunk).includes(`ws://localhost:${guiifmPort}`)) {
                        resolve();
                    }
                })
            ),
            exited.then(() => {
                throw new Error('mmui-server exited before it started listening');
            })
        ]);
        const client = new WebSocket(`ws://localhost:${guiifmPort}`);
        client.on('error', () => {});
        await new Promise((resolve) => client.on('open', resolve));
        child.kill('SIGTERM');
        assert.strictEqual(await exited, null, 'server had to be force-killed');
    } finally {
        clearTimeout(timeout);
        child.kill('SIGKILL');
    }
});
