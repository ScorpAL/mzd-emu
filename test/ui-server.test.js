const test = require('node:test');
const assert = require('node:assert/strict');

const uiServer = require('../server/ui-server');

test('resolveSafePath keeps normalized paths inside the project root', () => {
    assert.match(uiServer.resolveSafePath('/../../etc/passwd'), /^\/home\/dev\/mzd\//);
});

test('resolveSafePath rejects malformed encoded paths', () => {
    assert.throws(() => uiServer.resolveSafePath('/%E0%A4%A'), URIError);
});

test('getContentType returns a safe fallback for unknown extensions', () => {
    assert.equal(uiServer.getContentType('/file.bin'), 'application/octet-stream');
});
