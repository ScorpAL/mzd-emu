const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const runtime = require('./config/runtime.json');

const SCRIPT = path.join(__dirname, 'mmui-server.js');

test('mmui-server exits on SIGTERM even while a client stays connected', async () => {
    const child = spawn(process.execPath, [SCRIPT], {
        stdio: ['ignore', 'pipe', 'inherit'],
        // Under node --test the logger is quiet by default; this test reads the startup line.
        env: { ...process.env, MZD_LOG_LEVEL: 'info' }
    });
    const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve(signal)));
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
    try {
        await new Promise((resolve) =>
            child.stdout.on('data', (chunk) => {
                if (String(chunk).includes(`ws://localhost:${runtime.guiifmPort}`)) {
                    resolve();
                }
            })
        );
        const client = new WebSocket(`ws://localhost:${runtime.guiifmPort}`);
        client.on('error', () => {});
        await new Promise((resolve) => client.on('open', resolve));
        child.kill('SIGTERM');
        assert.strictEqual(await exited, null, 'server had to be force-killed');
    } finally {
        clearTimeout(timeout);
        child.kill('SIGKILL');
    }
});
