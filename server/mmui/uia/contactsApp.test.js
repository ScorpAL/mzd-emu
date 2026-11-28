const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const contactsApp = require('./contactsApp');
const { createMockWs, contextPaths, msgIds } = require('../../testing/mockWs');
const { useCleanState } = require('../../testing/state');

describe('contactsApp', () => {
    useCleanState();

    it('handleSelectContacts sends PhoneConnectionStatus, PBConnectStatus, and lands on Contacts', () => {
        const ws = createMockWs();
        contactsApp.handleSelectContacts(ws);

        assert.deepEqual(contextPaths(ws), ['contacts/Contacts']);
        assert.ok(msgIds(ws).includes('PhoneConnectionStatus'));
        assert.ok(msgIds(ws).includes('PBConnectStatus'));

        const statusMsg = ws.messages.find((m) => m.msgId === 'PhoneConnectionStatus');
        assert.equal(statusMsg.params.payload.phoneStatus.phoneConnStatus, 'CONNECTED');
    });

    it('handleSelectContactDetails lands on ContactDetails context', () => {
        const ws = createMockWs();
        contactsApp.handleSelectContactDetails(ws);
        assert.deepEqual(contextPaths(ws), ['contacts/ContactDetails']);
    });

    it('BrowseContactName event lands on ContactDetails context', () => {
        const ws = createMockWs();
        contactsApp.events.BrowseContactName(ws);
        assert.deepEqual(contextPaths(ws), ['contacts/ContactDetails']);
    });

    it('ImportContacts event opens EditContacts', () => {
        const ws = createMockWs();
        contactsApp.events.ImportContacts(ws);
        assert.deepEqual(contextPaths(ws), ['contacts/EditContacts']);
    });

    it('SelectPhoneNumber starts an active call for the selected contact', () => {
        const ws = createMockWs();
        contactsApp.events.BrowseContactName(ws, {
            payload: { contactDetails: { id: 1, contactName: 'Alice Johnson' } }
        });
        contactsApp.events.SelectPhoneNumber(ws, { payload: { phoneNumber: '555-0101' } });
        assert.deepEqual(contextPaths(ws).slice(-1), ['phone/ActiveCall']);
    });

    it('RemoveContact and SelectRemove delete the selected contact and return to Contacts', () => {
        const mockDbapi = require('../../services/mockDbapi');
        try {
            const ws = createMockWs();
            contactsApp.handleSelectContacts(ws);
            contactsApp.events.BrowseContactName(ws, {
                payload: { contactDetails: { id: 2, contactName: 'Bob Smith' } }
            });
            contactsApp.events.RemoveContact(ws);
            assert.deepEqual(contextPaths(ws).slice(-1), ['contacts/RemoveContactConfirmation']);

            contactsApp.events.SelectRemove(ws);
            assert.deepEqual(contextPaths(ws).slice(-1), ['contacts/Contacts']);
            assert.equal(
                mockDbapi.getContactsList().some((c) => c.contactId === 2),
                false
            );
        } finally {
            mockDbapi.resetContacts();
        }
    });
});
