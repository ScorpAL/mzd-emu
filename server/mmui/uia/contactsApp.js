const protocol = require('../protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('../state/navigationState');
const mockDbapi = require('../../services/mockDbapi');
const logger = require('../../logger');

let selectedContactId = null;
let selectedContactName = '';

function findContactNameByNumber(phoneNumber) {
    if (!phoneNumber) return '';
    const match = mockDbapi
        .getContactsList()
        .find((c) => c.numbers.some((n) => n.number === phoneNumber));
    return match ? match.displayName : '';
}

function sendContactsMsg(ws, msgId, payload) {
    const msg = JSON.stringify({
        msgType: 'msg',
        uiaId: 'contacts',
        msgId: msgId,
        params: { payload: payload }
    });
    ws.send(msg);
    logger.debug('contacts', 'Sent message msgId=%s', msgId);
}

function sendPhoneConnectionStatus(ws) {
    sendContactsMsg(ws, 'PhoneConnectionStatus', {
        phoneStatus: {
            phoneConnStatus: 'CONNECTED',
            deviceId: 1
        }
    });
    sendContactsMsg(ws, 'PBConnectStatus', {
        status: true
    });
}

function handleSelectContacts(ws) {
    sendPhoneConnectionStatus(ws);
    sendContextChange(ws, 'contacts', 'Contacts');
}

function handleSelectContactDetails(ws, params) {
    const details = params && params.payload && params.payload.contactDetails;
    if (details) {
        selectedContactId = details.id !== undefined ? details.id : selectedContactId;
        selectedContactName = details.contactName || selectedContactName;
    }
    sendContextChange(ws, 'contacts', 'ContactDetails');
}

function handleSelectEditContacts(ws) {
    sendContextChange(ws, 'contacts', 'EditContacts');
}

function handleSelectPhoneNumber(ws, params) {
    const phoneNumber =
        params && params.payload && params.payload.phoneNumber ? params.payload.phoneNumber : '';
    const name = selectedContactName || findContactNameByNumber(phoneNumber) || phoneNumber;
    const phoneApp = require('./phoneApp');
    phoneApp.triggerSimulatedCall(ws, name, phoneNumber);
}

function handleRemoveContact(ws) {
    sendContextChange(ws, 'contacts', 'RemoveContactConfirmation');
}

function handleSelectRemove(ws) {
    if (selectedContactId != null) {
        mockDbapi.removeContact(selectedContactId);
        selectedContactId = null;
        selectedContactName = '';
    }
    const stack = navigationState.goBackStack;
    if (
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'contacts' &&
        stack[stack.length - 1].ctxtId === 'RemoveContactConfirmation'
    ) {
        stack.pop();
    }
    if (
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'contacts' &&
        stack[stack.length - 1].ctxtId === 'ContactDetails'
    ) {
        stack.pop();
    }
    const alreadyContacts =
        stack.length > 0 &&
        stack[stack.length - 1].uiaId === 'contacts' &&
        stack[stack.length - 1].ctxtId === 'Contacts';
    sendContextChange(ws, 'contacts', 'Contacts', undefined, undefined, alreadyContacts);
}

const events = {
    BrowseContactName: (ws, params) => handleSelectContactDetails(ws, params),
    SelectContactDetails: (ws, params) => handleSelectContactDetails(ws, params),
    ImportContacts: (ws) => handleSelectEditContacts(ws),
    SelectPhoneNumber: (ws, params) => handleSelectPhoneNumber(ws, params),
    RemoveContact: (ws) => handleRemoveContact(ws),
    SelectRemove: (ws) => handleSelectRemove(ws)
};

module.exports = {
    events,
    handleSelectContacts,
    handleSelectContactDetails,
    handleSelectEditContacts,
    handleSelectPhoneNumber,
    handleRemoveContact,
    handleSelectRemove,
    sendPhoneConnectionStatus,
    sendContactsMsg
};
