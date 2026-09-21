const test = require('node:test');
const assert = require('node:assert/strict');

const dialogState = require('../server/mmui/dialogState');

test('dialogState exposes the expected dialog flags with safe defaults', () => {
    assert.equal(dialogState.disclaimerActive, false);
    assert.equal(dialogState.softwareInfoDialogActive, false);
    assert.equal(dialogState.factoryResetConfirmActive, false);
    assert.equal(dialogState.schedMaintResetContext, null);
    assert.equal(dialogState.pendingLanguageId, null);
});

test('dialogState is a shared mutable object', () => {
    dialogState.disclaimerActive = true;
    assert.equal(require('../server/mmui/dialogState').disclaimerActive, true);
    dialogState.disclaimerActive = false;
});
