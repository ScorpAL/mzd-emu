const logger = require('../logger');
const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const commonApp = require('./uia/commonApp');
const systemApp = require('./uia/systemApp');
const syssettingsApp = require('./uia/syssettingsApp');
const sysupdateApp = require('./uia/sysupdateApp');
const vehsettingsApp = require('./uia/vehsettingsApp');
const audiosettingsApp = require('./uia/audiosettingsApp');
const btpairingApp = require('./uia/btpairingApp');
const netmgmtApp = require('./uia/netmgmtApp');
const schedmaintApp = require('./uia/schedmaintApp');
const ecoenergyApp = require('./uia/ecoenergyApp');

// Every application, plus the common one for the shared Global.* events, owns its events: each
// exports `events`, a table of eventId -> handler(ws, params, uiaId, eventId), like the
// per-library decision tables of the firmware (see docs/NATIVE_MAP.md).
const applications = [
    commonApp,
    systemApp,
    ecoenergyApp,
    schedmaintApp,
    syssettingsApp,
    audiosettingsApp,
    sysupdateApp,
    btpairingApp,
    netmgmtApp,
    vehsettingsApp
];

function buildEventTable(modules) {
    const table = {};
    modules.forEach((module) => {
        Object.keys(module.events).forEach((eventId) => {
            if (Object.prototype.hasOwnProperty.call(table, eventId)) {
                throw new Error('Event handled by more than one application: ' + eventId);
            }
            table[eventId] = module.events[eventId];
        });
    });
    return table;
}

const eventTable = buildEventTable(applications);

// A short, one-line view of an event's payload for the log.
function describePayload(params) {
    const payload = params && params.payload !== undefined ? params.payload : params;
    const text = payload === undefined ? '' : JSON.stringify(payload);
    return text.length > 80 ? text.slice(0, 77) + '...' : text;
}

const handleMmuiEvent = function (ws, uiaId, eventId, params) {
    // Set... events are the user changing something; show them next to the screen changes.
    if (/^Set[A-Z]/.test(eventId)) {
        logger.info('setting', '%s %s', eventId, describePayload(params));
    }
    if (Object.prototype.hasOwnProperty.call(eventTable, eventId)) {
        eventTable[eventId](ws, params, uiaId, eventId);
        return true;
    }
    // Any other SelectXyz event opens the context named Xyz of the sender.
    if (eventId.substr(0, 6) === 'Select') {
        sendContextChange(ws, uiaId, eventId.substr(6));
    } else {
        logger.debug('dispatcher', 'no handler for %s from %s', eventId, uiaId);
    }
    return true;
};

module.exports = handleMmuiEvent;
module.exports.buildEventTable = buildEventTable;
module.exports.eventTable = eventTable;
