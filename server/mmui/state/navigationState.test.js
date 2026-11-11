const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const navigationState = require('./navigationState');

describe('navigationState', () => {
    it('the back stack starts empty', () => {
        assert.deepEqual(navigationState.goBackStack, []);
    });
});
