const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('./navigationState');
const logger = require('../logger');

const PAGE_SEQUENCE = ['ControlStatus', 'Effectiveness', 'FuelConsumption'];

function sendMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'ecoenergy',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('ecoenergy', 'Sent message msgId=%s', msgId);
}

function sendEcoEnergyState(ws) {
    sendMsg(ws, 'FuelType', { FuelType: 'GAS' });

    // The user's EU vehicle shows i-stop only: no i-ELOOP and no mHybrid pages.
    sendMsg(ws, 'CurrEquippedFeature', { CurrFeature: 'ISTOP' });
    sendMsg(ws, 'CurrAvgDriveFuelEco', {
        CurrentAvgFuelEco: {
            CurdrvAvlFuel: { Drv1AvlFuelE: 0 },
            CurdrvAvlFuel_unit: 'L100KM'
        }
    });
    sendMsg(ws, 'CumulativeAvgFuelEconomy', {
        CumulativeAvgFuelEco: {
            cntrlstat_fuelEff: { cumlAvgEfficiency: 0 },
            cumlEff_unit: 'L100KM'
        }
    });

    sendMsg(ws, 'iStopModeCntrlStatus', { iStop_ModeStatus: 'STATUS' });
    sendMsg(ws, 'iStopStatCntrlStatus', {
        iStop_StatCntrlStatus: {
            gasolinedieselStandby: { enginetypeStandy: 'TRUE' },
            batterystandby: { batteryStandby: 'TRUE' },
            heaterstandby: { heaterControlStandby: 'TRUE' },
            istopStatus: { istpStatus: 'TRUE' }
        }
    });
    sendMsg(ws, 'iStopTimeCntrlStatus', {
        iStop_TimeStatus: {
            iStop_timeIG: 0,
            iStopTotalTime: 0
        }
    });

    sendMsg(ws, 'iStopEffectiveRate', {
        iStop_EffectiveRate: { iStop_effective_rate: 0 }
    });
    sendMsg(ws, 'iStopEffectiveTimeData', {
        iStop_EffectiveTime: {
            effectiveness_iStop_time: {
                iStop_timeIG: 0,
                iStopTotalTime: 0
            },
            effectiveness_TotStpTime: { tot_time_veh_stopped: 0 }
        }
    });
    sendMsg(ws, 'TotalSavedDistance', {
        DistanceSaved: {
            TotSvdDistance: 0,
            TotSvdDistance_unit: 'KM'
        }
    });
    sendMsg(ws, 'TreeData', {
        LeavesIcon_growth: 0,
        TreeGrowth: { TreeIcon_growth: 0 }
    });

    sendMsg(ws, 'CurrDrvEcoPerInstBarGraph', {
        CurrDrvFuelEco_BarGraph: {
            EEM_CurDrvAvgFuelEco: createCurrentDriveGraph()
        }
    });
    sendMsg(ws, 'CumFuelResetEcoGraphData', {
        CumFuelResetEcoGraph: {
            EEM_cumAvgFuelEffAfterReset: createCumulativeGraph()
        }
    });
    sendMsg(ws, 'ResetButtonEnabled', { ResetButton: 'ENABLED' });
}

function createCurrentDriveGraph() {
    const values = [];
    for (let i = 0; i < 20; i += 1) {
        values.push({ Drv1AvlFuelE: 0 });
    }
    return values;
}

function createCumulativeGraph() {
    const values = [];
    for (let i = 0; i < 5; i += 1) {
        values.push({ cumlAvgEfficiency: 0 });
    }
    return values;
}

function handleSelectEcoEnergy(ws) {
    sendEcoEnergyState(ws);
    sendContextChange(ws, 'ecoenergy', 'ControlStatus');
}

function handleSelectSwitchView(ws) {
    sendEcoEnergyState(ws);
    const currentContext = getCurrentEcoContext();
    const currentIndex = PAGE_SEQUENCE.indexOf(currentContext);
    const nextContext = PAGE_SEQUENCE[(currentIndex + 1) % PAGE_SEQUENCE.length];
    sendContextChange(ws, 'ecoenergy', nextContext);
}

function handleResetConfirm(ws) {
    sendContextChange(ws, 'ecoenergy', 'ResetConfirm');
}

function handleResetCancel(ws) {
    returnToPreviousEcoPage(ws);
}

function handleResetConfirmYes(ws) {
    sendEcoEnergyState(ws);
    sendMsg(ws, 'ResetSuccess', { ResetSuccess: true });
    returnToPreviousEcoPage(ws);
}

function handleSelectSettings(ws) {
    sendContextChange(ws, 'ecoenergy', 'Settings', {
        payload: {
            settingsEnableDisable: 'Enable',
            endingScreen: 2,
            sync: 2
        }
    });
}

function handleSelectSourceMenu(ws) {
    sendContextChange(ws, 'system', 'Applications');
}

function isResetConfirmActive() {
    return (
        navigationState.goBackStack.length > 0 &&
        navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId === 'ecoenergy' &&
        navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
            'ResetConfirm'
    );
}

function getCurrentEcoContext() {
    for (let i = navigationState.goBackStack.length - 1; i >= 0; i -= 1) {
        const entry = navigationState.goBackStack[i];
        if (entry.uiaId === 'ecoenergy') {
            return entry.ctxtId;
        }
    }
    return 'ControlStatus';
}

function returnToPreviousEcoPage(ws) {
    if (
        navigationState.goBackStack.length > 1 &&
        navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId === 'ecoenergy' &&
        navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
            'ResetConfirm'
    ) {
        navigationState.goBackStack.pop();
        const context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
        sendContextChange(
            ws,
            context.uiaId,
            context.ctxtId,
            context.params,
            context.contextSeq,
            true
        );
        return;
    }

    sendContextChange(ws, 'ecoenergy', getCurrentEcoContext());
}

module.exports = {
    sendEcoEnergyState: sendEcoEnergyState,
    handleSelectEcoEnergy: handleSelectEcoEnergy,
    handleSelectSwitchView: handleSelectSwitchView,
    handleResetConfirm: handleResetConfirm,
    handleResetCancel: handleResetCancel,
    handleResetConfirmYes: handleResetConfirmYes,
    handleSelectSettings: handleSelectSettings,
    handleSelectSourceMenu: handleSelectSourceMenu,
    isResetConfirmActive: isResetConfirmActive
};
