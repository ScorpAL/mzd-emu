const navigationState = require('./navigationState');
const logger = require('../logger');

function withSeqByte(jsonStr, seq) {
    return jsonStr + String.fromCharCode(seq % 128);
}

const transitionFalse = JSON.stringify({ msgType: 'transition', enabled: false });
const transitionTrue = JSON.stringify({ msgType: 'transition', enabled: true });

let globalcontextSeq = 0;
const currAppId = 1;

const sendContextChange = function (ws, uiaId, ctxtId, params, contextSeq, skipGoBackPush) {
    if (typeof contextSeq == 'undefined') {
        contextSeq = globalcontextSeq;
        globalcontextSeq += 1;
    }
    const ctxtChgMsg = JSON.stringify({
        msgType: 'ctxtChg',
        ctxtId: ctxtId,
        uiaId: uiaId,
        params: params,
        contextSeq: contextSeq
    });
    const focusStackMsg = JSON.stringify({
        msgType: 'focusStack',
        appIdList: [{ id: uiaId }, { id: currAppId }]
    });
    const seqByte = contextSeq;
    ws.send(withSeqByte(transitionTrue, seqByte));
    logger.debug('guiifm', 'Sent transition enabled=true');
    ws.send(withSeqByte(ctxtChgMsg, seqByte));
    logger.debug('guiifm', 'Sent context change uiaId=%s context=%s', uiaId, ctxtId);
    ws.send(withSeqByte(focusStackMsg, seqByte));
    logger.debug('guiifm', 'Sent focus stack');
    ws.send(withSeqByte(transitionFalse, seqByte));
    logger.debug('guiifm', 'Sent transition enabled=false');

    if (
        !skipGoBackPush &&
        (uiaId === 'system' ||
            uiaId === 'vdt' ||
            uiaId === 'ecoenergy' ||
            uiaId === 'warnguide' ||
            uiaId === 'schedmaint' ||
            uiaId === 'syssettings' ||
            uiaId === 'vehsettings' ||
            uiaId === 'audiosettings' ||
            uiaId === 'sysupdate' ||
            uiaId === 'btpairing' ||
            uiaId === 'netmgmt')
    ) {
        navigationState.goBackStack.push({
            uiaId: uiaId,
            ctxtId: ctxtId,
            params: params,
            contextSeq: contextSeq
        });
    }
};

module.exports = {
    withSeqByte: withSeqByte,
    sendContextChange: sendContextChange,
    transitionTrue: transitionTrue,
    transitionFalse: transitionFalse
};
