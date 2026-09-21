const settings = require('./settings');
const logger = require('../logger');

// Plain msg frames are not part of protocol.js's sequence-byte batching.
function sendStartupSettings(ws) {
    function sendSyssettingsMsg(msgId, payload) {
        const msg = JSON.stringify({
            msgType: 'msg',
            uiaId: 'syssettings',
            msgId: msgId,
            params: { payload: payload }
        });
        ws.send(msg);
        logger.debug('guiifm', 'Sent startup setting msgId=%s', msgId);
    }

    sendSyssettingsMsg('Region', { RegionValue: settings.HARDWARE_CONFIG.region });
    sendSyssettingsMsg('KeyboardLanguage', {
        keyboardLanguage: settings.currentSettings.keyboardLanguage
    });
    sendSyssettingsMsg('TimeFormat', { timeFormat: settings.currentSettings.timeFormat });
    sendSyssettingsMsg('Temperature', {
        temperatureUnits: settings.currentSettings.temperatureUnit
    });
    sendSyssettingsMsg('Distance', { distanceUnits: settings.currentSettings.distanceUnit });
    sendSyssettingsMsg('VehicleType', { vtype: settings.HARDWARE_CONFIG.vehicleType });
    sendSyssettingsMsg('Destination', { destination: settings.HARDWARE_CONFIG.destinationCode });

    sendSyssettingsMsg('LanguageSupported', {
        languageName: { languageID: settings.currentLanguageId, vrSupport: false, ttsSupport: true }
    });
}

const CLOCK_SYNC_INTERVAL_MS = 60000; // Matches the GUI clock refresh interval.

function sendCurrentTimeEpoch(ws) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'syssettings',
        msgId: 'SendCurrentTimeEpoch',
        params: {
            payload: {
                u32TimestampSec:
                    Math.round(Date.now() / 1000) + settings.currentSettings.clockOffsetSeconds
            }
        }
    });
    ws.send(msg);
    logger.debug('guiifm', 'Sent clock sync');
}

module.exports = {
    sendStartupSettings: sendStartupSettings,
    sendCurrentTimeEpoch: sendCurrentTimeEpoch,
    CLOCK_SYNC_INTERVAL_MS: CLOCK_SYNC_INTERVAL_MS
};
