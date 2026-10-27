const fs = require('fs');
const path = require('path');

const RESOURCES_DIR = path.join(__dirname, '..', '..', '..', 'jci', 'resources');
const IVF_HEADER_MIN = 32;
const IVF_FRAME_HEADER = 12;

// Playing time of a firmware splash video (Duck IVF, played on the head unit by
// /usr/bin/splashplayer). Returns the last frame's timestamp plus one frame duration,
// or null if the file is missing or is not a valid IVF.
function ivfDurationMs(fileName) {
    let data;
    try {
        data = fs.readFileSync(path.join(RESOURCES_DIR, fileName));
    } catch {
        return null;
    }
    if (data.length < IVF_HEADER_MIN || data.toString('latin1', 0, 4) !== 'DKIF') {
        return null;
    }
    const headerLength = data.readUInt16LE(6);
    const timebaseDen = data.readUInt32LE(16);
    const timebaseNum = data.readUInt32LE(20);
    if (!timebaseDen || !timebaseNum) {
        return null;
    }
    let offset = headerLength;
    let lastPts = null;
    let prevPts = null;
    while (offset + IVF_FRAME_HEADER <= data.length) {
        const frameSize = data.readUInt32LE(offset);
        prevPts = lastPts;
        lastPts = Number(data.readBigUInt64LE(offset + 4));
        offset += IVF_FRAME_HEADER + frameSize;
    }
    if (lastPts === null) {
        return null;
    }
    const frameTicks = prevPts === null ? 0 : lastPts - prevPts;
    return Math.round(((lastPts + frameTicks) * timebaseNum * 1000) / timebaseDen);
}

module.exports = { ivfDurationMs: ivfDurationMs };
