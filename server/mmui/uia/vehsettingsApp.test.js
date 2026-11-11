const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const vehsettingsApp = require('./vehsettingsApp');
const settings = require('../services/settings');
const { createMockWs, contexts, messageOf, payloadOf } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');
const { useMockTimers } = require('../../testing/timers');

const app = vehsettingsApp;
const { dialogs } = app;
const current = settings.currentSettings;

// The msgIds a "send...State" function sends, in order.
function sentBy(send) {
    const ws = createMockWs();
    send(ws);
    return ws.messages.map((m) => m.msgId);
}

describe('vehsettingsApp', () => {
    useCleanState();

    describe('vehicle state', () => {
        it('reports installed features, capabilities, HUD type, navigation and ignition', () => {
            const ws = createMockWs();
            app.sendVehicleFeatureInstalled(ws);
            app.sendVehicleCapabilityState(ws);
            app.sendHudType(ws);
            app.sendNavigationAvailability(ws);
            app.sendIgnitionOn(ws);

            assert.ok(ws.messages.length > 10);
            assert.ok(messageOf(ws, 'HudType'));
            assert.ok(messageOf(ws, 'NAVIEquipped'));
            assert.equal(payloadOf(ws, 'IgnitionStatus').evData, 1);
        });
    });

    describe('HUD', () => {
        it('the HUD state turns the numeric rotation into a Level_* label', () => {
            current.hudRotation = -2;
            const ws = createMockWs();
            app.sendHudState(ws);
            assert.equal(payloadOf(ws, 'GetHUDRotation').evData, 'Level_minus_2');
        });

        it('handleHudEvent saves simple HUD fields and reports unknown events', () => {
            const ws = createMockWs();
            assert.equal(
                app.handleHudEvent(ws, 'SetHudHeight', { payload: { evData: 5 } }),
                undefined
            );
            assert.equal(current.hudHeight, 5);

            const rotation = { payload: { evData: 'Level_plus_2' } };
            assert.equal(app.handleHudEvent(ws, 'SetHUDRotation', rotation), undefined);
            assert.equal(current.hudRotation, 2);

            assert.equal(app.handleHudEvent(ws, 'UnknownEvent', {}), false);
        });

        it('SelectDisplayInformation opens the HUD display information', () => {
            const ws = createMockWs();
            assert.equal(app.handleHudEvent(ws, 'SelectDisplayInformation', {}), true);
            assert.deepEqual(contexts(ws), ['HUDDisplayInformation']);
        });

        it('Reset asks first, and Yes restores every HUD default', () => {
            setBackStack(['vehsettings', 'HUDTab']);
            current.hudHeight = 3;
            current.hudDisplay = 0;

            const ws = createMockWs();
            app.handleGoHudReset(ws);
            assert.equal(dialogs.hudResetConfirmActive, true);
            app.handleHudResetYes(ws);

            assert.equal(current.hudHeight, 0);
            assert.equal(current.hudDisplay, 1);
            assert.equal(dialogs.hudResetConfirmActive, false);
            assert.equal(dialogs.hudResetProgressActive, false);
            assert.deepEqual(backStack(), ['HUDTab']);
        });

        it('Reset + No changes nothing', () => {
            setBackStack(['vehsettings', 'HUDTab']);
            current.hudHeight = 3;
            const ws = createMockWs();
            app.handleGoHudReset(ws);
            app.handleHudResetNo(ws);
            assert.equal(current.hudHeight, 3);
            assert.equal(dialogs.hudResetConfirmActive, false);
        });

        it('the display information reset restores the navigation and street defaults', () => {
            setBackStack(['vehsettings', 'HUDTab']);
            current.hudStreetInformation = 'Street_Never';
            const ws = createMockWs();
            app.handleDisplayInfoReset(ws);
            assert.equal(dialogs.hudDisplayInfoResetConfirmActive, true);
            app.handleDisplayInfoResetYes(ws);
            assert.equal(current.hudStreetInformation, 'Street_Always');
            assert.equal(dialogs.hudDisplayInfoResetConfirmActive, false);
        });
    });

    describe('door lock and speed alarm', () => {
        it('the door lock state reports every cached value', () => {
            assert.deepEqual(sentBy(app.sendDoorLockState), [
                'GetAutoDoorLockAT6',
                'GetKeylessLockBeepVol',
                'GetAutoRelockTimer',
                'GetUnlockMode',
                'GetWalkAwayLock',
                'GetHandsFreeLiftgate'
            ]);
        });

        it('the speed alarm state reports Off as 1', () => {
            current.speedAlarmOnOff = 'SpeedAlarm_Off';
            const ws = createMockWs();
            app.sendSpeedAlarmState(ws);
            assert.equal(ws.messages[0].params.payload.evData, 1);
        });

        it('handleVehicleSettingsEvent saves door lock and speed alarm fields, and reports unknown events', () => {
            const ws = createMockWs();
            const set = (eventId, evData) =>
                app.handleVehicleSettingsEvent(ws, eventId, { payload: { evData } });
            assert.equal(set('SetWalkAwayLock', 'WalkAwayLock_On'), true);
            assert.equal(current.walkAwayLock, 'WalkAwayLock_On');
            assert.equal(set('SetSpeedAlarmOnOff', 'SpeedAlarm_On'), true);
            assert.equal(current.speedAlarmOnOff, 'SpeedAlarm_On');
            assert.equal(app.handleVehicleSettingsEvent(ws, 'UnknownEvent', {}), false);
        });

        it('the door lock reset restores every door lock default', () => {
            setBackStack(['vehsettings', 'VehicleSettingsTab']);
            current.walkAwayLock = 'WalkAwayLock_On';
            const ws = createMockWs();
            app.handleGoDoorLockReset(ws);
            assert.equal(dialogs.doorLockResetConfirmActive, true);
            app.handleDoorLockResetYes(ws);
            assert.equal(current.walkAwayLock, 'WalkAwayLock_Off');
            assert.equal(dialogs.doorLockResetConfirmActive, false);
            assert.deepEqual(backStack(), ['VehicleSettingsTab']);
        });
    });

    describe('safety', () => {
        it('the safety state reports normalized values', () => {
            current.bsmSystem = 'BSM_Weird';
            current.scbsMode = 'SBS_On';
            const ws = createMockWs();
            app.sendSafetyState(ws);
            assert.equal(payloadOf(ws, 'BSMSystem_Status').evData, 'BSM_On');
            assert.equal(payloadOf(ws, 'GetSCBS').evData, 'SCBS_On');
        });

        it('handleSafetySettingsEvent saves simple fields and reports unknown events', () => {
            const ws = createMockWs();
            const drss = { payload: { evData: 'DRSS_On' } };
            assert.equal(app.handleSafetySettingsEvent(ws, 'SetDRSS', drss), true);
            assert.equal(current.drssMode, 'DRSS_On');
            assert.equal(app.handleSafetySettingsEvent(ws, 'UnknownEvent', {}), false);
        });

        it('SetBSMBuzzerVolume saves the volume and refreshes the BSM state', () => {
            const ws = createMockWs();
            app.handleSafetySettingsEvent(ws, 'SetBSMBuzzerVolume', {
                payload: { evData: 'BSM_Vol_Middle' }
            });
            assert.equal(current.bsmBuzzerVolume, 'BSM_Vol_Middle');
            assert.ok(messageOf(ws, 'BSMSystem_Status'));
            assert.ok(messageOf(ws, 'GetBSMBuzzerVolume'));
        });

        it('SetBSMSystem toggles when the payload carries no explicit on/off', () => {
            current.bsmSystem = 'BSM_On';
            app.handleSafetySettingsEvent(createMockWs(), 'SetBSMSystem', {
                payload: { evData: 'toggle' }
            });
            assert.equal(current.bsmSystem, 'BSM_Off');
        });

        it('the DRSS reset restores the DRSS defaults at once', () => {
            setBackStack(['vehsettings', 'SafetyTab']);
            current.drssMode = 'DRSS_On';
            const ws = createMockWs();
            app.handleGoDRSSReset(ws);
            assert.equal(dialogs.drssResetConfirmActive, true);
            app.handleDrssResetYes(ws);
            assert.equal(current.drssMode, 'DRSS_Off');
            assert.equal(dialogs.drssResetConfirmActive, false);
        });

        it('the LAS reset restores the LAS/LDWS defaults after the progress delay', (t) => {
            const timers = useMockTimers(t);
            setBackStack(['vehsettings', 'SafetyTab'], ['vehsettings', 'LAS']);
            current.lasIntervention = 'LAS_Intervention_Off';

            const ws = createMockWs();
            app.handleGoLasReset(ws);
            app.handleLasResetYes(ws);
            assert.equal(dialogs.lasResetProgressActive, true);

            timers.tick(800);
            assert.equal(current.lasIntervention, 'LAS_Intervention_On');
            assert.equal(dialogs.lasResetProgressActive, false);
            assert.equal(backStack().at(-1), 'SafetyTab');
        });

        it('the Speed Limit Information screen depends on the HUD type', () => {
            for (const [hudType, expected] of [
                ['WHUD_color', 'SLI_WHUD'],
                ['None', 'SLI']
            ]) {
                settings.HARDWARE_CONFIG.hudType = hudType;
                const ws = createMockWs();
                app.handleSelectSpeedLimitInfo(ws);
                assert.deepEqual(contexts(ws), [expected], hudType);
            }
        });
    });

    describe('turn signals and lighting', () => {
        it('the turn signal state, its events and its reset', () => {
            assert.deepEqual(sentBy(app.sendTurnSettingsState), [
                'Get3FlashTurnSignal',
                'GetTurnSignalIndicatorVolume'
            ]);

            const ws = createMockWs();
            app.handleTurnSettingsEvent(ws, 'Set3FlashTurnSignal', {
                payload: { evData: 'Three_Flash_On' }
            });
            assert.equal(current.threeFlashTurnSignal, 'Three_Flash_On');
            assert.equal(app.handleTurnSettingsEvent(ws, 'Unknown', {}), false);

            setBackStack(['vehsettings', 'VehicleSettingsTab']);
            app.handleGoTurnReset(ws);
            app.handleTurnResetYes(ws);
            assert.equal(current.threeFlashTurnSignal, 'Three_Flash_Off');
            assert.equal(dialogs.turnResetConfirmActive, false);
        });

        it('the lighting state, its events and its reset', () => {
            const sent = sentBy(app.sendLightingState);
            assert.ok(sent.includes('GetILB') && sent.includes('GetDRL'));

            const ws = createMockWs();
            const hbc = { payload: { evData: 'HBC_On' } };
            assert.equal(app.handleLightingSettingsEvent(ws, 'SetHBC', hbc), true);
            assert.equal(current.lightingHighBeamControl, 'HBC_On');
            assert.equal(app.handleLightingSettingsEvent(ws, 'Unknown', {}), false);

            setBackStack(['vehsettings', 'VehicleSettingsTab']);
            app.handleGoLightingReset(ws);
            app.handleLightingResetYes(ws);
            assert.equal(current.lightingHighBeamControl, 'HBC_Off');
            assert.equal(dialogs.lightingResetConfirmActive, false);
        });
    });

    describe('navigation', () => {
        it('the simple Go* handlers open their contexts', () => {
            for (const [handlerName, expected] of [
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
            ]) {
                const ws = createMockWs();
                app[handlerName](ws);
                assert.equal(contexts(ws)[0], expected, handlerName);
            }
        });
    });
});
