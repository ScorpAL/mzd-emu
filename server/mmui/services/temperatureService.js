const logger = require('../../logger');

// Emulated display temperature and the service that watches it.
//
// The head unit polls its temperature sensor on a timer (svcjciblmsystem: default
// --temperature_poll_interval is 5000 ms, nothing in sm.conf overrides it). When the display
// is too hot the GUI gets the syssettings message DisplayOverTemperature (it disables a
// settings list item) and the system app opens the "Temperature Warning" dialog
// (IntentSystemWarningMessage, SystemWarning context).
//
// The real trigger values are not visible in the firmware dump, so the numbers below are
// assumptions. The sensor value comes from the emulator controls panel (see controlPanel.js).
const TEMPERATURE = {
    minC: 20,
    maxC: 100,
    // Over-temperature starts at warnAtC and ends only below clearAtC, so a value hovering
    // around one limit does not make the dialog flicker.
    warnAtC: 85,
    clearAtC: 80,
    pollIntervalMs: 5000
};

let temperatureC = 25;
let over = false;
let pollTimer = null;
const clients = new Set();
const listeners = new Set();

function clamp(value) {
    return Math.min(TEMPERATURE.maxC, Math.max(TEMPERATURE.minC, Math.round(value)));
}

function getState() {
    return Object.assign({ temperatureC: temperatureC, over: over }, TEMPERATURE);
}

function notify() {
    const state = getState();
    listeners.forEach((listener) => listener(state));
}

// Moves the sensor. The service only reacts at its next poll, like the real timer.
function setTemperature(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return;
    }
    temperatureC = clamp(value);
    notify();
}

function sendOverTemperature(ws, isOver) {
    ws.send(
        JSON.stringify({
            msgType: 'msg',
            uiaId: 'syssettings',
            msgId: 'DisplayOverTemperature',
            params: { payload: { displayOverTemperature: isOver } }
        })
    );
}

function poll() {
    const wasOver = over;
    if (!over && temperatureC >= TEMPERATURE.warnAtC) {
        over = true;
    } else if (over && temperatureC < TEMPERATURE.clearAtC) {
        over = false;
    }
    if (over === wasOver) {
        return;
    }
    logger.info('temperature', 'Display %s (%d C)', over ? 'too hot' : 'cooled down', temperatureC);
    // Lazy: systemApp pulls this module in through syssettingsApp.
    const systemApp = require('../uia/systemApp');
    clients.forEach((ws) => {
        sendOverTemperature(ws, over);
        if (over) {
            systemApp.requestSystemWarning(ws);
        }
    });
    notify();
}

function startPolling() {
    if (!pollTimer) {
        pollTimer = setInterval(poll, TEMPERATURE.pollIntervalMs);
        pollTimer.unref();
    }
}

// A connected GUI is watched until it disconnects; polling stops with the last one.
function attach(ws) {
    clients.add(ws);
    startPolling();
    ws.once('close', () => {
        clients.delete(ws);
        if (clients.size === 0) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    });
}

function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

module.exports = {
    TEMPERATURE: TEMPERATURE,
    attach: attach,
    onChange: onChange,
    poll: poll,
    getState: getState,
    isOver: () => over,
    setTemperature: setTemperature,
    reset: () => {
        temperatureC = 25;
        over = false;
    }
};
