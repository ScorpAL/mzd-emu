const logger = require('../logger');
const settings = require('../mmui/services/settings');

const SEEDED_CONTACTS = [
    {
        contactId: 1,
        displayName: 'Alice Johnson',
        orderId: 1,
        numbers: [{ category: 'Mobile', number: '555-0101' }]
    },
    {
        contactId: 2,
        displayName: 'Bob Smith',
        orderId: 2,
        numbers: [{ category: 'Mobile', number: '555-0123' }]
    },
    {
        contactId: 3,
        displayName: 'Carol Williams',
        orderId: 3,
        numbers: [{ category: 'Mobile', number: '555-0145' }]
    },
    {
        contactId: 4,
        displayName: 'David Brown',
        orderId: 4,
        numbers: [{ category: 'Work', number: '555-0167' }]
    },
    {
        contactId: 5,
        displayName: 'Emily Davis',
        orderId: 5,
        numbers: [{ category: 'Mobile', number: '555-0189' }]
    },
    {
        contactId: 6,
        displayName: 'Frank Miller',
        orderId: 6,
        numbers: [{ category: 'Work', number: '555-0199' }]
    }
];

const SEEDED_INDEX_LIST = [
    { label: 'A', index: 0 },
    { label: 'B', index: 1 },
    { label: 'C', index: 2 },
    { label: 'D', index: 3 },
    { label: 'E', index: 4 },
    { label: 'F', index: 5 }
];

const SEEDED_CALL_HISTORY = [
    {
        id: 1,
        callId: 1,
        displayName: 'Bob Smith',
        number: '555-0123',
        timestamp: 1732438800,
        timeStamp: '10:30',
        category: 'Dialled'
    },
    {
        id: 2,
        callId: 2,
        displayName: 'David Brown',
        number: '555-0167',
        timestamp: 1732352400,
        timeStamp: 'Yesterday',
        category: 'Received'
    },
    {
        id: 3,
        callId: 3,
        displayName: 'Alice Johnson',
        number: '555-0101',
        timestamp: 1732266000,
        timeStamp: 'Nov 20',
        category: 'Missed'
    },
    {
        id: 4,
        callId: 4,
        displayName: 'Express Delivery',
        number: '555-0190',
        timestamp: 1732179600,
        timeStamp: 'Nov 18',
        category: 'Dialled'
    }
];

const FM_STATIONS = [
    { stationName: 'Jazz 24/7', frequency: 88.5, genre: 'Jazz', piCode: 1001 },
    { stationName: 'Rock Classics', frequency: 95.3, genre: 'Rock', piCode: 1002 },
    { stationName: 'Top 40 Hits', frequency: 100.5, genre: 'Pop', piCode: 1003 },
    { stationName: 'Public Radio', frequency: 103.0, genre: 'News', piCode: 1004 },
    { stationName: 'Urban Beats', frequency: 106.9, genre: 'Hip Hop', piCode: 1005 }
];

const AVATAR_PALETTES = [
    { bg: '#2b5876', shirt: '#4e89ae', skin: '#f5cfa0', hair: '#4a2c2a' },
    { bg: '#3b6978', shirt: '#84a9ac', skin: '#e8b48a', hair: '#2c2c2c' },
    { bg: '#5e3a6e', shirt: '#9b6b9e', skin: '#f7d7b5', hair: '#8d5524' },
    { bg: '#2f5d62', shirt: '#5e8b7e', skin: '#c68642', hair: '#1f1f1f' },
    { bg: '#6b3e26', shirt: '#c97b63', skin: '#f1c27d', hair: '#3b2417' }
];

let activeContacts = SEEDED_CONTACTS.map((c) => ({ ...c }));

function getContactsList() {
    return activeContacts;
}

function removeContact(contactId) {
    const before = activeContacts.length;
    activeContacts = activeContacts.filter((c) => c.contactId !== contactId);
    return activeContacts.length !== before;
}

function resetContacts() {
    activeContacts = SEEDED_CONTACTS.map((c) => ({ ...c }));
}

function buildIndexList(contacts) {
    const seen = new Set();
    const list = [];
    contacts.forEach((c, index) => {
        const letter = (c.displayName || '').charAt(0).toUpperCase();
        if (letter && !seen.has(letter)) {
            seen.add(letter);
            list.push({ label: letter, index });
        }
    });
    return list;
}

function generateContactAvatar(contactId, size) {
    if (contactId === 6 || settings.HARDWARE_CONFIG.contactAvatars !== 'On') {
        return '';
    }
    const palette = AVATAR_PALETTES[(Math.max(1, contactId) - 1) % AVATAR_PALETTES.length];
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">` +
        `<rect width="100" height="100" fill="${palette.bg}"/>` +
        `<circle cx="50" cy="96" r="34" fill="${palette.shirt}"/>` +
        `<circle cx="50" cy="44" r="24" fill="${palette.skin}"/>` +
        `<path d="M26 42 C26 20, 74 20, 74 42 C70 30, 30 30, 26 42 Z" fill="${palette.hair}"/>` +
        `<circle cx="42" cy="45" r="2.8" fill="#222"/>` +
        `<circle cx="58" cy="45" r="2.8" fill="#222"/>` +
        `<path d="M42 56 Q50 62 58 56" fill="none" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>` +
        `</svg>`;
    return 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64');
}

function handleMessage(ws, data) {
    const content = data.msgContent || data;
    if (!content || typeof content !== 'object') {
        return;
    }

    const { api, methodName, reqId, params } = content;
    let responseParams = { eCode: 0 };

    if (api === 'pb') {
        if (
            methodName === 'OpenCallHistoryDb' ||
            methodName === 'CloseCallHistoryDb' ||
            methodName === 'OpenContactsDb' ||
            methodName === 'CloseContactsDb' ||
            methodName === 'FreeContactObjectsByIds'
        ) {
            responseParams = { eCode: 0 };
        } else if (methodName === 'GetContactsIndex') {
            const indexList =
                settings.HARDWARE_CONFIG.contactsData === 'On'
                    ? buildIndexList(activeContacts)
                    : [];
            responseParams = {
                eCode: 0,
                count: indexList.length,
                indexList: indexList
            };
        } else if (methodName === 'GetContacts') {
            const contacts =
                settings.HARDWARE_CONFIG.contactsData === 'On'
                    ? activeContacts.map((c) => ({
                          ...c,
                          ctoPath: generateContactAvatar(c.contactId, 53)
                      }))
                    : [];
            responseParams = {
                eCode: 0,
                totalCount: contacts.length,
                count: contacts.length,
                offset: 0,
                contacts: contacts
            };
        } else if (methodName === 'GetContactDetails') {
            const contactId = params && params.contactId;
            const contact =
                activeContacts.find((c) => c.contactId === contactId) ||
                activeContacts[0] ||
                SEEDED_CONTACTS[0];
            responseParams = {
                eCode: 0,
                contactId: contact.contactId,
                displayName: contact.displayName,
                orderId: contact.orderId,
                numbers: contact.numbers,
                ctoPath: generateContactAvatar(contact.contactId, 116)
            };
        } else if (methodName === 'GetCallHistory') {
            const category = params && params.category;
            let list = settings.HARDWARE_CONFIG.callHistoryData === 'On' ? SEEDED_CALL_HISTORY : [];
            if (category === 'Missed') {
                list = list.filter((c) => c.category === 'Missed');
            } else if (category === 'Dialled') {
                list = list.filter((c) => c.category === 'Dialled');
            }
            responseParams = {
                eCode: 0,
                totalCount: list.length,
                count: list.length,
                offset: 0,
                callHistories: list,
                callHistory: list
            };
        } else if (methodName === 'GetContactByMatchedNumber') {
            const number = params && params.number;
            const match =
                settings.HARDWARE_CONFIG.contactsData === 'On'
                    ? activeContacts.find((c) => c.numbers.some((n) => n.number === number))
                    : null;
            const matchedContact = {
                contactId: match ? match.contactId : 0,
                displayName: match ? match.displayName : number || 'John Doe',
                numbers: match
                    ? match.numbers
                    : [{ category: 'Mobile', number: number || '555-0142' }],
                ctoPath: match ? generateContactAvatar(match.contactId, 116) : ''
            };
            responseParams = {
                eCode: 0,
                contacts: [matchedContact],
                displayName: matchedContact.displayName,
                numbers: matchedContact.numbers,
                ctoPath: matchedContact.ctoPath
            };
        }
    } else if (api === 'radio') {
        const fmEnabled = settings.HARDWARE_CONFIG.fmRadioData === 'On';
        if (methodName === 'FmNowPlayingMetadata') {
            responseParams = fmEnabled
                ? {
                      eCode: 0,
                      artist: 'The Echoes',
                      title: 'Starlight Dream',
                      album: 'Neon Horizon',
                      genre: 'Rock'
                  }
                : { eCode: 0, artist: '', title: '', album: '', genre: '' };
        } else if (methodName === 'FmStationList') {
            const list = fmEnabled ? FM_STATIONS : [];
            responseParams = {
                eCode: 0,
                totalCount: list.length,
                count: list.length,
                offset: 0,
                stationList: list
            };
        } else if (methodName === 'FmAutoMemoryList') {
            const list = fmEnabled ? FM_STATIONS : [];
            responseParams = {
                eCode: 0,
                totalCount: list.length,
                count: list.length,
                offset: 0,
                autoMemoryList: list
            };
        }
    }

    const response = {
        msgType: 'methodResponse',
        msgContent: {
            api: api,
            methodName: methodName,
            reqId: reqId,
            params: responseParams
        }
    };

    try {
        ws.send(JSON.stringify(response));
        logger.debug('dbapi', 'Sent methodResponse for %s.%s (reqId=%s)', api, methodName, reqId);
    } catch (err) {
        logger.error('dbapi', 'Failed to send methodResponse: %s', err.message);
    }
}

module.exports = {
    handleMessage,
    getContactsList,
    removeContact,
    resetContacts,
    generateContactAvatar,
    SEEDED_CONTACTS,
    SEEDED_INDEX_LIST,
    SEEDED_CALL_HISTORY
};
