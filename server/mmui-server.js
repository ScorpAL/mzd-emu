const WebSocketServer = require('ws').Server;

const logger = require('./logger');
const startup = require('./mmui/startup');
const handleMmuiEvent = require('./mmui/dispatcher');

const runtime = require('./config/runtime.json');

const PORTS = {
    guiifm: runtime.guiifmPort,
    appsdk: runtime.appsdkPort,
    dbapi: runtime.dbapiPort
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
        logger.success(scope, 'Client connected');
        ws.on('error', (error) => logger.error(scope, 'WebSocket error: %s', error.message));
        ws.on('close', () => logger.info(scope, 'Client disconnected'));
        ws.on('message', (message) => {
            const data = parseMessage(message, scope);
            if (data) {
                logger.debug(scope, 'Received message type=%s', data.msgType || 'unknown');
            }
        });
    });
}

function createGuiifmServer() {
    const server = new WebSocketServer({ port: PORTS.guiifm });

    server.on('connection', (ws) => {
        logger.success('guiifm', 'Client connected');
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
            logger.info('guiifm', 'Client disconnected');
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
            handleMmuiEvent(ws, data.uiaId, data.eventId, data.params);
        });
    });

    return server;
}

function listen(server, scope, port) {
    server.on('listening', () => logger.info(scope, 'Listening on ws://localhost:%d', port));
    server.on('error', (error) => logger.error(scope, 'Server error: %s', error.message));
}

const servers = [
    { scope: 'guiifm', server: createGuiifmServer(), port: PORTS.guiifm },
    { scope: 'appsdk', server: new WebSocketServer({ port: PORTS.appsdk }), port: PORTS.appsdk },
    { scope: 'dbapi', server: new WebSocketServer({ port: PORTS.dbapi }), port: PORTS.dbapi }
];

attachPassiveEndpoint(servers[1].server, 'appsdk');
attachPassiveEndpoint(servers[2].server, 'dbapi');
servers.forEach(({ server, scope, port }) => listen(server, scope, port));

function close() {
    return Promise.all(
        servers.map(
            ({ server }) =>
                new Promise((resolve) => {
                    server.close(() => resolve());
                })
        )
    );
}

async function shutdown(signal) {
    logger.info('mmui', 'Stopping after %s', signal);
    await close();
}

process.once('SIGINT', () => shutdown('SIGINT').finally(() => process.exit(0)));
process.once('SIGTERM', () => shutdown('SIGTERM').finally(() => process.exit(0)));

module.exports = {
    PORTS,
    parseMessage,
    close
};
