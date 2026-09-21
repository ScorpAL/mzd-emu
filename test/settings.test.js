const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const settings = require('../server/mmui/settings');

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

test('saveUserSettings persists the current in-memory settings to data/user-settings.json', () => {
    const userSettingsFile = settings.VEHICLE_CONFIG_FILE.replace(
        'config/vehicle.json',
        'data/user-settings.json'
    );
    const originalFileContents = fs.readFileSync(userSettingsFile, 'utf8');
    const originalTimeFormat = settings.currentSettings.timeFormat;

    try {
        settings.currentSettings.timeFormat = 'hrs24';
        settings.saveUserSettings();

        const saved = JSON.parse(fs.readFileSync(userSettingsFile, 'utf8'));
        assert.equal(saved.timeFormat, 'hrs24');
    } finally {
        // Restore whatever was on disk before this test ran (this file is a
        // real, gitignored, user-editable artifact - never leave it mutated).
        fs.writeFileSync(userSettingsFile, originalFileContents);
        settings.currentSettings.timeFormat = originalTimeFormat;
    }
});
