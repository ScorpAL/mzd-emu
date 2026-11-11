const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { isOpenDisabled, openBrowser } = require('./open-browser');
const { captureLogs } = require('../testing/logs');

const URL_ = 'http://localhost:8080/jci/gui/index.html';
const ENABLED = { MZD_OPEN_BROWSER: '1' };

describe('open-browser', () => {
    describe('isOpenDisabled', () => {
        it('opens only when the launcher asks for it and BROWSER is not none', () => {
            assert.equal(isOpenDisabled(ENABLED), false);
            assert.equal(isOpenDisabled({}), true);
            assert.equal(isOpenDisabled({ MZD_OPEN_BROWSER: '0' }), true);
            assert.equal(isOpenDisabled({ ...ENABLED, BROWSER: 'none' }), true);
            assert.equal(isOpenDisabled({ ...ENABLED, BROWSER: 'NONE' }), true);
            assert.equal(isOpenDisabled({ ...ENABLED, BROWSER: 'firefox' }), false);
        });
    });

    describe('openBrowser', () => {
        it('opens the url when enabled', async () => {
            const opened = [];
            assert.equal(await openBrowser(URL_, ENABLED, async (url) => opened.push(url)), true);
            assert.deepEqual(opened, [URL_]);
        });

        it('does nothing when disabled', async () => {
            const opener = async () => assert.fail('must not open');
            assert.equal(await openBrowser(URL_, {}, opener), false);
            assert.equal(await openBrowser(URL_, { ...ENABLED, BROWSER: 'none' }, opener), false);
        });

        it('swallows opener errors and logs a warning', async (t) => {
            const logs = captureLogs(t, 'warn');
            const result = await openBrowser(URL_, ENABLED, async () => {
                throw new Error('no display');
            });
            assert.equal(result, false);
            const warning = logs.find({ level: 'warn', scope: 'browser' });
            assert.equal(warning.message, 'Could not open the browser: no display');
        });
    });
});
