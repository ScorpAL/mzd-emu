const test = require('node:test');
const assert = require('node:assert/strict');

const navigationState = require('../server/mmui/navigationState');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
});

test('goBackStack starts empty and accepts pushed context frames', () => {
    assert.deepEqual(navigationState.goBackStack, []);

    navigationState.goBackStack.push({ uiaId: 'system', ctxtId: 'Home', contextSeq: 1 });

    assert.equal(navigationState.goBackStack.length, 1);
    assert.equal(navigationState.goBackStack[0].uiaId, 'system');
});
