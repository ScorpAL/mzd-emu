const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { DIALOG_OWNERS } = require('./commonApp');

// Every application module of this directory, by file name.
const APPS = fs
    .readdirSync(__dirname)
    .filter((file) => file.endsWith('App.js'))
    .map((file) => [path.basename(file, '.js'), require(`./${file}`)]);
const OWNERS = APPS.filter(([, app]) => app.dialogs);

describe('dialogs of the applications', () => {
    it('every application with dialogs is known to the shared Yes / No', () => {
        assert.ok(OWNERS.length >= 6);
        for (const [name, app] of OWNERS) {
            assert.ok(DIALOG_OWNERS.includes(app), `${name} is missing from DIALOG_OWNERS`);
            assert.ok(app.dialogAnswers, `${name} has dialogs but no dialogAnswers`);
        }
        assert.equal(DIALOG_OWNERS.length, OWNERS.length);
    });

    it('every application starts with its dialogs closed', () => {
        for (const [name, app] of OWNERS) {
            for (const [flag, value] of Object.entries(app.dialogs)) {
                assert.ok(value === false || value === null, `${name}.${flag} = ${value}`);
            }
        }
    });

    it('each dialog answer refers to a flag and a handler of its own application', () => {
        for (const [name, app] of OWNERS) {
            for (const answer of ['yes', 'no']) {
                for (const [flag, handler] of app.dialogAnswers[answer]) {
                    assert.ok(flag in app.dialogs, `${name}: unknown flag ${flag}`);
                    assert.equal(typeof handler, 'function', `${name}: ${flag} has no handler`);
                }
            }
        }
    });

    it('a dialog flag belongs to exactly one application', () => {
        const owners = new Map();
        for (const [name, app] of OWNERS) {
            for (const flag of Object.keys(app.dialogs)) {
                assert.equal(owners.has(flag), false, `${flag}: ${owners.get(flag)} and ${name}`);
                owners.set(flag, name);
            }
        }
    });
});
