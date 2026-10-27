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

    function buildPanel() {
        var panel = el(
            'div',
            'position:fixed;top:0;left:' +
                PANEL_LEFT +
                'px;width:300px;padding:14px 16px;box-sizing:border-box;' +
                'font:14px/1.4 sans-serif;color:#222;background:#fff;' +
                'border-left:1px solid #ccc;min-height:480px;z-index:3000;'
        );
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
        ui.link = el('div', 'margin-top:14px;font-size:12px;color:#999;', 'Connecting…');
        panel.appendChild(ui.link);
        document.body.appendChild(panel);
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
