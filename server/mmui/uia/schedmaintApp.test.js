const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const schedmaintApp = require('./schedmaintApp');
const settings = require('../services/settings');
const { createMockWs, contexts, msgIds, payloadOf } = require('../../testing/mockWs');
const { useCleanState, setBackStack, backStack } = require('../../testing/state');

const { events } = schedmaintApp;
const current = settings.currentSettings;

// The three detail screens: how to open each, and which settings it shows.
const DETAILS = [
    {
        detail: 'ScheduledMaintenanceDetail',
        select: events.SelectScheduledMaintenance,
        setting: 'schedMaintSetting',
        distance: 'schedMaintDistance',
        distanceMsg: ['SchedMaintDistRemaining', 'schedmaintdistance']
    },
    {
        detail: 'TireRotationDetail',
        select: events.SelectTireRotation,
        setting: 'tireRotationSetting',
        distance: 'tireRotationDistance',
        distanceMsg: ['TireRotationDistRemaining', 'tirerotationdistance']
    },
    {
        detail: 'OilChangeDetail',
        select: events.SelectOilChange,
        setting: 'oilMaintSetting',
        distance: 'oilMaintDistance',
        distanceMsg: ['OilMaintenanceDistanceChange', 'distance']
    }
];

// Opens a detail screen from an empty stack, as the GUI does.
function openDetail(select) {
    setBackStack();
    select(createMockWs());
}

describe('schedmaintApp', () => {
    const fixture = useCleanState();

    describe('screens', () => {
        it('every select event sends the maintenance state and opens its screen', () => {
            const cases = [
                [schedmaintApp.handleSelectSchedMaint, 'MaintenanceList'],
                ...DETAILS.map(({ select, detail }) => [select, detail])
            ];
            for (const [handler, expected] of cases) {
                const ws = createMockWs();
                handler(ws);
                assert.deepEqual(contexts(ws), [expected]);
                for (const msgId of [
                    'MaintenanceListData',
                    'SettingMessage',
                    'SchedMaintDue',
                    'OilLife'
                ]) {
                    assert.ok(msgIds(ws).includes(msgId), `${expected}: ${msgId}`);
                }
            }
        });

        it('the maintenance state reports the current settings', () => {
            current.schedMaintDistance = 12345;
            current.tireRotationSetting = 'Off';
            const ws = createMockWs();
            schedmaintApp.sendMaintenanceState(ws);

            const list = payloadOf(ws, 'MaintenanceListData').MaintenanceList;
            assert.equal(list.SchedMaintsetDistDefault, 12345);
            const remaining = payloadOf(ws, 'SchedMaintDistRemaining').schedmaintdistance;
            assert.equal(remaining.Distance, 12345);
            assert.equal(payloadOf(ws, 'SettingMessage').settingmessage.TRSetting, 'Off');
        });
    });

    describe('Reset', () => {
        it('asks for confirmation on the detail screens only', () => {
            let ws = createMockWs();
            schedmaintApp.handleSelectReset(ws);
            assert.deepEqual(ws.messages, [], 'nothing is open yet');

            schedmaintApp.handleSelectSchedMaint(createMockWs());
            ws = createMockWs();
            schedmaintApp.handleSelectReset(ws);
            assert.deepEqual(ws.messages, [], 'the list is not a detail screen');
            assert.equal(schedmaintApp.dialogs.schedMaintResetConfirmActive, false);

            for (const { select, detail } of DETAILS) {
                openDetail(select);
                ws = createMockWs();
                schedmaintApp.handleSelectReset(ws);
                assert.deepEqual(contexts(ws), ['ConfirmReset']);
                assert.equal(schedmaintApp.dialogs.schedMaintResetContext, detail);
            }
        });

        describe('Yes restores the defaults of the screen it was asked on, and goes back to it', () => {
            beforeEach(() => {
                Object.assign(current, {
                    schedMaintSetting: 'Off',
                    schedMaintTime: 30,
                    schedMaintDistance: 1,
                    tireRotationSetting: 'Off',
                    tireRotationDistance: 2,
                    oilMaintSetting: 'Off',
                    oilMaintDistance: 3
                });
            });

            function resetYes(select) {
                openDetail(select);
                schedmaintApp.handleSelectReset(createMockWs());
                const ws = createMockWs();
                schedmaintApp.handleResetYes(ws);
                return ws;
            }

            it('Scheduled Maintenance', () => {
                const ws = resetYes(events.SelectScheduledMaintenance);
                assert.equal(current.schedMaintSetting, 'On');
                assert.equal(current.schedMaintTime, 360);
                assert.equal(current.schedMaintDistance, 20000);
                // The other two maintenance items are left alone.
                assert.equal(current.tireRotationDistance, 2);
                assert.equal(current.oilMaintDistance, 3);
                assert.equal(fixture.saves, 1);
                assert.equal(schedmaintApp.dialogs.schedMaintResetConfirmActive, false);
                assert.deepEqual(contexts(ws), ['ScheduledMaintenanceDetail']);
                assert.deepEqual(backStack(), ['ScheduledMaintenanceDetail']);
            });

            it('Tire Rotation', () => {
                resetYes(events.SelectTireRotation);
                assert.equal(current.tireRotationSetting, 'On');
                assert.equal(current.tireRotationDistance, 10000);
                assert.equal(current.oilMaintDistance, 3);
                assert.equal(current.schedMaintDistance, 1);
            });

            it('Oil Change', () => {
                resetYes(events.SelectOilChange);
                assert.equal(current.oilMaintSetting, 'On');
                assert.equal(current.oilMaintDistance, 10000);
                assert.equal(current.tireRotationDistance, 2);
            });
        });

        it('No changes nothing and goes back to the detail screen', () => {
            current.oilMaintDistance = 777;
            openDetail(events.SelectOilChange);
            schedmaintApp.handleSelectReset(createMockWs());
            const ws = createMockWs();
            schedmaintApp.handleResetNo(ws);

            assert.equal(current.oilMaintDistance, 777);
            assert.equal(fixture.saves, 0);
            assert.equal(schedmaintApp.dialogs.schedMaintResetConfirmActive, false);
            assert.equal(schedmaintApp.dialogs.schedMaintResetContext, null);
            assert.deepEqual(backStack(), ['OilChangeDetail']);
            assert.deepEqual(contexts(ws), ['OilChangeDetail']);
        });
    });

    describe('On / Off', () => {
        const OFF_REQUESTS = [
            ['SetSchedMaintOnOff', { schedMaint: 'Off' }, DETAILS[0]],
            ['SetTireRotationOnOff', { tireRotation: 'Off' }, DETAILS[1]],
            ['SetOilChange', { oilChange: 'Off' }, DETAILS[2]],
            ['SelectSettingInterval', { settingValue: 'Off' }, DETAILS[2]]
        ];
        for (const [eventId, payload, { select, setting, detail }] of OFF_REQUESTS) {
            for (const answer of ['Yes', 'No']) {
                it(`${eventId} Off asks first; ${answer} ${answer === 'Yes' ? 'turns it Off' : 'keeps it On'}`, () => {
                    current[setting] = 'On';
                    openDetail(select);

                    let ws = createMockWs();
                    events[eventId](ws, { payload });
                    assert.deepEqual(contexts(ws), ['ConfirmOff']);
                    assert.equal(current[setting], 'On', 'not changed before the answer');
                    assert.equal(schedmaintApp.dialogs.schedMaintOffContext, detail);

                    ws = createMockWs();
                    if (answer === 'Yes') {
                        schedmaintApp.handleOffYes(ws);
                        assert.equal(current[setting], 'Off');
                        assert.equal(fixture.saves, 1);
                    } else {
                        schedmaintApp.handleOffNo(ws);
                        assert.equal(current[setting], 'On');
                        assert.equal(fixture.saves, 0);
                    }
                    assert.equal(schedmaintApp.dialogs.schedMaintOffConfirmActive, false);
                    assert.deepEqual(backStack(), [detail]);
                    assert.deepEqual(contexts(ws), [detail]);
                });
            }
        }

        it('switching an item On saves it at once and refreshes the state', () => {
            current.schedMaintSetting = 'Off';
            let ws = createMockWs();
            events.SetSchedMaintOnOff(ws, { payload: { schedMaint: 'On' } });
            assert.equal(current.schedMaintSetting, 'On');
            assert.ok(msgIds(ws).includes('SchedMaintSetting'));

            current.tireRotationSetting = 'Off';
            ws = createMockWs();
            events.SetTireRotationOnOff(ws, { payload: { tireRotation: 'On' } });
            assert.equal(current.tireRotationSetting, 'On');
            assert.equal(fixture.saves, 2);
        });

        it('SetOilChange applies Fixed, Flexible and On at once', () => {
            for (const value of ['Fixed', 'Flexible', 'On']) {
                const ws = createMockWs();
                events.SetOilChange(ws, { payload: { oilChange: value } });
                assert.equal(current.oilMaintSetting, value);
                assert.ok(msgIds(ws).includes('OilMaintSetting'));
            }
            assert.equal(fixture.saves, 3);
        });

        it('other values are ignored without an answer', () => {
            for (const [eventId, params] of [
                ['SetSchedMaintOnOff', { payload: { schedMaint: 'Maybe' } }],
                ['SetTireRotationOnOff', {}],
                ['SetOilChange', { payload: { oilChange: 42 } }],
                ['SetOilChange', undefined]
            ]) {
                const ws = createMockWs();
                events[eventId](ws, params);
                assert.deepEqual(ws.messages, [], eventId);
            }
            assert.equal(fixture.saves, 0);
        });
    });

    describe('SelectSettingInterval', () => {
        it('opens the interval screen when no value is chosen', () => {
            const ws = createMockWs();
            events.SelectSettingInterval(ws, {});
            assert.deepEqual(contexts(ws), ['SettingInterval']);
        });

        it('takes only On and Off as a chosen value; Fixed and Flexible arrive as SetOilChange', () => {
            current.oilMaintSetting = 'Fixed';
            let ws = createMockWs();
            events.SelectSettingInterval(ws, { payload: { settingValue: 'Flexible' } });
            assert.deepEqual(contexts(ws), ['SettingInterval']);
            assert.equal(current.oilMaintSetting, 'Fixed');
            assert.equal(fixture.saves, 0);

            ws = createMockWs();
            events.SelectSettingInterval(ws, { payload: { settingValue: 'On' } });
            assert.deepEqual(contexts(ws), []);
            assert.equal(current.oilMaintSetting, 'On');
            assert.equal(fixture.saves, 1);
        });
    });

    describe('SetTimeValue', () => {
        it('stores days as given below 30 and months as 30-day blocks from 30 up', () => {
            for (const [sent, stored] of [
                [12, 12],
                [29, 29],
                [30, 900],
                ['12', 12]
            ]) {
                const ws = createMockWs();
                events.SetTimeValue(ws, { payload: { TimeValue: sent } });
                assert.equal(current.schedMaintTime, stored, String(sent));
                assert.ok(msgIds(ws).includes('SchedMaintTimeRemaining'));
            }
        });

        it('ignores a missing, zero, negative or non-numeric value but still answers', () => {
            current.schedMaintTime = 360;
            const bad = [0, -5, 'abc', NaN].map((v) => ({ payload: { TimeValue: v } }));
            for (const params of [undefined, {}, { payload: {} }, ...bad]) {
                const ws = createMockWs();
                events.SetTimeValue(ws, params);
                assert.equal(current.schedMaintTime, 360);
                assert.ok(
                    msgIds(ws).includes('MaintenanceListData'),
                    'the GUI gets its state back'
                );
            }
            assert.equal(fixture.saves, 0);
        });
    });

    describe('SetDistanceValue', () => {
        for (const { detail, distance, distanceMsg } of DETAILS) {
            it(`on ${detail} writes ${distance} and echoes only that distance`, () => {
                const [msgId, field] = distanceMsg;
                setBackStack(['schedmaint', detail]);
                const ws = createMockWs();
                events.SetDistanceValue(ws, { payload: { DistanceValue: 4321 } });
                assert.equal(current[distance], 4321);
                assert.equal(fixture.saves, 1);
                assert.deepEqual(msgIds(ws), [msgId]);
                assert.deepEqual(ws.messages[0].params.payload[field], {
                    Distance: 4321,
                    Unit: 'KM'
                });
            });
        }

        it('prefers the context named in the event over the top of the stack', () => {
            setBackStack(['schedmaint', 'OilChangeDetail']);
            const ws = createMockWs();
            events.SetDistanceValue(ws, {
                currentContextId: 'TireRotationDetail',
                payload: { DistanceValue: 555 }
            });
            assert.equal(current.tireRotationDistance, 555);
            assert.deepEqual(msgIds(ws), ['TireRotationDistRemaining']);
        });

        it('ignores bad values', () => {
            setBackStack(['schedmaint', 'OilChangeDetail']);
            const before = current.oilMaintDistance;
            const bad = [-1, 'abc', NaN].map((v) => ({ payload: { DistanceValue: v } }));
            for (const params of [undefined, {}, { payload: {} }, ...bad]) {
                const ws = createMockWs();
                events.SetDistanceValue(ws, params);
                assert.deepEqual(ws.messages, []);
            }
            assert.equal(current.oilMaintDistance, before);
            assert.equal(fixture.saves, 0);
        });

        it('ignores an empty stack and a screen that is not a detail screen', () => {
            let ws = createMockWs();
            events.SetDistanceValue(ws, { payload: { DistanceValue: 100 } });
            assert.deepEqual(ws.messages, [], 'empty stack');

            setBackStack(['schedmaint', 'MaintenanceList']);
            ws = createMockWs();
            events.SetDistanceValue(ws, { payload: { DistanceValue: 100 } });
            assert.deepEqual(ws.messages, [], 'not a detail screen');
            assert.equal(fixture.saves, 0);
        });
    });

    describe('dialogs', () => {
        it('going back from a confirmation of this application closes its dialog', () => {
            schedmaintApp.dialogs.schedMaintResetConfirmActive = true;
            schedmaintApp.dialogs.schedMaintResetContext = 'OilChangeDetail';
            schedmaintApp.closeDialogsOf({ uiaId: 'schedmaint', ctxtId: 'ConfirmReset' });
            assert.equal(schedmaintApp.dialogs.schedMaintResetConfirmActive, false);
            assert.equal(schedmaintApp.dialogs.schedMaintResetContext, null);

            schedmaintApp.dialogs.schedMaintOffConfirmActive = true;
            schedmaintApp.dialogs.schedMaintOffContext = 'OilChangeDetail';
            schedmaintApp.closeDialogsOf({ uiaId: 'system', ctxtId: 'ConfirmOff' });
            assert.equal(schedmaintApp.dialogs.schedMaintOffConfirmActive, true, 'another app');
            schedmaintApp.closeDialogsOf({ uiaId: 'schedmaint', ctxtId: 'ConfirmOff' });
            assert.equal(schedmaintApp.dialogs.schedMaintOffConfirmActive, false);
            assert.equal(schedmaintApp.dialogs.schedMaintOffContext, null);
        });

        it('the shared Yes / No reach the handler of the open dialog', () => {
            const table = (answer) => Object.fromEntries(schedmaintApp.dialogAnswers[answer]);
            assert.equal(table('yes').schedMaintResetConfirmActive, schedmaintApp.handleResetYes);
            assert.equal(table('yes').schedMaintOffConfirmActive, schedmaintApp.handleOffYes);
            assert.equal(table('no').schedMaintResetConfirmActive, schedmaintApp.handleResetNo);
            assert.equal(table('no').schedMaintOffConfirmActive, schedmaintApp.handleOffNo);
        });
    });
});
