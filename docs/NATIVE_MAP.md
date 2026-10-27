# Emulator files and their counterparts in the firmware

The emulator replaces the native part of the head unit and runs the real GUI from `jci/gui`
unchanged. This page maps each emulator file to the firmware component it stands in for, so
you can find the native behavior to compare against. Names refer to the 74.00.324 dump in
`jci/`. Nothing under `jci/` is ever modified by the emulator.

## How the firmware is put together

```
Opera (jci/opera)  ── runs jci/gui, the HTML/JS GUI
   │  WebSocket (ctxtChg, transition, focusStack, msg …)
svcjcimmui.so      ── MMUI service; loads one libjciuia<name>.so per application
   ├─ libjciuiacommon.so   routes the Global.* events to the applications
   ├─ libjciuiasystem.so   system application: Home, boot, Disclaimer, warnings
   └─ libjciuia<other>.so  syssettings, vehsettings, audiosettings, …
Services started by the service manager (jci/sm/sm.conf)
   ├─ svcjciblmsystem.so   system state machine, ignition, display, temperature
   ├─ svcjciblmsettings.so persistent user settings
   ├─ svcjcivbs.so         vehicle bus
   └─ nativeguictrl + splashplayer + waylandmanager.so   video layers and boot logos
```

Each `libjciuia*.so` contains a generated decision table: rows are events, columns are
contexts, and each cell holds the rules and the target context. This table is the
authoritative answer to "what happens when event X arrives in context Y".

## Emulator processes and ports

| Port (`server/config/runtime.json`) | Emulator                                              | Firmware counterpart                          |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------- |
| `uiPort` 8080                       | `ui-server.js` serves `jci/gui` and the browser shims | Opera loading `/jci/gui/index.html`           |
| `guiifmPort` 2700                   | `mmui-server.js` GUI socket                           | GUI interface of `svcjcimmui.so` (`GUIIFM_*`) |
| `appsdkPort` 2800                   | passive endpoint                                      | `svcjciappsdk.so`                             |
| `dbapiPort` 2766                    | passive endpoint                                      | `svcjcidbapi.so`                              |
| `controlPort` 2900                  | `mmui/controlPanel.js`                                | none, emulator only                           |

## File map

Files in `server/mmui` that stand in for an application keep the application's `uiaId`
(the name in `jci/mmui/mmui_config.xml`), so `uia/<name>App.js` is `libjciuia<name>.so`.

| Emulator file                                                    | Firmware counterpart                                                                                           | Notes                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mmui-server.js`                                                 | `svcjcimmui.so`                                                                                                | Starts the sockets; does not implement the apps itself                                                                                                                                                                           |
| `mmui/protocol.js`                                               | `GUIIFM_*` in the uia libraries                                                                                | Frames sent to the GUI: `transition`, `ctxtChg`, `focusStack`, `msg`                                                                                                                                                             |
| `mmui/dispatcher.js`                                             | `svcjcimmui.so` event routing                                                                                  | Looks the event up in the `events` table that every `mmui/*App.js` exports (the firmware has one decision table per library) and falls back to `SelectXyz` → context `Xyz`                                                       |
| `mmui/uia/commonApp.js`                                          | `libjciuiacommon.so` (uiaid 0, the shared `Global.*` events)                                                   | `Global.Yes/No/Cancel/GoBack`, `Timeout` and the events that two applications share (`SelectReset`, `SelectSettings`); each application declares its own dialogs (`dialogs`, `dialogAnswers`) and this module finds the open one |
| `mmui/uia/systemApp.js`                                          | `libjciuiasystem.so` (uiaid 1)                                                                                 | Also holds the cold-start sequence, which the firmware splits between this library and `svcjciblmsystem.so`                                                                                                                      |
| `mmui/uia/syssettingsApp.js`                                     | `libjciuiasyssettings.so` (21)                                                                                 |                                                                                                                                                                                                                                  |
| `mmui/uia/vehsettingsApp.js`                                     | `libjciuiavehsettings.so` (22)                                                                                 |                                                                                                                                                                                                                                  |
| `mmui/uia/audiosettingsApp.js`                                   | `libjciuiaaudiosettings.so` (17)                                                                               |                                                                                                                                                                                                                                  |
| `mmui/uia/btpairingApp.js`                                       | `libjciuiabtpairing.so` (5)                                                                                    |                                                                                                                                                                                                                                  |
| `mmui/uia/netmgmtApp.js`                                         | `libjciuianetmgmt.so` (6)                                                                                      |                                                                                                                                                                                                                                  |
| `mmui/uia/sysupdateApp.js`                                       | `libjciuiasysupdate.so` (14)                                                                                   |                                                                                                                                                                                                                                  |
| `mmui/uia/ecoenergyApp.js`                                       | `libjciuiaecoenergy.so` (33)                                                                                   |                                                                                                                                                                                                                                  |
| `mmui/uia/schedmaintApp.js`                                      | `libjciuiaschedmaint.so` (34)                                                                                  |                                                                                                                                                                                                                                  |
| `mmui/services/temperatureService.js`                            | `svcjciblmsystem.so` (`system_hsrm_CheckTemp`, 5 s timer) and the syssettings message `DisplayOverTemperature` | Thresholds are assumptions, see below                                                                                                                                                                                            |
| `mmui/services/settings.js`, `data/user-settings.json`           | `svcjciblmsettings.so`                                                                                         | Persisted user settings                                                                                                                                                                                                          |
| `mmui/services/startup.js`                                       | `UIA_SYSTEM_GetStartUpSettings` and the startup messages of `libjciuiasyssettings.so`                          | Region, units, language, clock                                                                                                                                                                                                   |
| `mmui/services/vehicleEquipment.js`, `config/vehicle.json`       | Vehicle configuration (`*_Installed` flags)                                                                    | The exact native source was not identified                                                                                                                                                                                       |
| `mmui/services/firmwareVersion.js`                               | `/jci/version.ini`                                                                                             |                                                                                                                                                                                                                                  |
| `mmui/services/splashVideo.js`                                   | Length of the boot video played by `splashplayer`                                                              | Reads the IVF file in `jci/resources`                                                                                                                                                                                            |
| `mmui/services/coldStart.js`                                     | the boot clock of `svcjcimmui.so` and `tranlogo`                                                               | Timing of the simulated cold start (boot wait, then the length of `TranLogo.ivf`); `uia/systemApp.js` decides what happens at each step                                                                                          |
| `mmui/state/navigationState.js`                                  | Go-back stack in `libjciuiasystem.so` (`PushGoBackStack`)                                                      |                                                                                                                                                                                                                                  |
| `mmui/controlPanel.js`, `browser/ui-controls.js`                 | none                                                                                                           | Emulator-only controls (temperature slider)                                                                                                                                                                                      |
| `browser/ui-wayland.js`                                          | `waylandmanager.so`, `nativeguictrl`, `splashplayer`                                                           | Boot and loop videos drawn in the browser                                                                                                                                                                                        |
| `browser/ui-polyfills.html`                                      | Opera 12 environment                                                                                           | Shims so the GUI runs in a current browser                                                                                                                                                                                       |
| `launcher/start-all.js`, `launcher/open-browser.js`, `logger.js` | the service manager (`sm`)                                                                                     | Launch and logging only                                                                                                                                                                                                          |

## Cold start

| Step | Firmware                                                                                                                       | Emulator                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1    | The base OS loops `LoopLogo.ivf` while the unit boots                                                                          | `browser/ui-wayland.js` loops it; `GetStartupSettings` is answered after `coldStart.bootDelayMs`            |
| 2    | `GetStartupSettings`: MMUI starts the `tranlogo` service (`TranLogo.ivf`, 5 s), context `IntroAnimation`                       | `systemApp.js` sends `IntroAnimation`; the browser plays `TranLogo.ivf`; `TranLogoEnd.ivf` starts 1 s later |
| 3    | The service exits: `FinishIntroAnimation`, "HMI ready", state INIT → NORMAL, `NotifySystemStateChange`, event `ShowDisclaimer` | One timer with the length of `TranLogo.ivf`, then context `Disclaimer`                                      |
| 4    | Disclaimer: `DisposeIntroVideo`; Agree sends `Global.Yes` (rule A240), the 3.5 s timeout sends `Timeout` (A239)                | Both go to `HomeScreen`; `DisposeIntroVideo` hides `TranLogoEnd` in the browser                             |
| 5    | Leaving the context runs `ExitDisclaimer` and the GUI sends `NotifyDisclaimerEnd`                                              | Ignored by the server                                                                                       |

## Temperature warning

`temperatureService.js` polls every 5000 ms, the default of `--temperature_poll_interval` in
`svcjciblmsystem.so` (`sm.conf` does not override it). It sends `DisplayOverTemperature` and
opens the `SystemWarning` context. In the firmware this context closes only on OK
(`Global.Yes`, rule A245: Home) or on navigation events, never when the temperature drops.

The firmware polling reads `/sys/devices/virtual/thermal/thermal_zone0/temp` (SoC) and
compares it with `trip_point_0_temp - 3`; that path leads to a protective shutdown, not to
the dialog. The source of the display warning was not found in the dump, so the 85 °C and
80 °C thresholds and the 20–100 °C range are the emulator's own.

## Known differences from the firmware

- The Disclaimer ends at Home. The firmware returns to the last application (navigation,
  entertainment source, CarPlay and so on) by the rules of the `Timeout`/`Yes` cells.
- Only the cold start is simulated. `ShowQuickStartLoop`, ignition cycles and the other
  state-machine transitions are not.
- Priorities from `mmui_config.xml` (an incoming call or the camera covering the Disclaimer)
  are not modeled.
- Server timers and the browser video start independently, so they can differ by less than a
  second.

## Reading the native decision tables

The libraries in `jci/mmui/uia` are ARM32 and not stripped. Each has the symbols
`UIA_<APP>_ContextMachine`, `_ColumnHeaders` (contexts), `_RowHeaders` (events),
`_UniqueCells` and `_CellLookupIndices`; context names come from `UIA_<APP>_ContextIdToStr`
and event names from `UIA_<APP>_StrToEventId`. Conditions and actions in a cell are function
names such as `UIA_SYSTEM_WasNavi`. Use them to check a behavior before changing the
emulator, and note the source (library, symbol) in the code comment, as `systemApp.js` and
`temperatureService.js` do.
