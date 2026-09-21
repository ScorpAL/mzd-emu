const test = require('node:test');
const assert = require('node:assert/strict');

const firmwareVersion = require('../server/mmui/firmwareVersion');

test('FIRMWARE_VERSION_INFO reads the last underscore-separated segment from version.ini', () => {
    const info = firmwareVersion.FIRMWARE_VERSION_INFO;

    // jci/version.ini's JCI_SW_VER is "MAZ_CMU-150_74.00.324"; only the final
    // segment after the last underscore is used for both os/fail-safe versions.
    assert.equal(info.osVersion, '74.00.324');
    assert.equal(info.failSafeVersion, '74.00.324');
});
