const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const ecoenergyApp = require('./ecoenergyApp');
const settings = require('../services/settings');
const { createMockWs, contexts, contextPaths, msgIds, payloadOf } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');

describe('ecoenergyApp', () => {
    useCleanState();

    it('SelectEcoEnergy sends the full state and opens ControlStatus', () => {
        const ws = createMockWs();
        ecoenergyApp.handleSelectEcoEnergy(ws);
        assert.ok(msgIds(ws).includes('FuelType'));
        assert.ok(msgIds(ws).includes('TreeData'));
        assert.deepEqual(contexts(ws), ['ControlStatus']);
    });

    it('SwitchView cycles ControlStatus -> Effectiveness -> FuelConsumption -> ControlStatus', () => {
        for (const [from, to] of [
            ['ControlStatus', 'Effectiveness'],
            ['Effectiveness', 'FuelConsumption'],
            ['FuelConsumption', 'ControlStatus']
        ]) {
            setBackStack(['ecoenergy', from]);
            const ws = createMockWs();
            ecoenergyApp.handleSelectSwitchView(ws);
            assert.deepEqual(contexts(ws), [to], from);
        }
    });

    it('SelectSourceMenu switches to the system Applications screen', () => {
        const ws = createMockWs();
        ecoenergyApp.handleSelectSourceMenu(ws);
        assert.deepEqual(contextPaths(ws), ['system/Applications']);
    });

    describe('reset', () => {
        it('the confirmation is active only while it is on top of the stack', () => {
            assert.equal(ecoenergyApp.isResetConfirmActive(), false, 'empty stack');
            setBackStack(['ecoenergy', 'ControlStatus']);
            assert.equal(ecoenergyApp.isResetConfirmActive(), false);
            setBackStack(['ecoenergy', 'ControlStatus'], ['ecoenergy', 'ResetConfirm']);
            assert.equal(ecoenergyApp.isResetConfirmActive(), true);
        });

        it('Cancel returns to the page that was shown before the confirmation', () => {
            setBackStack(['ecoenergy', 'Effectiveness'], ['ecoenergy', 'ResetConfirm']);
            const ws = createMockWs();
            ecoenergyApp.handleResetCancel(ws);
            assert.deepEqual(backStack(), ['Effectiveness']);
            assert.deepEqual(contexts(ws), ['Effectiveness']);
        });

        it('Yes reports the reset and returns to the previous page', () => {
            setBackStack(['ecoenergy', 'FuelConsumption'], ['ecoenergy', 'ResetConfirm']);
            const ws = createMockWs();
            ecoenergyApp.handleResetConfirmYes(ws);
            assert.ok(msgIds(ws).includes('ResetSuccess'));
            assert.equal(contexts(ws).at(-1), 'FuelConsumption');
        });
    });

    it('ecoEnergyData config switches between populated sample data and empty zeros', () => {
        const prev = settings.HARDWARE_CONFIG.ecoEnergyData;
        try {
            settings.HARDWARE_CONFIG.ecoEnergyData = 'On';
            const wsOn = createMockWs();
            ecoenergyApp.sendEcoEnergyState(wsOn);
            assert.ok(payloadOf(wsOn, 'TotalSavedDistance').DistanceSaved.TotSvdDistance > 0);
            assert.equal(payloadOf(wsOn, 'CurrEquippedFeature').CurrFeature, 'ISTOP_IELOOP');
            assert.equal(
                payloadOf(wsOn, 'iELoopCntrlStatus').iELoop_CntrlStatus.capacitor,
                'LVL_4'
            );
            const barGraph = payloadOf(wsOn, 'CurrDrvEcoPerInstBarGraph').CurrDrvFuelEco_BarGraph
                .EEM_CurDrvAvgFuelEco;
            assert.equal(barGraph.length, 15);
            assert.ok(barGraph[11].Drv1AvlFuelE > 0);
            assert.equal(barGraph[12].Drv1AvlFuelE, 0);

            settings.HARDWARE_CONFIG.ecoEnergyData = 'Off';
            const wsOff = createMockWs();
            ecoenergyApp.sendEcoEnergyState(wsOff);
            assert.equal(payloadOf(wsOff, 'TotalSavedDistance').DistanceSaved.TotSvdDistance, 0);
            assert.equal(payloadOf(wsOff, 'CurrEquippedFeature').CurrFeature, 'ISTOP');
        } finally {
            settings.HARDWARE_CONFIG.ecoEnergyData = prev;
        }
    });
});
