const test = require('node:test');
const assert = require('node:assert/strict');

const systemApp = require('./systemApp');
const sysupdateApp = require('./sysupdateApp');
const syssettingsApp = require('./syssettingsApp');
const vehsettingsApp = require('./vehsettingsApp');
const schedmaintApp = require('./schedmaintApp');

const OWNERS = { systemApp, sysupdateApp, syssettingsApp, vehsettingsApp, schedmaintApp };

test('every application starts with its dialogs closed', () => {
    Object.values(OWNERS).forEach((app) => {
        Object.values(app.dialogs).forEach((value) => {
            assert.ok(value === false || value === null);
        });
    });
});

test('each dialog answer refers to a flag and a handler of its own application', () => {
    Object.entries(OWNERS).forEach(([name, app]) => {
        ['yes', 'no'].forEach((answer) => {
            app.dialogAnswers[answer].forEach(([flag, handler]) => {
                assert.ok(flag in app.dialogs, `${name}: unknown flag ${flag}`);
                assert.equal(typeof handler, 'function', `${name}: ${flag} has no handler`);
            });
        });
    });
});

test('a dialog flag belongs to exactly one application', () => {
    const owners = new Map();
    Object.entries(OWNERS).forEach(([name, app]) => {
        Object.keys(app.dialogs).forEach((flag) => {
            assert.equal(
                owners.has(flag),
                false,
                `${flag} is owned by ${owners.get(flag)} and ${name}`
            );
            owners.set(flag, name);
        });
    });
});
