const { stripVTControlCharacters } = require('node:util');

const logger = require('../logger');

// True when a log record matches `filter`: { level, scope, message }, each optional; `message`
// is a RegExp or a substring.
function matches(record, filter) {
    const { level, scope, message } = filter;
    if ((level && record.level !== level) || (scope && record.scope !== scope)) {
        return false;
    }
    if (message === undefined) {
        return true;
    }
    return message instanceof RegExp
        ? message.test(record.message)
        : record.message.includes(message);
}

// Collects what the logger writes for the rest of test `t` (at `level`, default debug) and puts
// the logger back afterwards.
//
// Tests look at `records` ({ level, scope, message }, as the logger passes them), never at the
// printed text: colours (FORCE_COLOR, which node --test sets for its children on a colour
// terminal) and the column layout must not change what a test sees. `lines` holds the printed
// text without colour codes, for the logger's own tests.
//
// `find(filter)` returns the first matching record; `waitFor(filter)` resolves with it, including
// records logged before the call, for things that happen asynchronously. `count(filter)` is how
// many times a matching line was logged, including the repeats the logger folded into a count
// (call logger.flush() first, so the last count is printed).
function captureLogs(t, level = 'debug') {
    const records = [];
    const lines = [];
    const waiters = [];
    const previous = logger.configure({
        level,
        out: (line, record) => {
            lines.push(stripVTControlCharacters(line));
            records.push(record);
            for (const waiter of waiters.filter((w) => matches(record, w.filter))) {
                waiters.splice(waiters.indexOf(waiter), 1);
                waiter.resolve(record);
            }
        }
    });
    t.after(() => logger.configure(previous));
    const find = (filter) => records.find((record) => matches(record, filter));
    const count = (filter) =>
        records
            .filter((record) => matches(record, filter))
            .reduce((total, record) => total + (record.repeats ?? 1), 0);
    return {
        records,
        lines,
        find,
        count,
        waitFor(filter) {
            const found = find(filter);
            if (found) {
                return Promise.resolve(found);
            }
            return new Promise((resolve) => waiters.push({ filter, resolve }));
        }
    };
}

module.exports = { captureLogs };
