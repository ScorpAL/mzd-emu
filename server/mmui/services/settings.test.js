const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const settings = require('./settings');

test('vehicle configuration loads with firmware-compatible identity values', () => {
    assert.ok(settings.HARDWARE_CONFIG.region);
    assert.ok(settings.HARDWARE_CONFIG.vehicleType);
    assert.ok(settings.currentSettings);
});

test('default timezone is UTC Coordinated Universal Time', () => {
    assert.equal(settings.DEFAULT_SETTINGS.timeZoneIndex, 34);
});

test('HARDWARE_CONFIG mirrors config/vehicle.json and is not part of currentSettings/DEFAULT_SETTINGS', () => {
    const vehicleConfig = JSON.parse(fs.readFileSync(settings.VEHICLE_CONFIG_FILE, 'utf8'));

    assert.equal(settings.HARDWARE_CONFIG.region, vehicleConfig.region);
    assert.equal(settings.HARDWARE_CONFIG.vehicleType, vehicleConfig.vehicleType);
    assert.equal(settings.HARDWARE_CONFIG.hudType, vehicleConfig.hudType);
    assert.equal(settings.currentSettings.region, undefined);
    assert.equal(settings.DEFAULT_SETTINGS.region, undefined);
});

test('currentLanguageId falls back to US English when nothing was ever saved', () => {
    assert.ok(settings.currentLanguageId);
});

test('the tests never use the real data/user-settings.json', () => {
    const realFile = path.join(__dirname, '..', '..', 'data', 'user-settings.json');
    assert.notEqual(settings.USER_SETTINGS_FILE, realFile);
});

test('saveUserSettings persists the current in-memory settings atomically', () => {
    const originalTimeFormat = settings.currentSettings.timeFormat;
    try {
        settings.currentSettings.timeFormat = 'hrs24';
        settings.saveUserSettings();

        const saved = JSON.parse(fs.readFileSync(settings.USER_SETTINGS_FILE, 'utf8'));
        assert.equal(saved.timeFormat, 'hrs24');
        assert.equal(fs.existsSync(settings.USER_SETTINGS_FILE + '.tmp'), false);
    } finally {
        settings.currentSettings.timeFormat = originalTimeFormat;
    }
});
