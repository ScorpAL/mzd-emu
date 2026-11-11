const WebSocketServer = require('ws').Server;

const logger = require('./logger');
const startup = require('./mmui/services/startup');
const temperatureService = require('./mmui/services/temperatureService');
const { createControlServer } = require('./mmui/controlPanel');
const handleMmuiEvent = require('./mmui/dispatcher');

const runtime = require('./config/runtime.json');

// The ports come from config/runtime.json. MZD_<NAME>_PORT (for example MZD_GUIIFM_PORT) overrides one of
// them, so a second copy, such as the one the tests start, does not collide with a running emulator.
function portFor(name, configured, env = process.env) {
    const text = env[`MZD_${name.toUpperCase()}_PORT`];
    const port = Number(text);
    return text && Number.isInteger(port) && port >= 0 && port <= 65535 ? port : configured;
}

const PORTS = {
    guiifm: portFor('guiifm', runtime.guiifmPort),
    appsdk: portFor('appsdk', runtime.appsdkPort),
    dbapi: portFor('dbapi', runtime.dbapiPort),
    control: portFor('control', runtime.controlPort)
};

function parseMessage(message, scope) {
    try {
        return JSON.parse(message.toString());
    } catch (error) {
        logger.error(scope, 'Invalid JSON message: %s', error.message);
        return null;
    }
}

function attachPassiveEndpoint(server, scope) {
    server.on('connection', (ws) => {
        // These sockets carry nothing the emulator acts on; only note them for debugging.
        logger.debug(scope, 'Client connected');
        ws.on('error', (error) => logger.error(scope, 'WebSocket error: %s', error.message));
        ws.on('close', () => logger.debug(scope, 'Client disconnected'));
        ws.on('message', (message) => {
            const data = parseMessage(message, scope);
            if (data) {
                logger.debug(scope, 'Received message type=%s', data.msgType || 'unknown');
            }
        });
    });
}

function attachGuiifmEndpoint(server, emulatorControls) {
    server.on('connection', (ws) => {
        logger.success('gui', 'connected');
        if (emulatorControls) {
            temperatureService.attach(ws);
        }
        startup.sendCurrentTimeEpoch(ws);

        const clockSyncIntervalId =
            startup.CLOCK_SYNC_INTERVAL_MS > 0
                ? setInterval(
                      () => startup.sendCurrentTimeEpoch(ws),
                      startup.CLOCK_SYNC_INTERVAL_MS
                  )
                : null;

        ws.on('error', (error) => logger.error('guiifm', 'WebSocket error: %s', error.message));
        ws.on('close', () => {
            if (clockSyncIntervalId) {
                clearInterval(clockSyncIntervalId);
            }
            logger.info('gui', 'disconnected');
        });
        ws.on('message', (message) => {
            const data = parseMessage(message, 'guiifm');
            if (!data) {
                return;
            }
            if (typeof data.uiaId !== 'string' || typeof data.eventId !== 'string') {
                logger.warn('guiifm', 'Ignored message without uiaId/eventId');
                return;
            }
            logger.debug('guiifm', 'Received event=%s uiaId=%s', data.eventId, data.uiaId);
            // A handler that throws must not take the emulator down (an exception thrown from
            // a ws listener is uncaught: the process would exit, and the socket stays wedged).
            try {
                handleMmuiEvent(ws, data.uiaId, data.eventId, data.params);
            } catch (error) {
                logger.error(
                    'guiifm',
                    'Event %s of %s failed: %s',
                    data.eventId,
                    data.uiaId,
                    error.stack
                );
            }
        });
    });
}

// The GUI socket and the emulator controls matter to the user; the other two are never used.
const QUIET_SCOPES = ['appsdk', 'dbapi'];

// Resolves with the port the server got once it listens (with port 0 the system picks a free one),
// rejects if it cannot listen (for example, the port is taken).
function listening(server, scope) {
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('listening', onListening);
            reject(new Error(`${scope}: ${error.message}`, { cause: error }));
        };
        const onListening = () => {
            server.off('error', onError);
            server.on('error', (error) => logger.error(scope, 'Server error: %s', error.message));
            const { port } = server.address();
            const log = QUIET_SCOPES.includes(scope) ? logger.debug : logger.info;
            log(scope, 'Listening on ws://localhost:%d', port);
            resolve(port);
        };
        server.once('error', onError);
        server.once('listening', onListening);
    });
}

function closeServer(server) {
    return new Promise((resolve) => {
        server.close(() => resolve());
        // ws does not close connected clients itself; without this close() waits
        // for them forever and the process (and its clock sync timers) stays alive.
        server.clients.forEach((client) => client.terminate());
    });
}

// Starts the MMUI sockets. Nothing happens on require(); the caller decides the ports (0 = any free
// one) and owns the result: `ports` are the ports actually listened on, `close()` stops everything.
// If any socket cannot listen, the ones already started are closed and the promise rejects.
async function createMmuiServers(options = {}) {
    const ports = { ...PORTS, ...options.ports };
    const emulatorControls = options.emulatorControls ?? runtime.emulatorControls;

    const guiifm = new WebSocketServer({ port: ports.guiifm });
    attachGuiifmEndpoint(guiifm, emulatorControls);
    const appsdk = new WebSocketServer({ port: ports.appsdk });
    attachPassiveEndpoint(appsdk, 'appsdk');
    const dbapi = new WebSocketServer({ port: ports.dbapi });
    attachPassiveEndpoint(dbapi, 'dbapi');
    const servers = { guiifm, appsdk, dbapi };
    // The emulator's own controls (temperature slider) are off unless runtime.json asks for them.
    if (emulatorControls) {
        servers.control = createControlServer(ports.control);
    }

    const entries = Object.entries(servers);
    const close = () => Promise.all(entries.map(([, server]) => closeServer(server)));
    const results = await Promise.allSettled(
        entries.map(([scope, server]) => listening(server, scope))
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) {
        await close();
        throw failed.reason;
    }
    return {
        ports: Object.fromEntries(entries.map(([scope], i) => [scope, results[i].value])),
        servers,
        close
    };
}

async function main() {
    let mmui = null;
    // Installed first, so a signal during start-up also ends the process cleanly.
    const shutdown = (signal) => {
        logger.info('mmui', 'Stopping after %s', signal);
        Promise.resolve(mmui && mmui.close()).finally(() => process.exit(0));
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    try {
        mmui = await createMmuiServers();
    } catch (error) {
        logger.error('mmui', 'Could not start: %s', error.message);
        process.exit(1);
    }
    // A parent that forked this process with an IPC channel (the tests) learns the real ports here.
    if (process.send) {
        process.send({ type: 'listening', ports: mmui.ports });
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    PORTS,
    portFor,
    parseMessage,
    createMmuiServers
};
