const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const VERSION_INI_FILE = path.join(__dirname, '..', '..', 'jci', 'version.ini');

function readVersionIni() {
    try {
        const text = fs.readFileSync(VERSION_INI_FILE, 'utf8');
        const fields = {};
        text.split('\n').forEach(function (line) {
            const m = /^([A-Za-z0-9_.-]+)="(.*)"\s*$/.exec(line.trim());
            if (m) {
                fields[m[1]] = m[2];
            }
        });
        return fields;
    } catch (e) {
        logger.warn(
            'firmware',
            'jci/version.ini could not be read (%s), version info will be unavailable',
            e.message
        );
        return {};
    }
}

const versionIniFields = readVersionIni();

function lastUnderscoreSegment(value) {
    if (!value) {
        return null;
    }
    const parts = value.split('_');
    return parts[parts.length - 1];
}

const FIRMWARE_VERSION_INFO = {
    osVersion: lastUnderscoreSegment(versionIniFields.JCI_SW_VER),
    musicDbVersion: lastUnderscoreSegment(versionIniFields.JCI_CPP_GRACENOTEDB),
    failSafeVersion: lastUnderscoreSegment(versionIniFields.JCI_SW_VER)
};

module.exports = {
    FIRMWARE_VERSION_INFO: FIRMWARE_VERSION_INFO
};
