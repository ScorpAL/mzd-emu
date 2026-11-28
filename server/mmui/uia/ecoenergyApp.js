const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const settings = require('../services/settings');
const logger = require('../../logger');

const PAGE_SEQUENCE = ['ControlStatus', 'Effectiveness', 'FuelConsumption'];
// Youngest-first order: indices 0..9 = 0..10 min, 10..11 = 10..30 min (past 30 min), 12..14 = 30..60 min (0).
// Values are in tenths of L/100km (GUI multiplies by 0.1).
const SAMPLE_CURRENT_DRIVE_GRAPH = [81, 90, 66, 108, 111, 125, 118, 96, 84, 78, 82, 75, 0, 0, 0];
// Past 5 days in tenths of L/100km (6, 5, 4, 3, 2 days ago).
const SAMPLE_CUMULATIVE_GRAPH = [86, 89, 132, 84, 76];

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
    const hasData = settings.HARDWARE_CONFIG.ecoEnergyData === 'On';
    sendMsg(ws, 'FuelType', { FuelType: 'GAS' });

    sendMsg(ws, 'CurrEquippedFeature', { CurrFeature: hasData ? 'ISTOP_IELOOP' : 'ISTOP' });
    sendMsg(ws, 'CurrAvgDriveFuelEco', {
        CurrentAvgFuelEco: {
            CurdrvAvlFuel: { Drv1AvlFuelE: hasData ? 81 : 0 },
            CurdrvAvlFuel_unit: 'L100KM'
        }
    });
    sendMsg(ws, 'CumulativeAvgFuelEconomy', {
        CumulativeAvgFuelEco: {
            cntrlstat_fuelEff: { cumlAvgEfficiency: hasData ? 81 : 0 },
            cumlEff_unit: 'L100KM'
        }
    });

    sendMsg(ws, 'iELoopCntrlStatus', {
        iELoop_CntrlStatus: {
            capacitor: hasData ? 'LVL_4' : 'LVL_0',
            motor_generator: hasData ? 'LEVEL5' : 'NO',
            CapToElc_B_Actl: hasData ? 'YES' : 'NO'
        }
    });
    sendMsg(ws, 'CylinderDeactivation', {
        CylinderStatus: hasData ? '2_4' : 'NONE'
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
            iStop_timeIG: hasData ? 185 : 0,
            iStopTotalTime: hasData ? 1420 : 0
        }
    });

    sendMsg(ws, 'iStopEffectiveRate', {
        iStop_EffectiveRate: { iStop_effective_rate: hasData ? 44 : 0 }
    });
    sendMsg(ws, 'iELoopEffectiveRate', {
        iELoop_EffectiveRate: { iEloopEffectiveRate: hasData ? 38 : 0 }
    });
    sendMsg(ws, 'iELoopEffectiveData', {
        iEloop_EffectiveData: {
            effectiveness_RgnPwrTotal: { RgnPwrTotal: hasData ? 145 : 0 },
            effectiveness_ElecLoadTotal: { ElecLoadTotal: hasData ? 112 : 0 },
            RegnPowr_unit: 'WH',
            ElecLoad_unit: 'WH'
        }
    });
    sendMsg(ws, 'iStopEffectiveTimeData', {
        iStop_EffectiveTime: {
            effectiveness_iStop_time: {
                iStop_timeIG: hasData ? 185 : 0,
                iStopTotalTime: hasData ? 1420 : 0
            },
            effectiveness_TotStpTime: { tot_time_veh_stopped: hasData ? 420 : 0 }
        }
    });
    sendMsg(ws, 'TotalSavedDistance', {
        DistanceSaved: {
            TotSvdDistance: hasData ? 12.6 : 0,
            TotSvdDistance_unit: 'KM'
        }
    });
    sendMsg(ws, 'TreeData', {
        LeavesIcon_growth: hasData ? 4 : 0,
        TreeGrowth: { TreeIcon_growth: hasData ? 3 : 0 }
    });

    sendMsg(ws, 'CurrDrvEcoPerInstBarGraph', {
        CurrDrvFuelEco_BarGraph: {
            EEM_CurDrvAvgFuelEco: createCurrentDriveGraph(hasData)
        }
    });
    sendMsg(ws, 'CumFuelResetEcoGraphData', {
        CumFuelResetEcoGraph: {
            EEM_cumAvgFuelEffAfterReset: createCumulativeGraph(hasData)
        }
    });
    sendMsg(ws, 'ResetButtonEnabled', { ResetButton: 'ENABLED' });
}

function createCurrentDriveGraph(hasData) {
    const values = [];
    for (let i = 0; i < SAMPLE_CURRENT_DRIVE_GRAPH.length; i += 1) {
        values.push({ Drv1AvlFuelE: hasData ? SAMPLE_CURRENT_DRIVE_GRAPH[i] : 0 });
    }
    return values;
}

function createCumulativeGraph(hasData) {
    const values = [];
    for (let i = 0; i < 5; i += 1) {
        values.push({ cumlAvgEfficiency: hasData ? SAMPLE_CUMULATIVE_GRAPH[i] : 0 });
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

// Events of this application (see docs/NATIVE_MAP.md), dispatched by eventId.
const events = {
    SelectSwitchView: (ws) => handleSelectSwitchView(ws),
    ResetConfirm: (ws) => handleResetConfirm(ws),
    SelectSourceMenu: (ws) => handleSelectSourceMenu(ws)
};

module.exports = {
    events: events,
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
