// Turns on node:test's mock timers for one test and returns them (tick(), runAll()). They are
// restored when the test ends.
//
// MockTimers is still "Stability: 1 - Experimental" in Node 22 (the supported LTS), so enabling it
// prints an ExperimentalWarning in every test process that uses it. That warning says nothing
// about this project, so only that one warning is dropped here; every other warning, experimental
// or not, still gets through (unlike --disable-warning=ExperimentalWarning, which would hide all).
function useMockTimers(t, apis = ['setTimeout']) {
    const emitWarning = process.emitWarning;
    process.emitWarning = function (warning, ...rest) {
        if (String(warning).startsWith('The MockTimers API is an experimental feature')) {
            return;
        }
        return emitWarning.call(process, warning, ...rest);
    };
    try {
        t.mock.timers.enable({ apis });
    } finally {
        process.emitWarning = emitWarning;
    }
    return t.mock.timers;
}

module.exports = { useMockTimers };
