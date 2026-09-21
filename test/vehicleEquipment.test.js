const test = require('node:test');
const assert = require('node:assert/strict');

const vehicleEquipment = require('../server/mmui/vehicleEquipment');

test('VEHICLE_EQUIPMENT flags are 0/1 (or SCBS_Installed submenu codes)', () => {
    const equipment = vehicleEquipment.VEHICLE_EQUIPMENT;
    Object.keys(equipment).forEach((flag) => {
        assert.ok(
            Number.isInteger(equipment[flag]),
            `${flag} should be an integer flag, got ${equipment[flag]}`
        );
    });
});

test('getUiaIdForFlag routes syssettings-only flags correctly', () => {
    assert.equal(vehicleEquipment.getUiaIdForFlag('TemperatureUnit_Installed'), 'syssettings');
    assert.equal(vehicleEquipment.getUiaIdForFlag('DistanceUnit_Installed'), 'syssettings');
});

test('getUiaIdForFlag defaults to vehsettings for everything else', () => {
    assert.equal(vehicleEquipment.getUiaIdForFlag('BSM_Installed'), 'vehsettings');
    assert.equal(vehicleEquipment.getUiaIdForFlag('UnknownFlag'), 'vehsettings');
});
