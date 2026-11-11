const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const vehicleEquipment = require('./vehicleEquipment');

describe('vehicleEquipment', () => {
    it('every VEHICLE_EQUIPMENT flag is an integer (0/1, or an SCBS_Installed submenu code)', () => {
        for (const [flag, value] of Object.entries(vehicleEquipment.VEHICLE_EQUIPMENT)) {
            assert.ok(Number.isInteger(value), `${flag} should be an integer flag, got ${value}`);
        }
    });

    describe('getUiaIdForFlag', () => {
        it('routes the syssettings-only flags to syssettings', () => {
            for (const flag of ['TemperatureUnit_Installed', 'DistanceUnit_Installed']) {
                assert.equal(vehicleEquipment.getUiaIdForFlag(flag), 'syssettings', flag);
            }
        });

        it('routes everything else to vehsettings', () => {
            for (const flag of ['BSM_Installed', 'UnknownFlag']) {
                assert.equal(vehicleEquipment.getUiaIdForFlag(flag), 'vehsettings', flag);
            }
        });
    });
});
