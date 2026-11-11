const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork } = require('node:child_process');

const mmuiServer = require('./mmui-server');
const logger = require('./logger');
const dispatcher = require('./mmui/dispatcher');
const runtime = require('./config/runtime.json');
const temperatureService = require('./mmui/services/temperatureService');
const { useCleanState } = require('./testing/state');
const { captureLogs } = require('./testing/logs');
const { connect, occupyPort } = require('./testing/wsClient');

// Every socket on port 0: the system picks free ports, so these tests never collide with a running
// emulator (npm start) or with another test run.
const ANY_PORTS = { guiifm: 0, appsdk: 0, dbapi: 0, control: 0 };

const isClock = (m) => m.msgId === 'SendCurrentTimeEpoch';
const isHome = (m) => m.msgType === 'ctxtChg' && m.ctxtId === 'HomeScreen';
const isTemperature = (celsius) => (m) =>
    m.type === 'temperature' && (celsius === undefined || m.state.temperatureC === celsius);
const HOME = { uiaId: 'system', eventId: 'Global.IntentHome' };

// The message JSON.parse gives for `text`, as the server logs it.
function jsonError(text) {
    try {
        JSON.parse(text);
    } catch (error) {
        return error.message;
    }
    throw new Error(`${text} is valid JSON`);
}

// One set of servers for every test of the calling describe(); each test opens its own clients,
// and useCleanState() puts the MMUI state back after each test.
function useServers(options) {
    const handle = {};
    before(async () => {
        Object.assign(handle, await mmuiServer.createMmuiServers({ ports: ANY_PORTS, ...options }));
    });
    after(() => handle.close());
    return handle;
}

// A hang must fail the test, not stall the whole run.
describe('mmui-server', { timeout: 10000 }, () => {
    describe('portFor', () => {
        it('takes MZD_<NAME>_PORT when it is a valid port, including 0', () => {
            assert.equal(mmuiServer.portFor('guiifm', 2700, { MZD_GUIIFM_PORT: '4321' }), 4321);
            assert.equal(mmuiServer.portFor('guiifm', 2700, { MZD_GUIIFM_PORT: '0' }), 0);
            assert.equal(mmuiServer.portFor('dbapi', 2766, { MZD_DBAPI_PORT: '65535' }), 65535);
        });

        it('keeps the configured port when the variable is missing, empty or not a port', () => {
            for (const value of [undefined, '', 'abc', '-1', '65536', '12.5']) {
                const env = value === undefined ? {} : { MZD_APPSDK_PORT: value };
                assert.equal(mmuiServer.portFor('appsdk', 2800, env), 2800, String(value));
            }
        });

        it('PORTS are those of config/runtime.json, unless the environment overrides them', () => {
            const configured = {
                guiifm: runtime.guiifmPort,
                appsdk: runtime.appsdkPort,
                dbapi: runtime.dbapiPort,
                control: runtime.controlPort
            };
            for (const [name, port] of Object.entries(configured)) {
                assert.equal(mmuiServer.PORTS[name], mmuiServer.portFor(name, port), name);
            }
        });
    });

    describe('parseMessage', () => {
        it('parses JSON from a string or a Buffer', () => {
            assert.deepEqual(mmuiServer.parseMessage('{"a":1}', 'test'), { a: 1 });
            assert.deepEqual(mmuiServer.parseMessage(Buffer.from('[2]'), 'test'), [2]);
        });

        it('logs invalid JSON as an error of the given scope and returns null', (t) => {
            const logs = captureLogs(t);
            assert.equal(mmuiServer.parseMessage('not json', 'somescope'), null);
            assert.equal(logs.records.length, 1);
            assert.ok(logs.find({ level: 'error', scope: 'somescope', message: 'Invalid JSON' }));
        });
    });

    describe('in process', () => {
        useCleanState();
        const mmui = useServers({ emulatorControls: false });

        it('reports the ports it really listens on, all different, without the control socket', () => {
            assert.deepEqual(Object.keys(mmui.ports), ['guiifm', 'appsdk', 'dbapi']);
            for (const port of Object.values(mmui.ports)) {
                assert.ok(Number.isInteger(port) && port > 0, String(port));
            }
            assert.equal(new Set(Object.values(mmui.ports)).size, 3);
        });

        it('a connecting GUI gets the clock first, and its events reach the dispatcher', async (t) => {
            const gui = await connect(t, mmui.ports.guiifm);
            const first = await gui.next(() => true);
            assert.ok(isClock(first), JSON.stringify(first));
            assert.ok(Number.isFinite(first.params.payload.u32TimestampSec));

            gui.send(HOME);
            await gui.next(isHome);
        });

        it('logs the GUI connecting and leaving', async (t) => {
            const logs = captureLogs(t, 'info');
            const gui = await connect(t, mmui.ports.guiifm);
            await logs.waitFor({ level: 'success', scope: 'gui', message: 'connected' });
            gui.client.close();
            await logs.waitFor({ level: 'info', scope: 'gui', message: 'disconnected' });
        });

        it('bad GUI messages are logged and ignored, and the server keeps answering', async (t) => {
            const logs = captureLogs(t, 'warn');
            const gui = await connect(t, mmui.ports.guiifm);
            await gui.next(isClock);

            gui.send('this is not json');
            gui.send({ eventId: 'Global.IntentHome' });
            gui.send({ uiaId: 'system' });
            gui.send({ uiaId: 5, eventId: 'Global.IntentHome' });
            gui.send({ uiaId: 'system', eventId: 7 });
            gui.send(HOME);

            // One socket's messages are handled in order: once Home arrives, the bad ones are done.
            await gui.next(isHome);
            logger.flush(); // prints the "repeated N more times" count of the warnings
            assert.equal(gui.received.filter(isHome).length, 1, 'only the valid one was handled');
            const invalid = logs.find({ level: 'error', scope: 'guiifm' });
            assert.equal(invalid.message, `Invalid JSON message: ${jsonError('this is not json')}`);
            assert.equal(logs.count({ level: 'error' }), 1);
            const ignored = {
                level: 'warn',
                scope: 'guiifm',
                message: /^Ignored message without uiaId\/eventId$/
            };
            assert.equal(logs.count(ignored), 4);
            assert.equal(logs.count({}), 5, JSON.stringify(logs.records));
        });

        it('an event whose handler throws is logged, and the server keeps answering', async (t) => {
            const logs = captureLogs(t, 'error');
            t.mock.method(dispatcher.eventTable, 'SelectApplications', () => {
                throw new Error('handler bug');
            });
            const gui = await connect(t, mmui.ports.guiifm);
            await gui.next(isClock);

            gui.send({ uiaId: 'system', eventId: 'SelectApplications' });
            gui.send(HOME);
            await gui.next(isHome);
            const failure = logs.find({ level: 'error', scope: 'guiifm' });
            assert.match(
                failure.message,
                /^Event SelectApplications of system failed: .*handler bug/
            );
        });

        for (const scope of ['appsdk', 'dbapi']) {
            it(`the ${scope} socket accepts clients, never answers and only notes what they send`, async (t) => {
                const logs = captureLogs(t);
                const client = await connect(t, mmui.ports[scope]);
                await logs.waitFor({ scope, message: 'Client connected' });

                client.send({ msgType: 'ping' });
                client.send({});
                client.send('not json either');
                await logs.waitFor({ scope, level: 'debug', message: 'type=ping' });
                await logs.waitFor({ scope, level: 'debug', message: 'type=unknown' });
                await logs.waitFor({ scope, level: 'error', message: 'Invalid JSON' });

                client.client.close();
                await logs.waitFor({ scope, message: 'Client disconnected' });
                assert.deepEqual(client.received, []);
            });
        }
    });

    describe('close()', () => {
        it('disconnects connected clients and frees every port', async (t) => {
            const mmui = await mmuiServer.createMmuiServers({ ports: ANY_PORTS });
            const gui = await connect(t, mmui.ports.guiifm);
            const appsdk = await connect(t, mmui.ports.appsdk);

            await mmui.close();
            await gui.closed();
            await appsdk.closed();
            for (const port of Object.values(mmui.ports)) {
                await assert.rejects(connect(t, port), /ECONNREFUSED/, String(port));
            }
            await mmui.close(); // a second close() is harmless
        });
    });

    describe('when a port is taken', () => {
        it('rejects naming the socket and the reason, and closes the ones it had opened', async (t) => {
            const taken = await occupyPort(t);
            const logs = captureLogs(t);

            await assert.rejects(
                mmuiServer.createMmuiServers({ ports: { ...ANY_PORTS, dbapi: taken } }),
                (error) => {
                    assert.match(error.message, /^dbapi: .*EADDRINUSE/);
                    assert.equal(error.cause.code, 'EADDRINUSE');
                    return true;
                }
            );

            // The others did listen before the failure; they are closed again.
            const opened = logs.records
                .filter((record) => record.message.startsWith('Listening on'))
                .map((record) => Number(record.message.split(':').pop()));
            assert.ok(opened.length >= 2, JSON.stringify(logs.records));
            for (const port of opened) {
                await assert.rejects(connect(t, port), /ECONNREFUSED/, String(port));
            }
        });
    });

    describe('with the emulator controls', () => {
        useCleanState();
        const mmui = useServers({ emulatorControls: true });

        it('opens the control socket, which reports the temperature and sets it', async (t) => {
            const panel = await connect(t, mmui.ports.control);
            const first = await panel.next(isTemperature());
            assert.equal(first.state.temperatureC, temperatureService.getState().temperatureC);

            panel.send({ type: 'setTemperature', value: 70 });
            await panel.next(isTemperature(70));
            assert.equal(temperatureService.getState().temperatureC, 70);
        });

        it('the control socket ignores messages it does not know', async (t) => {
            const panel = await connect(t, mmui.ports.control);
            await panel.next(isTemperature());
            panel.send('not json');
            panel.send({ type: 'somethingElse', value: 90 });
            panel.send({ type: 'setTemperature', value: 60 });
            await panel.next(isTemperature(60));
            assert.equal(panel.received.length, 2, 'only the valid change was answered');
        });

        it('a connecting GUI is watched by the temperature service', async (t) => {
            const gui = await connect(t, mmui.ports.guiifm);
            await gui.next(isClock);
            temperatureService.setTemperature(95);
            temperatureService.poll();
            const over = await gui.next((m) => m.msgId === 'DisplayOverTemperature');
            assert.deepEqual(over.params.payload, { displayOverTemperature: true });
        });
    });

    // The real entry point, as `npm run mmui` and `npm start` run it. Kept to what only a process
    // shows: how it exits. The tests are independent, so they run at the same time.
    describe('as a process', { concurrency: true }, () => {
        const SCRIPT = path.join(__dirname, 'mmui-server.js');

        // Forks the server. Its ports come from `env` (all 0 unless a test says otherwise) and are
        // reported over the IPC channel once every socket listens; `ports` is null if it exits first.
        async function startProcess(t, env = {}) {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mzd-emu-test-'));
            t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
            const child = fork(SCRIPT, [], {
                stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                env: {
                    ...process.env,
                    // NODE_TEST_CONTEXT (inherited) already keeps the child's settings in a
                    // temporary directory; this names the file outright, to be sure.
                    MZD_USER_SETTINGS: path.join(dir, 'user-settings.json'),
                    MZD_GUIIFM_PORT: '0',
                    MZD_APPSDK_PORT: '0',
                    MZD_DBAPI_PORT: '0',
                    MZD_CONTROL_PORT: '0',
                    ...env
                }
            });
            let output = '';
            child.stdout.on('data', (chunk) => (output += chunk));
            child.stderr.on('data', (chunk) => (output += chunk));
            const exited = new Promise((resolve) =>
                child.once('exit', (code, signal) => resolve({ code, signal }))
            );
            t.after(() => child.kill('SIGKILL'));
            const ports = await Promise.race([
                new Promise((resolve) =>
                    child.on('message', (m) => m.type === 'listening' && resolve(m.ports))
                ),
                exited.then(() => null)
            ]);
            return { child, ports, exited, output: () => output };
        }

        for (const signal of ['SIGTERM', 'SIGINT']) {
            it(`exits with code 0 on ${signal} while a GUI is connected`, async (t) => {
                const server = await startProcess(t);
                assert.ok(server.ports, `it did not start:\n${server.output()}`);
                const gui = await connect(t, server.ports.guiifm);
                await gui.next(isClock);

                server.child.kill(signal);
                // Exiting by the signal itself (signal set, no code) would mean no handler ran.
                assert.deepEqual(await server.exited, { code: 0, signal: null });
            });
        }

        it('exits with code 1 instead of running half-started when a port is taken', async (t) => {
            const taken = await occupyPort(t);
            const server = await startProcess(t, { MZD_GUIIFM_PORT: String(taken) });
            assert.equal(server.ports, null, 'it must not report itself as listening');
            assert.deepEqual(await server.exited, { code: 1, signal: null });
        });
    });
});
