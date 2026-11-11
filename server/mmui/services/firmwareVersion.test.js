const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const firmwareVersion = require('./firmwareVersion');

describe('firmwareVersion', () => {
    it('takes the last underscore-separated segment of JCI_SW_VER in version.ini', () => {
        const info = firmwareVersion.FIRMWARE_VERSION_INFO;
        // jci/version.ini's JCI_SW_VER is "MAZ_CMU-150_74.00.324"; the OS and fail-safe
        // versions both show the last segment.
        assert.equal(info.osVersion, '74.00.324');
        assert.equal(info.failSafeVersion, '74.00.324');
    });
});
