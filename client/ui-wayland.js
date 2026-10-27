// Browser stand-in for the head unit's native video layers.
//
// On the car the GUI (Opera) is only one Wayland surface. The boot/exit logos are separate
// surfaces played by /usr/bin/splashplayer from the IVF files in /jci/resources, and they sit
// above or below Opera. None of that exists in a browser, so this file recreates the part the
// GUI can observe: GuiFramework picks the visible surfaces through
// utility.setRequiredSurfaces(), which calls the WaylandManager plugin defined here.
//
// Cold-start sequence being reproduced (see jci/sm/sm.conf, svcjcinativeguictrl and
// libjciuiasystem.so):
//   1. Power on: the Mazda logo loops (LoopLogo.ivf) while the system boots. It is started by
//      the base OS, not by the GUI, so it is visible without any surface request.
//   2. The GUI asks for startup settings, MMUI starts the "tranlogo" service
//      (TranLogo.ivf, ~5 s). When its surface registers, nativeguictrl kills the loop logo and
//      one second later starts TranLogoEnd.ivf underneath it.
//   3. TranLogo ends on a picture of the Home screen; TranLogoEnd holds the same picture until
//      the system app sends DisposeIntroVideo (it kills the TranLogoEnd process). That is what
//      gives the seamless hand-over from video to GUI.
(function () {
    'use strict';

    var WIDTH = 800;
    var HEIGHT = 480;
    var RES = '/jci/resources/';
    var OPERA_SURFACE = 'JCI_OPERA_PRIMARY';

    // z mirrors the "-z" argument of splashplayer (sm.conf / nativeguictrl). The loop logo's
    // z is not visible in the dump; it only has to stay below TranLogo.
    var SURFACES = {
        LOOPLOGO_SURFACE: { file: 'LoopLogo.ivf', z: 500, loop: true },
        TRANLOGO_SURFACE: { file: 'TranLogo.ivf', z: 700 },
        TRANLOGOEND_SURFACE: { file: 'TranLogoEnd.ivf', z: 600 }
    };
    // nativeguictrl starts TranLogoEnd this long after TRANLOGO_SURFACE registers.
    var TRANLOGOEND_DELAY_MS = 1000;
    // Frame period of the 24 fps clips, used to detect the end of playback.
    var FRAME_MS = 1000 / 24;

    var supported = typeof VideoDecoder === 'function' && typeof EncodedVideoChunk === 'function';
    var players = {};

    // IVF is a bare frame container, which <video> cannot open, but the payload is plain VP8,
    // so the frames are decoded with WebCodecs instead of transcoding the firmware files.
    function parseIvf(buffer) {
        var view = new DataView(buffer);
        var offset = view.getUint16(6, true);
        var ticksPerSecond = view.getUint32(16, true) / (view.getUint32(20, true) || 1);
        var frames = [];
        while (offset + 12 <= buffer.byteLength) {
            var size = view.getUint32(offset, true);
            var pts = Number(view.getBigUint64(offset + 4, true));
            var data = new Uint8Array(buffer, offset + 12, size);
            frames.push({
                data: data,
                key: (data[0] & 1) === 0, // VP8 key-frame bit
                timeMs: (pts * 1000) / ticksPerSecond
            });
            offset += 12 + size;
        }
        return frames;
    }

    function createPlayer(name, def) {
        var canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        canvas.dataset.surface = name;
        // Fixed 800x480 overlay in the corner, like the head unit's display; it must never
        // swallow clicks meant for the GUI underneath.
        canvas.style.cssText =
            'position:fixed;left:0;top:0;width:' +
            WIDTH +
            'px;height:' +
            HEIGHT +
            'px;pointer-events:none;display:none;z-index:' +
            (2000 + def.z) +
            ';';
        document.body.appendChild(canvas);
        var player = {
            name: name,
            def: def,
            canvas: canvas,
            ctx: canvas.getContext('2d'),
            frames: [],
            bitmaps: [],
            ready: null, // promise: all frames decoded
            startedAt: null, // performance.now() of playback start, null = not started
            required: false, // listed in the GUI's setRequiredSurfaces()
            killed: false, // process "killed" (loop logo replaced, DisposeIntroVideo)
            ended: false, // played to the end and exited (splashplayer -q)
            drawn: false // at least one frame is on the canvas
        };
        players[name] = player;
        return player;
    }

    // Clips are short (<= 120 frames of 800x480), so they are decoded once, up front, and
    // played back from memory; this avoids stalls that would desynchronise the server timer.
    function decodeAll(player) {
        return fetch(RES + player.def.file)
            .then(function (r) {
                return r.arrayBuffer();
            })
            .then(function (buf) {
                player.frames = parseIvf(buf);
                var pending = [];
                var decoder = new VideoDecoder({
                    output: function (frame) {
                        var index = Math.round(frame.timestamp / 1000);
                        pending.push(
                            createImageBitmap(frame).then(function (bmp) {
                                player.bitmaps[index] = bmp;
                                frame.close();
                            })
                        );
                    },
                    error: function (err) {
                        console.warn('[ui-wayland] ' + player.def.file + ': ' + err);
                    }
                });
                decoder.configure({ codec: 'vp8', codedWidth: WIDTH, codedHeight: HEIGHT });
                player.frames.forEach(function (f, i) {
                    decoder.decode(
                        new EncodedVideoChunk({
                            type: f.key ? 'key' : 'delta',
                            timestamp: i * 1000, // index, read back in output()
                            data: f.data
                        })
                    );
                });
                return decoder.flush().then(function () {
                    return Promise.all(pending);
                });
            });
    }

    function render(player) {
        // The loop logo is not controlled by the GUI: it shows until the player is killed.
        // The other layers appear only while the GUI lists them as required surfaces.
        var wanted = player.def.loop ? true : player.required;
        var visible = wanted && !player.killed && !player.ended && player.drawn;
        player.canvas.style.display = visible ? 'block' : 'none';
    }

    function tick(player) {
        if (player.killed || player.ended) {
            return;
        }
        var frames = player.frames;
        var duration = frames[frames.length - 1].timeMs + FRAME_MS;
        var elapsed = performance.now() - player.startedAt;
        if (player.def.loop) {
            elapsed = elapsed % duration;
        } else if (elapsed >= duration && player.name === 'TRANLOGO_SURFACE') {
            // splashplayer -q: the process exits after the last frame and its surface vanishes.
            // TranLogoEnd is different: it stays on its last frame until it is killed.
            player.ended = true;
            render(player);
            return;
        }
        var index = 0;
        while (index + 1 < frames.length && frames[index + 1].timeMs <= elapsed) {
            index++;
        }
        var bmp = player.bitmaps[index];
        if (bmp) {
            player.ctx.drawImage(bmp, 0, 0);
            player.drawn = true;
        }
        render(player);
        requestAnimationFrame(function () {
            tick(player);
        });
    }

    function play(player) {
        if (player.startedAt !== null || player.killed) {
            return;
        }
        player.ready.then(function () {
            if (player.killed || player.startedAt !== null) {
                return;
            }
            player.startedAt = performance.now();
            tick(player);
        });
    }

    function kill(name) {
        var player = players[name];
        if (player) {
            player.killed = true;
            render(player);
        }
    }

    // First time the GUI asks for TRANLOGO_SURFACE is the moment the tranlogo service is up
    // (the GUI is on IntroAnimation). This is the same trigger nativeguictrl uses
    // (tranlogo_registered_cb): kill the loop logo, then start TranLogoEnd a second later.
    function onTranLogoRegistered() {
        var tran = players.TRANLOGO_SURFACE;
        if (tran.startedAt !== null || tran.killed) {
            return;
        }
        kill('LOOPLOGO_SURFACE');
        play(tran);
        setTimeout(function () {
            play(players.TRANLOGOEND_SURFACE);
        }, TRANLOGOEND_DELAY_MS);
    }

    // GuiFramework.setRequiredSurfaces(): surfaces not listed are hidden.
    function setRequired(list) {
        var wanted = String(list).split(',');
        Object.keys(players).forEach(function (name) {
            players[name].required = wanted.indexOf(name) !== -1;
        });
        if (wanted.indexOf('TRANLOGO_SURFACE') !== -1) {
            onTranLogoRegistered();
        }
        Object.keys(players).forEach(function (name) {
            render(players[name]);
        });
    }

    // The system app ends the intro by running "kill -TERM $(cat /var/run/tranlogoend.pid)"
    // natively after sending DisposeIntroVideo. The event goes to MMUI over the websocket, so
    // watch it on its way out of the GUI.
    function hookDisposeIntroVideo() {
        var fw = window.framework;
        if (!fw || !fw.sendEventToMmui) {
            return false;
        }
        var original = fw.sendEventToMmui;
        fw.sendEventToMmui = function (uiaId, eventId) {
            if (uiaId === 'system' && eventId === 'DisposeIntroVideo') {
                kill('TRANLOGOEND_SURFACE');
            }
            return original.apply(this, arguments);
        };
        return true;
    }

    // Plugin interface the GUI expects (jci/opera/.../waylandmanager.so).
    function WaylandManager() {}
    WaylandManager.prototype.SetRequiredSurfaces = function (list) {
        setRequired(list);
    };
    WaylandManager.prototype.HideAllSurfaces = function () {
        setRequired(OPERA_SURFACE);
    };
    WaylandManager.prototype.HideSurface = function () {};
    WaylandManager.prototype.ShowSurface = function () {};
    WaylandManager.prototype.MoveSurface = function () {};
    WaylandManager.prototype.SetKeyboardFocus = function () {};

    if (!supported) {
        console.warn('[ui-wayland] WebCodecs VP8 unavailable; boot animation is not shown.');
        return;
    }

    // Utility.js creates its WaylandManager lazily from window.WaylandManager, so this must
    // be defined before the inline script at the end of <body> runs.
    window.WaylandManager = WaylandManager;

    document.addEventListener('DOMContentLoaded', function () {
        Object.keys(SURFACES).forEach(function (name) {
            var player = createPlayer(name, SURFACES[name]);
            player.ready = decodeAll(player);
            player.ready.catch(function (err) {
                console.warn('[ui-wayland] could not load ' + player.def.file + ': ' + err);
            });
        });
        // Power-on state: the Mazda logo loops until the tranlogo service takes over.
        play(players.LOOPLOGO_SURFACE);
        hookDisposeIntroVideo();
    });
})();
