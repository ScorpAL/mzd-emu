const logger = require('./logger');

function isOpenDisabled(env = process.env) {
    return env.MZD_OPEN_BROWSER !== '1' || String(env.BROWSER).toLowerCase() === 'none';
}

async function openBrowser(url, env = process.env, openFn = require('open').default) {
    if (isOpenDisabled(env)) {
        return false;
    }
    try {
        await openFn(url);
        return true;
    } catch (error) {
        logger.warn('browser', 'Could not open the browser: %s', error.message);
        return false;
    }
}

module.exports = { isOpenDisabled, openBrowser };
