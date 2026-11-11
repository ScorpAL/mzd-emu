const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const systemApp = require('./systemApp');
const coldStart = require('../services/coldStart');
const settings = require('../services/settings');
const vehicleEquipment = require('../services/vehicleEquipment');
const { createMockWs, contexts, contextPaths, msgIds } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack, backStackPaths } = require('../../testing/state');
const { useMockTimers } = require('../../testing/timers');

const { events, dialogs } = systemApp;
const hardware = settings.HARDWARE_CONFIG;

describe('systemApp', () => {
    useCleanState();

    describe('cold start', () => {
        it('Global.InitGui clears navigation and sends no context of its own', () => {
            setBackStack(['system', 'Applications']);
            const ws = createMockWs();
            events['Global.InitGui'](ws);
            assert.deepEqual(backStack(), []);
            assert.deepEqual(ws.messages, []);
        });

        it('GetStartupSettings sends the state of every subsystem and lands on IntroAnimation', () => {
            const ws = createMockWs();
            systemApp.handleGetStartupSettings(ws);
            systemApp.cancelColdStart(ws);

            for (const msgId of ['Region', 'BoseAvailable', 'BTStatusAndList']) {
                assert.ok(
                    ws.messages.some((m) => m.msgId === msgId),
                    msgId
                );
            }
            assert.deepEqual(contextPaths(ws), ['system/IntroAnimation']);
            // The startup context change does not itself become a back-stack entry.
            assert.deepEqual(backStack(), []);
        });

        it('the startup reply waits for the simulated boot time', (t) => {
            const timers = useMockTimers(t);
            coldStart.config.bootDelayMs = 8000;
            const ws = createMockWs();

            systemApp.scheduleStartupSettings(ws);
            timers.tick(7999);
            assert.deepEqual(ws.messages, []);

            timers.tick(1);
            assert.ok(msgIds(ws).includes('Region'));
            assert.deepEqual(contexts(ws), ['IntroAnimation']);
            systemApp.cancelColdStart(ws);
        });

        it('IntroAnimation plays, and the Disclaimer opens only when the boot video ends', (t) => {
            const timers = useMockTimers(t);
            const ws = createMockWs();
            systemApp.handleGetStartupSettings(ws);
            assert.deepEqual(contexts(ws), ['IntroAnimation']);
            assert.equal(dialogs.disclaimerActive, false);

            timers.tick(4999);
            assert.deepEqual(contexts(ws), ['IntroAnimation']);

            timers.tick(1);
            assert.deepEqual(contexts(ws), ['IntroAnimation', 'Disclaimer']);
            assert.equal(dialogs.disclaimerActive, true);
            assert.deepEqual(backStack(), []);
        });

        it('leaving for Home during the boot video cancels the pending Disclaimer', (t) => {
            const timers = useMockTimers(t);
            const ws = createMockWs();
            systemApp.handleGetStartupSettings(ws);

            systemApp.handleIntentHome(ws);
            timers.tick(10000);
            assert.deepEqual(contexts(ws), ['IntroAnimation', 'HomeScreen']);
        });
    });

    describe('Home and the Disclaimer', () => {
        it('Global.IntentHome resets the back stack and dismisses the Disclaimer', () => {
            dialogs.disclaimerActive = true;
            setBackStack(['system', 'Applications']);
            const ws = createMockWs();

            events['Global.IntentHome'](ws);

            assert.equal(dialogs.disclaimerActive, false);
            assert.deepEqual(contextPaths(ws), ['system/HomeScreen']);
            assert.deepEqual(backStack(), ['HomeScreen']);
        });

        it('agreeing to the Disclaimer without a pending warning just goes Home', () => {
            dialogs.disclaimerActive = true;
            const ws = createMockWs();
            systemApp.dismissDisclaimer(ws);
            assert.deepEqual(contextPaths(ws), ['system/HomeScreen']);
            assert.equal(dialogs.disclaimerActive, false);
            assert.deepEqual(backStack(), ['HomeScreen']);
        });

        it('the shared Yes answers the Disclaimer, and No answers nothing here', () => {
            assert.deepEqual(systemApp.dialogAnswers.yes, [
                ['disclaimerActive', systemApp.dismissDisclaimer]
            ]);
            assert.deepEqual(systemApp.dialogAnswers.no, []);
        });
    });

    describe('the temperature warning', () => {
        it('opens once, outside the back stack', () => {
            const ws = createMockWs();
            systemApp.requestSystemWarning(ws);
            assert.deepEqual(contextPaths(ws), ['system/SystemWarning']);
            assert.equal(systemApp.isSystemWarningOpen(ws), true);
            assert.deepEqual(backStack(), [], 'a transient dialog');

            systemApp.requestSystemWarning(ws);
            assert.deepEqual(contexts(ws), ['SystemWarning'], 'a second request is ignored');
        });

        for (const flag of ['introAnimationActive', 'disclaimerActive']) {
            it(`waits while ${flag}, and appears after Home once the Disclaimer is agreed to`, () => {
                const ws = createMockWs();
                dialogs[flag] = true;
                systemApp.requestSystemWarning(ws);
                assert.deepEqual(ws.messages, []);
                assert.equal(systemApp.isSystemWarningOpen(ws), false);

                dialogs.introAnimationActive = false;
                dialogs.disclaimerActive = true;
                systemApp.dismissDisclaimer(ws);
                assert.deepEqual(contexts(ws), ['HomeScreen', 'SystemWarning']);
                assert.equal(systemApp.isSystemWarningOpen(ws), true);
            });
        }

        it('OK goes Home, clears the back stack, and allows the next warning', () => {
            const ws = createMockWs();
            systemApp.requestSystemWarning(ws);
            setBackStack(['system', 'Applications']);
            systemApp.dismissSystemWarning(ws);

            assert.equal(systemApp.isSystemWarningOpen(ws), false);
            assert.equal(contexts(ws).at(-1), 'HomeScreen');
            assert.deepEqual(backStack(), ['HomeScreen']);

            systemApp.requestSystemWarning(ws);
            assert.equal(systemApp.isSystemWarningOpen(ws), true);
        });

        it('each GUI connection has its own warning', () => {
            const first = createMockWs();
            const second = createMockWs();
            systemApp.requestSystemWarning(first);
            assert.equal(systemApp.isSystemWarningOpen(second), false);
            systemApp.requestSystemWarning(second);
            assert.deepEqual(contexts(second), ['SystemWarning']);
            systemApp.dismissSystemWarning(first);
            assert.equal(systemApp.isSystemWarningOpen(second), true);
        });
    });

    describe('Applications', () => {
        // The Stitcher tile messages of sendApplicationsState.
        function stitcherMessages(ws) {
            return ws.messages.filter(
                (m) =>
                    (m.msgId === 'StatusMenu' &&
                        m.params.payload.statusMenu.appName === 'stitcher') ||
                    (m.msgId === 'StatusMenuVisible' && m.params.payload.appName === 'stitcher')
            );
        }

        it('the state reports every application tile', () => {
            const ws = createMockWs();
            systemApp.sendApplicationsState(ws);
            const appNames = ws.messages
                .filter((m) => m.msgId === 'StatusMenu')
                .map((m) => m.params.payload.statusMenu.appName);
            for (const name of ['ecoenergy', 'schedmaint', 'carplay']) {
                assert.ok(appNames.includes(name), name);
            }
        });

        it('SelectApplications refreshes the state and opens Applications', () => {
            const ws = createMockWs();
            events.SelectApplications(ws);
            assert.ok(msgIds(ws).includes('StatusMenu'));
            assert.deepEqual(contextPaths(ws), ['system/Applications']);
        });

        it('Stitcher is available, with no visibility message, for the configured vehicle', () => {
            const ws = createMockWs();
            systemApp.sendApplicationsState(ws);
            const msgs = stitcherMessages(ws);
            assert.equal(systemApp.isStitcherBlockedForThisVehicle(), false);
            assert.deepEqual(
                msgs.map((m) => m.msgId),
                ['StatusMenu']
            );
            assert.equal(msgs[0].params.payload.statusMenu.appStatus, 'Available');
        });

        it('Stitcher is hidden and unavailable only for destination CA with model J03W', () => {
            hardware.destinationCode = 'SETTINGS_Destination_CA';
            hardware.vehicleType = 'SETTINGS_VehicleModelType_J03W';
            const ws = createMockWs();
            systemApp.sendApplicationsState(ws);

            const msgs = stitcherMessages(ws);
            assert.equal(systemApp.isStitcherBlockedForThisVehicle(), true);
            const visible = msgs.find((m) => m.msgId === 'StatusMenuVisible');
            assert.equal(visible.params.payload.state, 'Invisible');
            const status = msgs.find((m) => m.msgId === 'StatusMenu');
            assert.equal(status.params.payload.statusMenu.appStatus, 'Unavailable');

            hardware.vehicleType = 'SETTINGS_VehicleModelType_J78A';
            assert.equal(systemApp.isStitcherBlockedForThisVehicle(), false, 'another model');
            hardware.vehicleType = 'SETTINGS_VehicleModelType_J03W';
            hardware.destinationCode = 'SETTINGS_Destination_EU';
            assert.equal(systemApp.isStitcherBlockedForThisVehicle(), false, 'another market');
        });

        it('the Applications screen events open their application', () => {
            for (const [eventId, expected] of [
                ['SelectEntertainment', 'system/Entertainment'],
                ['SelectCommunication', 'system/Communication'],
                ['SelectWarnGuide', 'warnguide/WarningList'],
                ['SelectSchedMaint', 'schedmaint/MaintenanceList'],
                ['SelectEcoEnergy', 'ecoenergy/ControlStatus']
            ]) {
                const ws = createMockWs();
                events[eventId](ws);
                assert.deepEqual(contextPaths(ws), [expected], eventId);
            }
        });

        it('SelectVehicleStatusMonitor refreshes the tile state first, then opens the monitor', () => {
            const ws = createMockWs();
            events.SelectVehicleStatusMonitor(ws);

            assert.deepEqual(contextPaths(ws), ['system/VehicleStatusMonitor']);
            const firstContext = ws.messages.findIndex((m) => m.msgType === 'ctxtChg');
            const lastStatus = ws.messages.map((m) => m.msgId).lastIndexOf('StatusMenu');
            assert.ok(lastStatus >= 0 && lastStatus < firstContext, 'the state comes first');
        });

        it('SelectNavigation sends nothing (navigation is a separate, unemulated app)', () => {
            const ws = createMockWs();
            events.SelectNavigation(ws);
            assert.deepEqual(ws.messages, []);
        });
    });

    describe('Connect in the No Device window', () => {
        it('closes the window and opens the Bluetooth list in its place', () => {
            setBackStack(['system', 'Entertainment'], ['system', 'NoDevice']);
            const ws = createMockWs();
            events.SelectConnect(ws);

            assert.deepEqual(contextPaths(ws), ['btpairing/BTConnectionManager']);
            // Back from Bluetooth returns to the Entertainment list, not to the closed window.
            assert.deepEqual(backStack(), ['Entertainment', 'BTConnectionManager']);
        });

        it('leaves the stack alone when No Device is not on top', () => {
            setBackStack(['system', 'Entertainment']);
            events.SelectConnect(createMockWs());
            assert.deepEqual(backStack(), ['Entertainment', 'BTConnectionManager']);
        });

        it('does not pop a NoDevice context of another application', () => {
            setBackStack(['stitcher', 'NoDevice']);
            events.SelectConnect(createMockWs());
            assert.deepEqual(backStack(), ['NoDevice', 'BTConnectionManager']);
        });

        it('works with an empty stack', () => {
            const ws = createMockWs();
            events.SelectConnect(ws);
            assert.deepEqual(contextPaths(ws), ['btpairing/BTConnectionManager']);
            assert.deepEqual(backStack(), ['BTConnectionManager']);
        });
    });

    describe('Settings', () => {
        it('SelectSettings opens the HUD tab when a HUD is installed', () => {
            vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = 1;
            hardware.vehicleType = 'SETTINGS_VehicleModelType_J03W';
            const ws = createMockWs();
            systemApp.handleSelectSettings(ws);
            assert.deepEqual(contextPaths(ws), ['vehsettings/HUDTab']);
        });

        it('SelectSettings opens the J78 HUD tab on that model', () => {
            vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = 1;
            hardware.vehicleType = 'SETTINGS_VehicleModelType_J78A';
            const ws = createMockWs();
            systemApp.handleSelectSettings(ws);
            assert.deepEqual(contextPaths(ws), ['vehsettings/HUDTabJ78']);
        });

        it('SelectSettings opens the Display tab when no HUD is installed', () => {
            vehicleEquipment.VEHICLE_EQUIPMENT.Hud_Installed = 0;
            const ws = createMockWs();
            systemApp.handleSelectSettings(ws);
            assert.deepEqual(contextPaths(ws), ['syssettings/DisplayTab']);
        });

        it('each Settings tab event opens its tab', () => {
            for (const [tab, expected] of [
                ['Display', 'syssettings/DisplayTab'],
                ['Safety', 'vehsettings/SafetyTab'],
                ['Sound', 'audiosettings/SoundTab'],
                ['Clock', 'syssettings/ClockTab'],
                ['Vehicle', 'vehsettings/VehicleSettingsTab'],
                ['Devices', 'syssettings/DevicesTab'],
                ['System', 'syssettings/SystemTab']
            ]) {
                const ws = createMockWs();
                events['Global.IntentSettingsTab'](ws, { payload: { settingsTab: tab } });
                assert.deepEqual(contextPaths(ws), [expected], tab);
            }
        });

        it('the HUD tab depends on the vehicle model', () => {
            for (const [vehicleType, expected] of [
                ['SETTINGS_VehicleModelType_J78A', 'vehsettings/HUDTabJ78'],
                ['SETTINGS_VehicleModelType_J03W', 'vehsettings/HUDTab']
            ]) {
                hardware.vehicleType = vehicleType;
                const ws = createMockWs();
                systemApp.handleIntentSettingsTab(ws, { payload: { settingsTab: 'HUD' } });
                assert.deepEqual(contextPaths(ws), [expected], vehicleType);
            }
        });

        it('a tab replaces the current entry of the back stack', () => {
            setBackStack(['syssettings', 'DisplayTab']);
            systemApp.handleIntentSettingsTab(createMockWs(), {
                payload: { settingsTab: 'Sound' }
            });
            assert.deepEqual(backStackPaths(), ['audiosettings/SoundTab']);
        });

        it('an unknown tab only drops the current entry, and an empty stack is fine', () => {
            setBackStack(['syssettings', 'DisplayTab']);
            let ws = createMockWs();
            systemApp.handleIntentSettingsTab(ws, { payload: { settingsTab: 'Nope' } });
            assert.deepEqual(ws.messages, []);
            assert.deepEqual(backStack(), []);

            ws = createMockWs();
            systemApp.handleIntentSettingsTab(ws, { payload: { settingsTab: 'Clock' } });
            assert.deepEqual(contextPaths(ws), ['syssettings/ClockTab']);
            assert.deepEqual(backStack(), ['ClockTab']);
        });
    });
});
