const { beforeEach, afterEach } = require('node:test');

const settings = require('../mmui/services/settings');
const navigationState = require('../mmui/state/navigationState');
const vehicleEquipment = require('../mmui/services/vehicleEquipment');
const coldStart = require('../mmui/services/coldStart');
const temperatureService = require('../mmui/services/temperatureService');
const stitcherApp = require('../mmui/uia/stitcherApp');
const { DIALOG_OWNERS } = require('../mmui/uia/commonApp');

// The MMUI keeps its state in module singletons (settings, the back stack, dialog flags, timing
// configs). node --test runs each file in its own process, but the tests of one file share them.
// These are the plain objects a test may change; each is put back in place (same object, so
// every module that holds a reference sees the restored values).
function mutableObjects() {
    return [
        settings.currentSettings,
        settings.HARDWARE_CONFIG,
        vehicleEquipment.VEHICLE_EQUIPMENT,
        coldStart.config,
        stitcherApp.config,
        ...DIALOG_OWNERS.map((app) => app.dialogs)
    ];
}

function takeSnapshot() {
    return {
        objects: mutableObjects().map((object) => [object, structuredClone(object)]),
        goBackStack: structuredClone(navigationState.goBackStack),
        currentLanguageId: settings.currentLanguageId
    };
}

function restoreSnapshot(snapshot) {
    for (const [object, saved] of snapshot.objects) {
        for (const key of Object.keys(object)) {
            delete object[key];
        }
        Object.assign(object, saved);
    }
    navigationState.goBackStack.splice(0, Infinity, ...snapshot.goBackStack);
    settings.currentLanguageId = snapshot.currentLanguageId;
    temperatureService.reset();
}

// Call at the top of a test file or inside a describe(): every test of that scope starts from the
// state the scope started with, whatever the previous test changed, failed or not.
//
// Unless `stubSave: false`, settings.saveUserSettings is replaced by a counter, so handler tests
// neither write the (temporary, see settings.js) settings file nor depend on it; `fixture.saves`
// is the number of saves in the current test.
function useCleanState({ stubSave = true } = {}) {
    const fixture = { saves: 0 };
    let snapshot;
    let originalSave;
    beforeEach(() => {
        snapshot = takeSnapshot();
        fixture.saves = 0;
        if (stubSave) {
            originalSave = settings.saveUserSettings;
            settings.saveUserSettings = () => {
                fixture.saves += 1;
            };
        }
    });
    afterEach(() => {
        if (stubSave) {
            settings.saveUserSettings = originalSave;
        }
        restoreSnapshot(snapshot);
    });
    return fixture;
}

// Replaces the back stack with the given [uiaId, ctxtId] screens, bottom first.
function setBackStack(...screens) {
    navigationState.goBackStack.splice(
        0,
        Infinity,
        ...screens.map(([uiaId, ctxtId], i) => ({ uiaId, ctxtId, contextSeq: i + 1 }))
    );
}

// The ctxtIds of the back stack, bottom first.
function backStack() {
    return navigationState.goBackStack.map((entry) => entry.ctxtId);
}

// The same as "uiaId/ctxtId", for tests that cross applications.
function backStackPaths() {
    return navigationState.goBackStack.map((entry) => `${entry.uiaId}/${entry.ctxtId}`);
}

module.exports = { useCleanState, setBackStack, backStack, backStackPaths };
