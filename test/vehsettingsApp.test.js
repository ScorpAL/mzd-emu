const test = require('node:test');
const assert = require('node:assert/strict');

const vehsettingsApp = require('../server/mmui/vehsettingsApp');
const settings = require('../server/mmui/settings');
const navigationState = require('../server/mmui/navigationState');
const dialogState = require('../server/mmui/dialogState');
const { createMockWs } = require('./helpers/mockWs');

function withStubbedSave(fn) {
    const originalSave = settings.saveUserSettings;
    settings.saveUserSettings = () => {};
    try {
        fn();
    } finally {
        settings.saveUserSettings = originalSave;
    }
}

test.afterEach(() => {
    navigationState.goBackStack.length = 0;
    Object.keys(dialogState).forEach((key) => {
        if (typeof dialogState[key] === 'boolean') {
            dialogState[key] = false;
        }
    });
});

test('sendVehicleFeatureInstalled/sendVehicleCapabilityState/sendHudType/sendNavigationAvailability/sendIgnitionOn all report state', () => {
    const ws = createMockWs();
    vehsettingsApp.sendVehicleFeatureInstalled(ws);
    vehsettingsApp.sendVehicleCapabilityState(ws);
    vehsettingsApp.sendHudType(ws);
    vehsettingsApp.sendNavigationAvailability(ws);
    vehsettingsApp.sendIgnitionOn(ws);

    assert.ok(ws.messages.length > 10);
    assert.ok(ws.messages.some((m) => m.msgId === 'HudType'));
    assert.ok(ws.messages.some((m) => m.msgId === 'NAVIEquipped'));
    assert.ok(
        ws.messages.some((m) => m.msgId === 'IgnitionStatus' && m.params.payload.evData === 1)
    );
});

test('sendHudState translates the numeric hudRotation into a Level_* label', () => {
    withStubbedSave(() => {
        const original = settings.currentSettings.hudRotation;
        settings.currentSettings.hudRotation = -2;

        const ws = createMockWs();
        vehsettingsApp.sendHudState(ws);

        const rotation = ws.messages.find((m) => m.msgId === 'GetHUDRotation');
        assert.equal(rotation.params.payload.evData, 'Level_minus_2');

        settings.currentSettings.hudRotation = original;
    });
});

test('handleHudEvent persists simple HUD fields and reports unknown events', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        assert.equal(
            vehsettingsApp.handleHudEvent(ws, 'SetHudHeight', { payload: { evData: 5 } }),
            undefined
        );
        assert.equal(settings.currentSettings.hudHeight, 5);

        assert.equal(
            vehsettingsApp.handleHudEvent(ws, 'SetHUDRotation', {
                payload: { evData: 'Level_plus_2' }
            }),
            undefined
        );
        assert.equal(settings.currentSettings.hudRotation, 2);

        assert.equal(vehsettingsApp.handleHudEvent(ws, 'UnknownEvent', {}), false);
    });
});

test('handleHudEvent SelectDisplayInformation opens the HUD display info context', () => {
    const ws = createMockWs();
    const handled = vehsettingsApp.handleHudEvent(ws, 'SelectDisplayInformation', {});

    assert.equal(handled, true);
    const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
    assert.equal(ctxtChg.ctxtId, 'HUDDisplayInformation');
});

test('HUD reset: GoHUDReset opens the confirm dialog and Yes restores every HUD default', () => {
    withStubbedSave(() => {
        navigationState.goBackStack.push({ uiaId: 'vehsettings', ctxtId: 'HUDTab', contextSeq: 1 });
        settings.currentSettings.hudHeight = 3;
        settings.currentSettings.hudDisplay = 0;

        const ws = createMockWs();
        vehsettingsApp.handleGoHudReset(ws);
        assert.equal(dialogState.hudResetConfirmActive, true);

        vehsettingsApp.handleHudResetYes(ws);

        assert.equal(settings.currentSettings.hudHeight, 0);
        assert.equal(settings.currentSettings.hudDisplay, 1);
        assert.equal(dialogState.hudResetConfirmActive, false);
        assert.equal(dialogState.hudResetProgressActive, false);
        assert.equal(navigationState.goBackStack.length, 1);
        assert.equal(navigationState.goBackStack[0].ctxtId, 'HUDTab');
    });
});

test('HUD reset: No dismisses without changing any values', () => {
    withStubbedSave(() => {
        navigationState.goBackStack.push({ uiaId: 'vehsettings', ctxtId: 'HUDTab', contextSeq: 1 });
        settings.currentSettings.hudHeight = 3;

        const ws = createMockWs();
        vehsettingsApp.handleGoHudReset(ws);
        vehsettingsApp.handleHudResetNo(ws);

        assert.equal(settings.currentSettings.hudHeight, 3);
        assert.equal(dialogState.hudResetConfirmActive, false);
        settings.currentSettings.hudHeight = 0;
    });
});

test('Display info reset restores navigation/street defaults', () => {
    withStubbedSave(() => {
        navigationState.goBackStack.push({ uiaId: 'vehsettings', ctxtId: 'HUDTab', contextSeq: 1 });
        settings.currentSettings.hudStreetInformation = 'Street_Never';

        const ws = createMockWs();
        vehsettingsApp.handleDisplayInfoReset(ws);
        assert.equal(dialogState.hudDisplayInfoResetConfirmActive, true);

        vehsettingsApp.handleDisplayInfoResetYes(ws);
        assert.equal(settings.currentSettings.hudStreetInformation, 'Street_Always');
        assert.equal(dialogState.hudDisplayInfoResetConfirmActive, false);
    });
});

test('sendDoorLockState and sendSpeedAlarmState report cached values', () => {
    let ws = createMockWs();
    vehsettingsApp.sendDoorLockState(ws);
    assert.deepEqual(
        ws.messages.map((m) => m.msgId),
        [
            'GetAutoDoorLockAT6',
            'GetKeylessLockBeepVol',
            'GetAutoRelockTimer',
            'GetUnlockMode',
            'GetWalkAwayLock',
            'GetHandsFreeLiftgate'
        ]
    );

    withStubbedSave(() => {
        const original = settings.currentSettings.speedAlarmOnOff;
        settings.currentSettings.speedAlarmOnOff = 'SpeedAlarm_Off';
        ws = createMockWs();
        vehsettingsApp.sendSpeedAlarmState(ws);
        assert.equal(ws.messages[0].params.payload.evData, 1);
        settings.currentSettings.speedAlarmOnOff = original;
    });
});

test('handleVehicleSettingsEvent persists door lock and speed alarm fields, and reports unknown events', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        assert.equal(
            vehsettingsApp.handleVehicleSettingsEvent(ws, 'SetWalkAwayLock', {
                payload: { evData: 'WalkAwayLock_On' }
            }),
            true
        );
        assert.equal(settings.currentSettings.walkAwayLock, 'WalkAwayLock_On');

        assert.equal(
            vehsettingsApp.handleVehicleSettingsEvent(ws, 'SetSpeedAlarmOnOff', {
                payload: { evData: 'SpeedAlarm_On' }
            }),
            true
        );
        assert.equal(settings.currentSettings.speedAlarmOnOff, 'SpeedAlarm_On');

        assert.equal(vehsettingsApp.handleVehicleSettingsEvent(ws, 'UnknownEvent', {}), false);
    });
});

test('Door lock reset restores every door lock default', () => {
    withStubbedSave(() => {
        navigationState.goBackStack.push({
            uiaId: 'vehsettings',
            ctxtId: 'VehicleSettingsTab',
            contextSeq: 1
        });
        settings.currentSettings.walkAwayLock = 'WalkAwayLock_On';

        const ws = createMockWs();
        vehsettingsApp.handleGoDoorLockReset(ws);
        assert.equal(dialogState.doorLockResetConfirmActive, true);

        vehsettingsApp.handleDoorLockResetYes(ws);
        assert.equal(settings.currentSettings.walkAwayLock, 'WalkAwayLock_Off');
        assert.equal(dialogState.doorLockResetConfirmActive, false);
        assert.equal(navigationState.goBackStack.length, 1);
    });
});

test('sendSafetyState reports normalized safety values, and SetBSMSystem/BuzzerVolume refresh BSM state', () => {
    withStubbedSave(() => {
        settings.currentSettings.bsmSystem = 'BSM_Weird';
        settings.currentSettings.scbsMode = 'SBS_On';

        let ws = createMockWs();
        vehsettingsApp.sendSafetyState(ws);
        const bsmMsg = ws.messages.find((m) => m.msgId === 'BSMSystem_Status');
        assert.equal(bsmMsg.params.payload.evData, 'BSM_On');
        const scbsMsg = ws.messages.find((m) => m.msgId === 'GetSCBS');
        assert.equal(scbsMsg.params.payload.evData, 'SCBS_On');

        ws = createMockWs();
        vehsettingsApp.handleSafetySettingsEvent(ws, 'SetBSMBuzzerVolume', {
            payload: { evData: 'BSM_Vol_Middle' }
        });
        assert.equal(settings.currentSettings.bsmBuzzerVolume, 'BSM_Vol_Middle');
        assert.ok(ws.messages.some((m) => m.msgId === 'BSMSystem_Status'));
        assert.ok(ws.messages.some((m) => m.msgId === 'GetBSMBuzzerVolume'));
    });
});

test('handleSafetySettingsEvent persists simple safety fields', () => {
    withStubbedSave(() => {
        const ws = createMockWs();
        assert.equal(
            vehsettingsApp.handleSafetySettingsEvent(ws, 'SetDRSS', {
                payload: { evData: 'DRSS_On' }
            }),
            true
        );
        assert.equal(settings.currentSettings.drssMode, 'DRSS_On');

        assert.equal(vehsettingsApp.handleSafetySettingsEvent(ws, 'UnknownEvent', {}), false);
    });
});

test('handleSafetySettingsEvent SetBSMSystem toggles when the payload carries no explicit on/off', () => {
    withStubbedSave(() => {
        settings.currentSettings.bsmSystem = 'BSM_On';
        const ws = createMockWs();

        vehsettingsApp.handleSafetySettingsEvent(ws, 'SetBSMSystem', {
            payload: { evData: 'toggle' }
        });

        assert.equal(settings.currentSettings.bsmSystem, 'BSM_Off');
    });
});

test('DRSS reset (synchronous) restores DRSS mode/distance defaults', () => {
    withStubbedSave(() => {
        navigationState.goBackStack.push({
            uiaId: 'vehsettings',
            ctxtId: 'SafetyTab',
            contextSeq: 1
        });
        settings.currentSettings.drssMode = 'DRSS_On';

        const ws = createMockWs();
        vehsettingsApp.handleGoDRSSReset(ws);
        assert.equal(dialogState.drssResetConfirmActive, true);

        vehsettingsApp.handleDrssResetYes(ws);
        assert.equal(settings.currentSettings.drssMode, 'DRSS_Off');
        assert.equal(dialogState.drssResetConfirmActive, false);
    });
});

test('LAS reset (async) restores LAS/LDWS defaults after the progress delay', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    withStubbedSave(() => {
        navigationState.goBackStack.push({
            uiaId: 'vehsettings',
            ctxtId: 'SafetyTab',
            contextSeq: 1
        });
        navigationState.goBackStack.push({ uiaId: 'vehsettings', ctxtId: 'LAS', contextSeq: 2 });
        settings.currentSettings.lasIntervention = 'LAS_Intervention_Off';

        const ws = createMockWs();
        vehsettingsApp.handleGoLasReset(ws);
        vehsettingsApp.handleLasResetYes(ws);
        assert.equal(dialogState.lasResetProgressActive, true);

        t.mock.timers.tick(800);

        assert.equal(settings.currentSettings.lasIntervention, 'LAS_Intervention_On');
        assert.equal(dialogState.lasResetProgressActive, false);
        assert.equal(
            navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId,
            'SafetyTab'
        );
    });
});

test('sendTurnSettingsState/handleTurnSettingsEvent/turn reset flow', () => {
    withStubbedSave(() => {
        let ws = createMockWs();
        vehsettingsApp.sendTurnSettingsState(ws);
        assert.deepEqual(
            ws.messages.map((m) => m.msgId),
            ['Get3FlashTurnSignal', 'GetTurnSignalIndicatorVolume']
        );

        ws = createMockWs();
        vehsettingsApp.handleTurnSettingsEvent(ws, 'Set3FlashTurnSignal', {
            payload: { evData: 'Three_Flash_On' }
        });
        assert.equal(settings.currentSettings.threeFlashTurnSignal, 'Three_Flash_On');
        assert.equal(vehsettingsApp.handleTurnSettingsEvent(ws, 'Unknown', {}), false);

        navigationState.goBackStack.push({
            uiaId: 'vehsettings',
            ctxtId: 'VehicleSettingsTab',
            contextSeq: 1
        });
        vehsettingsApp.handleGoTurnReset(ws);
        vehsettingsApp.handleTurnResetYes(ws);
        assert.equal(settings.currentSettings.threeFlashTurnSignal, 'Three_Flash_Off');
        assert.equal(dialogState.turnResetConfirmActive, false);
    });
});

test('sendLightingState/handleLightingSettingsEvent/lighting reset flow', () => {
    withStubbedSave(() => {
        let ws = createMockWs();
        vehsettingsApp.sendLightingState(ws);
        assert.ok(ws.messages.some((m) => m.msgId === 'GetILB'));
        assert.ok(ws.messages.some((m) => m.msgId === 'GetDRL'));

        ws = createMockWs();
        assert.equal(
            vehsettingsApp.handleLightingSettingsEvent(ws, 'SetHBC', {
                payload: { evData: 'HBC_On' }
            }),
            true
        );
        assert.equal(settings.currentSettings.lightingHighBeamControl, 'HBC_On');
        assert.equal(vehsettingsApp.handleLightingSettingsEvent(ws, 'Unknown', {}), false);

        navigationState.goBackStack.push({
            uiaId: 'vehsettings',
            ctxtId: 'VehicleSettingsTab',
            contextSeq: 1
        });
        vehsettingsApp.handleGoLightingReset(ws);
        vehsettingsApp.handleLightingResetYes(ws);
        assert.equal(settings.currentSettings.lightingHighBeamControl, 'HBC_Off');
        assert.equal(dialogState.lightingResetConfirmActive, false);
    });
});

test('simple Go* navigation handlers open their expected contexts', () => {
    const cases = [
        ['handleGoSBS', 'SBS'],
        ['handleGoSBS_SCBS', 'SBS_SCBS'],
        ['handleGoFOW', 'FOW'],
        ['handleGoDoorLock', 'DoorLock'],
        ['handleGoUnlockMode', 'UnlockMode'],
        ['handleGoDoorLockMode', 'DoorLockMode'],
        ['handleGoKeylessLockBeepVol', 'KeylessLockBeepVol'],
        ['handleGoDoorRelockTime', 'DoorRelockTime'],
        ['handleGoTurnSettings', 'TurnSettings'],
        ['handleGoLighting', 'Lighting']
    ];

    cases.forEach(([handlerName, expectedCtxtId]) => {
        const ws = createMockWs();
        vehsettingsApp[handlerName](ws);
        const ctxtChg = ws.messages.find((m) => m.msgType === 'ctxtChg');
        assert.equal(ctxtChg.ctxtId, expectedCtxtId, handlerName);
    });
});

test('handleOpenSafetyContext and handleSelectSpeedLimitInfo pick the HUD-aware SLI context', () => {
    const original = settings.HARDWARE_CONFIG.hudType;

    settings.HARDWARE_CONFIG.hudType = 'WHUD_color';
    let ws = createMockWs();
    vehsettingsApp.handleSelectSpeedLimitInfo(ws);
    assert.equal(ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId, 'SLI_WHUD');

    settings.HARDWARE_CONFIG.hudType = 'None';
    ws = createMockWs();
    vehsettingsApp.handleSelectSpeedLimitInfo(ws);
    assert.equal(ws.messages.find((m) => m.msgType === 'ctxtChg').ctxtId, 'SLI');

    settings.HARDWARE_CONFIG.hudType = original;
});
