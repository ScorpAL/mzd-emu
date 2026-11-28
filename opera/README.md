# Opera 12.16 (Presto 2.12) Container for mzd-emu

Runs desktop **Opera 12.16** (`opera-12.16-1860.x86_64.linux.tar.xz`, Presto 2.12 engine)
inside a `1280x900` Xvfb display exposed via **noVNC** so you can view `mzd-emu`
(`800x480` native, unscaled) alongside Opera's UI and Dragonfly DevTools.

On startup, `entrypoint.sh` pre-seeds `operaprefs.ini` with the engine,
security, cache, and user-agent settings from `jci/opera/opera_home/opera.ini`
while keeping Opera's menu, address bar, and Dragonfly DevTools enabled, and
disabling desktop-only extras (Speed Dial, web search bar, Mail, Unite, Turbo,
and auto-update).

> **Note:** This is the Linux desktop build of Opera 12.16, not the CMU's
> embedded Opera build. Rendering and behavior are much closer to the CMU than
> Chrome, but it is still not an exact 1:1 CMU render.
>
> The `Dockerfile` downloads Opera 12.16 from Opera's public archive at build
> time rather than bundling it in the repository.

## Build

From `mzd-emu/`:

```bash
docker build -t mzd-emu-opera opera
```

## Run

Start `mzd-emu` on the host first (`npm start` in `mzd-emu/`, which serves
`http://localhost:8080/jci/gui/index.html` and WebSockets on ports `2700`,
`2800`, and `2766`).

### Linux (`--network host`)

Using `--network host` lets Opera inside the container reach `localhost:8080`
and the `mzd-emu` WebSocket ports directly, while noVNC listens on port `6080`.
From `mzd-emu/`, mount `jci/fonts/CHN` read-only so fontconfig loads the firmware
fonts from `/jci/fonts/CHN` (including Tipperary) as system fonts:

```bash
docker run --rm --network host \
  -v "$(pwd)/jci/fonts/CHN:/jci/fonts/CHN:ro" \
  --name mzd-emu-opera mzd-emu-opera
```

Then open noVNC in your browser (at native 1:1 resolution, without scaling):

- <http://localhost:6080/vnc.html?autoconnect=1>

### Bridge networking (macOS / Windows / isolated network)

If `--network host` is not available, map port `6080` and point `TARGET_URL` at
`host.docker.internal` (from `mzd-emu/`):

```bash
docker run --rm -p 6080:6080 \
  --add-host=host.docker.internal:host-gateway \
  -e TARGET_URL=http://host.docker.internal:8080/jci/gui/index.html \
  -v "$(pwd)/jci/fonts/CHN:/jci/fonts/CHN:ro" \
  --name mzd-emu-opera mzd-emu-opera
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `TARGET_URL` | `http://localhost:8080/jci/gui/index.html` | URL opened by Opera on startup |
| `SCREEN_WIDTH` | `1280` | Xvfb viewport width |
| `SCREEN_HEIGHT` | `900` | Xvfb viewport height |
| `SCREEN_DEPTH` | `24` | Xvfb color depth |
| `NOVNC_PORT` | `6080` | noVNC HTTP/WebSocket port |
| `VNC_PORT` | `5900` | x11vnc port |
| `OPERA_ARGS` | `-noargb -nohwaccel -nosession -noraise -nomail` | Extra flags passed to `/opt/opera/opera` |
