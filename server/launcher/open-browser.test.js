const test = require('node:test');
const assert = require('node:assert');
const logger = require('../logger');
const { openBrowser } = require('./open-browser');

const URL_ = 'http://localhost:8080/jci/gui/index.html';

test('openBrowser opens the url when enabled', async () => {
    const opened = [];
    const result = await openBrowser(URL_, { MZD_OPEN_BROWSER: '1' }, async (url) =>
        opened.push(url)
    );
    assert.strictEqual(result, true);
    assert.deepStrictEqual(opened, [URL_]);
});

test('openBrowser does nothing unless enabled or when BROWSER=none', async () => {
    const opener = async () => assert.fail('must not open');
    assert.strictEqual(await openBrowser(URL_, {}, opener), false);
    assert.strictEqual(await openBrowser(URL_, { MZD_OPEN_BROWSER: '0' }, opener), false);
    assert.strictEqual(
        await openBrowser(URL_, { MZD_OPEN_BROWSER: '1', BROWSER: 'none' }, opener),
        false
    );
});

test('openBrowser swallows opener errors and logs a warning', async () => {
    const lines = [];
    logger.configure({ level: 'warn', out: (line) => lines.push(line) });
    try {
        const result = await openBrowser(URL_, { MZD_OPEN_BROWSER: '1' }, async () => {
            throw new Error('no display');
        });
        assert.strictEqual(result, false);
        assert.match(lines.join(''), /Could not open the browser: no display/);
    } finally {
        logger.configure({ level: 'warn', out: () => {} });
    }
});
