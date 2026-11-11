const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const settings = require('./settings');
const { useCleanState } = require('../../testing/state');
const { captureLogs } = require('../../testing/logs');

const REAL_FILE = path.join(__dirname, '..', '..', 'data', 'user-settings.json');

describe('settings', () => {
    describe('the vehicle configuration', () => {
        it('loads with firmware-compatible identity values', () => {
            assert.ok(settings.HARDWARE_CONFIG.region);
            assert.match(settings.HARDWARE_CONFIG.vehicleType, /^SETTINGS_VehicleModelType_/);
        });

        it('HARDWARE_CONFIG mirrors config/vehicle.json and is no user setting', () => {
            const vehicle = JSON.parse(fs.readFileSync(settings.VEHICLE_CONFIG_FILE, 'utf8'));
            for (const key of ['region', 'vehicleType', 'hudType', 'phoneBluetoothConnection']) {
                assert.equal(settings.HARDWARE_CONFIG[key], vehicle[key], key);
            }
            assert.equal(settings.currentSettings.region, undefined);
            assert.equal(settings.DEFAULT_SETTINGS.region, undefined);
        });
    });

    describe('defaults', () => {
        it('the default time zone is UTC', () => {
            assert.equal(settings.DEFAULT_SETTINGS.timeZoneIndex, 34);
        });

        it('the current settings start from the defaults', () => {
            assert.ok(settings.currentSettings);
            assert.ok(settings.currentLanguageId);
        });
    });

    describe('the user settings file', () => {
        it('is never the real data/user-settings.json under the test runner', () => {
            assert.ok(process.env.NODE_TEST_CONTEXT, 'this file runs under node --test');
            assert.notEqual(path.resolve(settings.USER_SETTINGS_FILE), REAL_FILE);
            if (!process.env.MZD_USER_SETTINGS) {
                assert.ok(settings.USER_SETTINGS_FILE.startsWith(os.tmpdir()));
            }
        });

        describe('saving', () => {
            useCleanState({ stubSave: false });

            it('writes the user-editable settings atomically, without vehicle identity', () => {
                settings.currentSettings.timeFormat = 'hrs24';
                settings.currentLanguageId = 'LANGS_DE_GERMAN';
                settings.saveUserSettings();

                const saved = JSON.parse(fs.readFileSync(settings.USER_SETTINGS_FILE, 'utf8'));
                assert.equal(saved.timeFormat, 'hrs24');
                assert.equal(saved.languageId, 'LANGS_DE_GERMAN');
                assert.equal(saved.region, undefined);
                assert.equal(saved.vehicleType, undefined);
                assert.equal(fs.existsSync(settings.USER_SETTINGS_FILE + '.tmp'), false);
            });

            it('saves every user setting there is a default for', () => {
                settings.saveUserSettings();
                const saved = JSON.parse(fs.readFileSync(settings.USER_SETTINGS_FILE, 'utf8'));
                const missing = Object.keys(settings.DEFAULT_SETTINGS).filter((k) => !(k in saved));
                assert.deepEqual(missing, []);
            });

            it('logs an error instead of throwing when the file cannot be written', (t) => {
                const logs = captureLogs(t, 'error');
                t.mock.method(fs, 'writeFileSync', () => {
                    throw new Error('disk full');
                });
                assert.doesNotThrow(() => settings.saveUserSettings());
                assert.ok(logs.find({ level: 'error', scope: 'settings', message: 'disk full' }));
            });
        });
    });
});
