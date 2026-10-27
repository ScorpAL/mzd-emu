const WebSocketServer = require('ws').Server;
const logger = require('../logger');
const temperatureService = require('./services/temperatureService');

// WebSocket endpoint for the emulator's own controls (the panel next to the GUI in the browser).
// It is deliberately separate from the guiifm socket: the GUI from jci/ must only see what the
// head unit would send, while these controls only exist in the emulator.
function createControlServer(port) {
    const server = new WebSocketServer({ port: port });

    server.on('connection', (ws) => {
        const send = (state) => ws.send(JSON.stringify({ type: 'temperature', state: state }));
        send(temperatureService.getState());
        const unsubscribe = temperatureService.onChange(send);
        ws.on('close', unsubscribe);
        ws.on('error', (error) => logger.error('control', 'WebSocket error: %s', error.message));
        ws.on('message', (raw) => {
            let data;
            try {
                data = JSON.parse(raw.toString());
            } catch {
                return;
            }
            if (data && data.type === 'setTemperature') {
                temperatureService.setTemperature(data.value);
            }
        });
    });

    return server;
}

module.exports = { createControlServer: createControlServer };
