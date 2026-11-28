// Emulator-only controls shown next to the 800x480 head unit screen.
//
// Nothing here exists on the car and nothing is injected into the firmware GUI from jci/:
// the panel talks to the emulator server over its own WebSocket (controlPort), and the server
// then behaves like the car's services would (see mmui/temperatureService.js).
(function () {
    'use strict';

    // The head unit screen is a fixed 800x480 block in the corner (ui-wayland.js), so the
    // panel takes the free space on its right.
    var PANEL_LEFT = 830;
    var SEND_THROTTLE_MS = 80;
    var RECONNECT_MS = 2000;

    var socket = null;
    var state = null;
    var sendTimer = null;
    var ui = {};

    function el(tag, css, text) {
        var node = document.createElement(tag);
        if (css) {
            node.style.cssText = css;
        }
        if (text) {
            node.textContent = text;
        }
        return node;
    }

    // Whether to show what lies outside the 800x480 screen (the head unit cuts it off).
    var OUTSIDE_CLASS = 'emulator-show-outside';
    var OUTSIDE_KEY = 'emulator.showOutside';

    function buildOutsideSwitch() {
        var row = el('label', 'display:block;margin-top:14px;font-size:13px;cursor:default;');
        var box = el('input', 'margin:0 6px 0 0;vertical-align:middle;');
        box.type = 'checkbox';
        box.checked = localStorage.getItem(OUTSIDE_KEY) === '1';
        function apply() {
            document.documentElement.classList.toggle(OUTSIDE_CLASS, box.checked);
            localStorage.setItem(OUTSIDE_KEY, box.checked ? '1' : '0');
        }
        box.addEventListener('change', apply);
        apply();
        row.appendChild(box);
        row.appendChild(document.createTextNode('Show what lies outside the screen'));
        row.appendChild(
            el(
                'div',
                'color:#777;font-size:11px;margin:2px 0 0 20px;',
                'Dimmed; the head unit cuts it off.'
            )
        );
        return row;
    }

    function jumpToScreen(screenId) {
        var fw = window.framework;
        if (!fw || !fw.sendEventToMmui) {
            return;
        }
        switch (screenId) {
            case 'home':
            case 'system/HomeScreen':
                fw.sendEventToMmui('system', 'Global.IntentHome');
                break;
            case 'entertainment':
            case 'system/Entertainment':
                fw.sendEventToMmui('system', 'SelectEntertainment');
                break;
            case 'communication':
            case 'system/Communication':
                fw.sendEventToMmui('system', 'SelectCommunication');
                break;
            case 'fmradio':
            case 'radio':
            case 'fmradio/NowPlaying':
                fw.sendEventToMmui('system', 'SelectRadioFM');
                break;
            case 'tune':
            case 'fmradio/Tune':
                fw.sendEventToMmui('fmradio', 'SelectTune');
                break;
            case 'stationlist':
            case 'fmradio/StationList':
                fw.sendEventToMmui('fmradio', 'SelectStationList');
                break;
            case 'dialpad':
            case 'phone':
            case 'phone/DialPad':
                fw.sendEventToMmui('system', 'SelectPhone');
                break;
            case 'recentcalls':
            case 'callhistory':
            case 'phone/RecentCalls':
                fw.sendEventToMmui('system', 'SelectCallHistory');
                break;
            case 'call':
            case 'activecall':
            case 'phone/ActiveCall':
                fw.sendEventToMmui('phone', 'CallDialpadNumber', {
                    payload: { number: '555-0142' }
                });
                break;
            case 'phone/HangUpCall':
                fw.sendEventToMmui('phone', 'HangUpCall');
                break;
            case 'dtmf':
            case 'phone/ActiveCallDTMF':
                fw.sendEventToMmui('phone', 'SelectDtmfShow');
                break;
            case 'contacts':
            case 'contacts/Contacts':
                fw.sendEventToMmui('system', 'SelectContacts');
                break;
            case 'sms':
            case 'smsinbox':
            case 'sms/SMSInbox':
                fw.sendEventToMmui('system', 'SelectSms');
                break;
            case 'smsdetail':
            case 'sms/SMSMessageDetail':
                fw.sendEventToMmui('sms', 'SelectConversation');
                break;
            case 'keyboard':
            case 'netmgmt/KeyboardInput':
                fw.sendEventToMmui('netmgmt', 'SelectKeyboardInput');
                break;
            case 'compose':
            case 'syssettings/ComposeMessage':
                fw.sendEventToMmui('syssettings', 'SelectComposeMessage');
                break;
            case 'fmsettings':
            case 'fmradio/Settings':
                fw.sendEventToMmui('fmradio', 'SelectSettings');
                break;
            case 'commsettings':
            case 'syssettings/CommunicationSettings':
                fw.sendEventToMmui('syssettings', 'SelectCommunicationSettings');
                break;
            case 'presetmessages':
            case 'syssettings/PresetMessages':
                fw.sendEventToMmui('syssettings', 'SelectPresetMessages');
                break;
            case 'display':
            case 'syssettings/DisplayTab':
                fw.sendEventToMmui('system', 'Global.IntentSettingsTab', {
                    payload: { settingsTab: 'Display' }
                });
                break;
            case 'displayoff':
            case 'system/DisplayOff':
                fw.sendEventToMmui('syssettings', 'SelectDisplayOff');
                break;
            case 'displayclock':
            case 'system/DisplayClock':
                fw.sendEventToMmui('syssettings', 'SelectDisplayClock');
                break;
        }
    }

    function buildScreenNavigator() {
        var section = el('div', 'margin-top:16px;padding-top:14px;border-top:1px solid #eee;');
        section.appendChild(
            el('div', 'font-weight:bold;margin-bottom:6px;', 'Simulated Apps & Views')
        );

        var quickRow = el(
            'div',
            'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;'
        );
        var quickButtons = [
            { label: '⌨️ Full Keyboard', screen: 'netmgmt/KeyboardInput', bg: '#4a69bd' },
            { label: '📞 Phone Dialpad', screen: 'phone/DialPad', bg: '#0078d4' },
            { label: '📇 Contacts', screen: 'contacts/Contacts', bg: '#10ac84' },
            { label: '💬 Text Messages', screen: 'sms/SMSInbox', bg: '#e58e26' },
            { label: '📻 FM Radio', screen: 'fmradio/NowPlaying', bg: '#6c5ce7' },
            { label: '📋 Call History', screen: 'phone/RecentCalls', bg: '#0984e3' }
        ];

        var select = el('select', 'width:100%;padding:6px;font-size:13px;margin-bottom:8px;');

        quickButtons.forEach(function (qb) {
            var btn = el(
                'button',
                'padding:6px;font-size:11px;font-weight:bold;cursor:pointer;background:' +
                    qb.bg +
                    ';color:#fff;border:none;border-radius:3px;text-align:center;',
                qb.label
            );
            btn.addEventListener('click', function () {
                jumpToScreen(qb.screen);
                select.value = qb.screen;
            });
            quickRow.appendChild(btn);
        });
        section.appendChild(quickRow);

        var screens = [
            { id: 'netmgmt/KeyboardInput', label: 'Full Keyboard (Wi-Fi "spacja")' },
            { id: 'syssettings/ComposeMessage', label: 'Full Keyboard (Edit Message)' },
            { id: 'phone/DialPad', label: 'Phone Dialer (DialPad2)' },
            { id: 'phone/RecentCalls', label: 'Call History (RecentCalls)' },
            { id: 'phone/ActiveCall', label: 'Active Phone Call' },
            { id: 'phone/ActiveCallDTMF', label: 'In-Call DTMF Dialpad' },
            { id: 'contacts/Contacts', label: 'Contacts (Letter Index)' },
            { id: 'sms/SMSInbox', label: 'Text Messages (SMS Inbox)' },
            { id: 'sms/SMSMessageDetail', label: 'SMS Message Detail' },
            { id: 'fmradio/NowPlaying', label: 'FM Radio (Now Playing)' },
            { id: 'fmradio/Tune', label: 'FM Radio (Tuner Dial)' },
            { id: 'fmradio/StationList', label: 'FM Radio (Station List)' },
            { id: 'fmradio/Settings', label: 'FM Radio Settings' },
            { id: 'syssettings/CommunicationSettings', label: 'Communication Settings' },
            { id: 'syssettings/PresetMessages', label: 'Communication: Preset Messages' },
            { id: 'system/Communication', label: 'Communication Menu' },
            { id: 'system/Entertainment', label: 'Entertainment Menu' },
            { id: 'system/HomeScreen', label: 'Home Screen' },
            { id: 'syssettings/DisplayTab', label: 'Settings: Display Tab' },
            { id: 'system/DisplayOff', label: 'Display: Turn Display Off' },
            { id: 'system/DisplayClock', label: 'Display: Turn Off & Show Clock' }
        ];

        screens.forEach(function (s) {
            var opt = el('option', '', s.label);
            opt.value = s.id;
            select.appendChild(opt);
        });
        section.appendChild(select);

        var btnRow = el('div', 'display:flex;gap:6px;margin-bottom:8px;');
        var jumpBtn = el(
            'button',
            'flex:1;padding:6px 10px;font-size:12px;cursor:pointer;background:#0078d4;color:#fff;border:none;border-radius:3px;',
            'Open View'
        );
        jumpBtn.addEventListener('click', function () {
            jumpToScreen(select.value);
        });
        btnRow.appendChild(jumpBtn);

        var callBtn = el(
            'button',
            'flex:1;padding:6px 10px;font-size:12px;cursor:pointer;background:#28a745;color:#fff;border:none;border-radius:3px;',
            'Toggle Call'
        );
        var callActive = false;
        callBtn.addEventListener('click', function () {
            callActive = !callActive;
            if (callActive) {
                jumpToScreen('phone/ActiveCall');
                callBtn.textContent = 'End Call';
                callBtn.style.background = '#dc3545';
            } else {
                jumpToScreen('phone/HangUpCall');
                callBtn.textContent = 'Toggle Call';
                callBtn.style.background = '#28a745';
            }
        });
        btnRow.appendChild(callBtn);
        section.appendChild(btnRow);

        var hint = el(
            'div',
            'color:#777;font-size:11px;',
            'Or pass URL param ?screen=dialpad, fmradio, contacts, sms, call, keyboard'
        );
        section.appendChild(hint);

        return section;
    }

    function checkUrlScreenParam() {
        var params = new URLSearchParams(window.location.search);
        var screen = params.get('screen');
        if (!screen) {
            return;
        }
        var attempts = 0;
        var timer = setInterval(function () {
            attempts++;
            var fw = window.framework;
            if (fw && fw.sendEventToMmui && fw._currentContext) {
                clearInterval(timer);
                setTimeout(function () {
                    jumpToScreen(screen);
                }, 400);
            } else if (attempts > 60) {
                clearInterval(timer);
            }
        }, 100);
    }

    function buildPanel() {
        var panel = el(
            'div',
            'position:fixed;top:0;left:' +
                PANEL_LEFT +
                'px;width:300px;padding:14px 16px;box-sizing:border-box;' +
                'font:14px/1.4 sans-serif;color:#222;background:#fff;' +
                'border-left:1px solid #ccc;min-height:480px;z-index:2147483647;'
        );
        // ui-polyfills.html keeps the normal arrow cursor on this id.
        panel.id = 'emulator-controls';
        panel.appendChild(el('div', 'font-weight:bold;font-size:16px;', 'Emulator controls'));
        panel.appendChild(
            el('div', 'color:#777;font-size:12px;margin-bottom:14px;', 'Not part of the head unit')
        );

        panel.appendChild(el('div', '', 'Display temperature'));
        ui.value = el('div', 'font-size:28px;font-weight:bold;margin:4px 0;', '-- °C');
        panel.appendChild(ui.value);

        ui.slider = el('input', 'width:100%;margin:0;');
        ui.slider.type = 'range';
        ui.slider.step = '1';
        ui.slider.addEventListener('input', onSlide);
        panel.appendChild(ui.slider);

        // Threshold marks under the slider.
        ui.marks = el('div', 'position:relative;height:30px;font-size:11px;color:#777;');
        panel.appendChild(ui.marks);

        ui.status = el('div', 'margin-top:8px;font-weight:bold;', '');
        panel.appendChild(ui.status);
        ui.note = el('div', 'margin-top:6px;color:#666;font-size:12px;', '');
        panel.appendChild(ui.note);
        panel.appendChild(buildOutsideSwitch());
        panel.appendChild(buildScreenNavigator());
        ui.link = el('div', 'margin-top:14px;font-size:12px;color:#999;', 'Connecting…');
        panel.appendChild(ui.link);
        // Outside the body: the body clips everything to the 800x480 screen.
        document.documentElement.appendChild(panel);
    }

    function addMark(percent, label, color) {
        var mark = el(
            'div',
            'position:absolute;top:0;left:' +
                percent +
                '%;transform:translateX(-50%);' +
                'text-align:center;color:' +
                color +
                ';white-space:nowrap;'
        );
        mark.appendChild(el('div', 'height:6px;width:1px;background:' + color + ';margin:0 auto;'));
        mark.appendChild(el('div', '', label));
        ui.marks.appendChild(mark);
    }

    function render() {
        if (!state) {
            return;
        }
        var span = state.maxC - state.minC;
        ui.slider.min = state.minC;
        ui.slider.max = state.maxC;
        if (document.activeElement !== ui.slider) {
            ui.slider.value = state.temperatureC;
        }
        ui.value.textContent = state.temperatureC + ' °C';
        if (!ui.marks.firstChild) {
            addMark(0, state.minC, '#777');
            addMark(((state.clearAtC - state.minC) / span) * 100, state.clearAtC, '#c80');
            addMark(((state.warnAtC - state.minC) / span) * 100, state.warnAtC, '#c00');
            addMark(100, state.maxC, '#777');
        }
        ui.status.textContent = state.over ? 'Over-temperature: ON' : 'Over-temperature: off';
        ui.status.style.color = state.over ? '#c00' : '#2a7';
        ui.note.textContent =
            'Warning from ' +
            state.warnAtC +
            ' °C, ends below ' +
            state.clearAtC +
            ' °C. The unit checks the sensor every ' +
            state.pollIntervalMs / 1000 +
            ' s.';
    }

    function onSlide() {
        var value = Number(ui.slider.value);
        ui.value.textContent = value + ' °C';
        if (sendTimer) {
            return;
        }
        sendTimer = setTimeout(function () {
            sendTimer = null;
            if (socket && socket.readyState === 1) {
                socket.send(
                    JSON.stringify({ type: 'setTemperature', value: Number(ui.slider.value) })
                );
            }
        }, SEND_THROTTLE_MS);
    }

    function connect(port) {
        socket = new WebSocket('ws://' + location.hostname + ':' + port);
        socket.onopen = function () {
            ui.link.textContent = 'Connected to the emulator';
        };
        socket.onmessage = function (event) {
            var message = JSON.parse(event.data);
            if (message.type === 'temperature') {
                state = message.state;
                render();
            }
        };
        socket.onclose = function () {
            ui.link.textContent = 'Emulator not connected, retrying…';
            setTimeout(function () {
                connect(port);
            }, RECONNECT_MS);
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        buildPanel();
        checkUrlScreenParam();
        // The port is the server's setting, read from the same file the servers use.
        fetch('/emulator/runtime.json')
            .then(function (r) {
                return r.json();
            })
            .then(function (runtime) {
                connect(runtime.controlPort);
            });
    });
})();
