const test = require('node:test');
const assert = require('node:assert/strict');

const schedmaintApp = require('../server/mmui/schedmaintApp');
const navigationState = require('../server/mmui/navigationState');
const settings = require('../server/mmui/settings');

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
});

test('oil distance update sends only the oil distance response', () => {
    navigationState.goBackStack.push({
        uiaId: 'schedmaint',
        ctxtId: 'OilChangeDetail',
        contextSeq: 1
    });

    const messages = [];
    const originalDistance = settings.currentSettings.oilMaintDistance;
    const originalSaveUserSettings = settings.saveUserSettings;
    settings.saveUserSettings = () => {};
    schedmaintApp.handleSetDistanceValue(
        {
            send(message) {
                messages.push(JSON.parse(message));
            }
        },
        { payload: { DistanceValue: originalDistance + 500 } }
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0].msgId, 'OilMaintenanceDistanceChange');
    assert.equal(messages[0].params.payload.distance.Distance, originalDistance + 500);
    settings.currentSettings.oilMaintDistance = originalDistance;
    settings.saveUserSettings = originalSaveUserSettings;
});
