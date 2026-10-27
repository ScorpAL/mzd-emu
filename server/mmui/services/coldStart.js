const logger = require('../../logger');
const splashVideo = require('./splashVideo');

// Timing of the simulated cold start (see docs/NATIVE_MAP.md, "Cold start"). The system
// application decides what happens at each step; this service only keeps the clock, per GUI
// connection because several browser tabs may be open at once.
const config = {
    // Delay before answering the GUI's first request, standing in for the real unit's long
    // boot while the logo loops (LoopLogo.ivf, 2250 ms per pass; see browser/ui-wayland.js).
    // Keep it under 20 s, when the GUI falls back to defaults. 0 disables it.
    bootDelayMs: 4250
};

const timers = new WeakMap();

function cancel(ws) {
    const own = timers.get(ws);
    if (own) {
        clearTimeout(own.boot);
        clearTimeout(own.intro);
        timers.delete(ws);
    }
}

function setTimer(ws, key, delayMs, callback) {
    const own = timers.get(ws) || {};
    clearTimeout(own[key]);
    // Never keep the process alive just for a simulated boot step.
    own[key] = setTimeout(callback, delayMs).unref();
    timers.set(ws, own);
    if (typeof ws.once === 'function' && !own.closeHooked) {
        own.closeHooked = true;
        ws.once('close', () => cancel(ws));
    }
}

// The GUI's startup request arrives instantly here; run `onBooted` after the boot time.
function waitForBoot(ws, onBooted) {
    cancel(ws);
    const delayMs = config.bootDelayMs || 0;
    if (delayMs <= 0) {
        onBooted(ws);
        return;
    }
    logger.info('boot', 'GUI asked for startup settings, answering in %d ms', delayMs);
    setTimer(ws, 'boot', delayMs, () => onBooted(ws));
}

// The firmware leaves IntroAnimation when the tranlogo service exits at the end of the video;
// without the video file there is nothing to wait for.
function waitForIntroEnd(ws, onEnd) {
    const durationMs = splashVideo.ivfDurationMs('TranLogo.ivf') || 0;
    logger.info('boot', 'boot video plays for %d ms', durationMs);
    setTimer(ws, 'intro', durationMs, () => onEnd(ws));
}

module.exports = {
    config: config,
    waitForBoot: waitForBoot,
    waitForIntroEnd: waitForIntroEnd,
    cancel: cancel
};
