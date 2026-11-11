const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const commonApp = require('./commonApp');
const syssettingsApp = require('./syssettingsApp');
const systemApp = require('./systemApp');
const vehicleEquipment = require('../services/vehicleEquipment');
const { createMockWs, contexts, contextPaths } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');

const { events } = commonApp;

describe('commonApp', () => {
    useCleanState();

    describe('Global.Yes', () => {
        it('acts only for the common sender, whatever its case', () => {
            systemApp.dialogs.disclaimerActive = true;
            const ws = createMockWs();

            events['Global.Yes'](ws, {}, 'ecoenergy-unknown');
            assert.equal(systemApp.dialogs.disclaimerActive, true);

            events['Global.Yes'](ws, {}, 'Common');
            assert.equal(systemApp.dialogs.disclaimerActive, false);
        });

        it('answers the dialog that is open, in a fixed order', () => {
            systemApp.dialogs.disclaimerActive = true;
            syssettingsApp.dialogs.factoryResetConfirmActive = true;

            events['Global.Yes'](createMockWs(), {}, 'common');

            // The Disclaimer comes first; the factory reset dialog is left alone.
            assert.equal(systemApp.dialogs.disclaimerActive, false);
            assert.equal(syssettingsApp.dialogs.factoryResetConfirmActive, true);
        });
    });

    describe('Timeout', () => {
        it('closes only the Disclaimer', () => {
            const ws = createMockWs();
            events.Timeout(ws, {}, 'system');
            assert.deepEqual(ws.messages, []);

            systemApp.dialogs.disclaimerActive = true;
            events.Timeout(ws, {}, 'system');
            assert.equal(systemApp.dialogs.disclaimerActive, false);
            assert.deepEqual(contexts(ws), ['HomeScreen']);
        });
    });

    describe('Global.GoBack', () => {
        it('clears the flag of the dialog it closes and shows the screen below', () => {
            setBackStack(['system', 'HomeScreen'], ['syssettings', 'FactoryResetConfirm']);
            syssettingsApp.dialogs.factoryResetConfirmActive = true;
            const ws = createMockWs();

            events['Global.GoBack'](ws, {}, 'common-not-matching');

            assert.equal(syssettingsApp.dialogs.factoryResetConfirmActive, false);
            assert.deepEqual(backStack(), ['HomeScreen']);
            assert.deepEqual(contexts(ws), ['HomeScreen']);
        });

        it('never empties the stack', () => {
            setBackStack(['system', 'HomeScreen']);
            const ws = createMockWs();
            events['Global.GoBack'](ws, {}, 'common');
            assert.deepEqual(backStack(), ['HomeScreen']);
            assert.deepEqual(ws.messages, []);
        });
    });

    describe('SelectSettings', () => {
        it('opens the settings of the sender: ecoenergy has its own', () => {
            vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = 1;
            const fromSystem = createMockWs();
            events.SelectSettings(fromSystem, {}, 'system');
            assert.match(contextPaths(fromSystem)[0], /^vehsettings\/HUDTab/);

            const fromEco = createMockWs();
            events.SelectSettings(fromEco, {}, 'ecoenergy');
            assert.deepEqual(contextPaths(fromEco), ['ecoenergy/Settings']);
        });
    });
});
