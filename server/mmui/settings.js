const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const VEHICLE_CONFIG_FILE = path.join(__dirname, '..', 'config/vehicle.json');

function loadVehicleConfig() {
    try {
        return JSON.parse(fs.readFileSync(VEHICLE_CONFIG_FILE, 'utf8'));
    } catch (e) {
        throw new Error('config/vehicle.json could not be loaded: ' + e.message, { cause: e });
    }
}

const VEHICLE_CONFIG = loadVehicleConfig();

const VALID_REGIONS = [
    'Region_Europe',
    'Region_NorthAmerica',
    'Region_4A',
    'Region_Japan',
    'Region_ChinaTaiwan'
];

const VALID_DESTINATIONS = [
    'SETTINGS_Destination_JP',
    'SETTINGS_Destination_NA',
    'SETTINGS_Destination_EU',
    'SETTINGS_Destination_UK',
    'SETTINGS_Destination_AU',
    'SETTINGS_Destination_RHD',
    'SETTINGS_Destination_LHD',
    'SETTINGS_Destination_ChinaTaiwan',
    'SETTINGS_Destination_4A',
    'SETTINGS_Destination_MX',
    'SETTINGS_Destination_BR',
    'SETTINGS_Destination_CA'
];

function requireAllowedValue(name, value, allowed) {
    if (allowed.indexOf(value) === -1) {
        throw new Error(
            'Invalid config/vehicle.json ' +
                name +
                ' "' +
                value +
                '". Allowed values: ' +
                allowed.join(', ')
        );
    }
}

requireAllowedValue('region', VEHICLE_CONFIG.region, VALID_REGIONS);
requireAllowedValue('destinationCode', VEHICLE_CONFIG.destinationCode, VALID_DESTINATIONS);
requireAllowedValue('vehicleType', VEHICLE_CONFIG.vehicleType, [
    'SETTINGS_VehicleModelType_J03A',
    'SETTINGS_VehicleModelType_J03E',
    'SETTINGS_VehicleModelType_J03F',
    'SETTINGS_VehicleModelType_J03G',
    'SETTINGS_VehicleModelType_J03J',
    'SETTINGS_VehicleModelType_J03K',
    'SETTINGS_VehicleModelType_J03W',
    'SETTINGS_VehicleModelType_J12A',
    'SETTINGS_VehicleModelType_J12F',
    'SETTINGS_VehicleModelType_J36',
    'SETTINGS_VehicleModelType_J36IPM',
    'SETTINGS_VehicleModelType_J53',
    'SETTINGS_VehicleModelType_J71',
    'SETTINGS_VehicleModelType_J72A',
    'SETTINGS_VehicleModelType_J78A',
    'SETTINGS_VehicleModelType_Undefined'
]);
requireAllowedValue('hudType', VEHICLE_CONFIG.hudType, ['CHUD_mono', 'CHUD_color', 'WHUD_color']);
requireAllowedValue('navigationSdCard', VEHICLE_CONFIG.navigationSdCard, ['On', 'Off']);
requireAllowedValue('bose', VEHICLE_CONFIG.bose, ['On', 'Off']);
requireAllowedValue('appleCarPlayAvailable', VEHICLE_CONFIG.appleCarPlayAvailable, ['On', 'Off']);
requireAllowedValue('appleWirelessCarPlayAvailable', VEHICLE_CONFIG.appleWirelessCarPlayAvailable, [
    'On',
    'Off'
]);
requireAllowedValue('appleCarPlayConnection', VEHICLE_CONFIG.appleCarPlayConnection, ['On', 'Off']);
requireAllowedValue('appleCarPlaySettings', VEHICLE_CONFIG.appleCarPlaySettings, ['On', 'Off']);
requireAllowedValue('androidAutoAvailable', VEHICLE_CONFIG.androidAutoAvailable, ['On', 'Off']);
requireAllowedValue('androidAutoConnection', VEHICLE_CONFIG.androidAutoConnection, ['On', 'Off']);
requireAllowedValue('androidAutoSettings', VEHICLE_CONFIG.androidAutoSettings, ['On', 'Off']);

const USER_SETTINGS_FILE = path.join(__dirname, '..', 'data/user-settings.json');

function loadUserSettings() {
    try {
        return JSON.parse(fs.readFileSync(USER_SETTINGS_FILE, 'utf8'));
    } catch (e) {
        if (e.code !== 'ENOENT') {
            logger.warn(
                'settings',
                'data/user-settings.json could not be read (%s), falling back to defaults',
                e.message
            );
        }
        return {};
    }
}

function saveUserSettings() {
    // Save only user-editable fields. Vehicle identity stays in vehicle.json.
    const toSave = {
        keyboardLanguage: settings.currentSettings.keyboardLanguage,
        timeFormat: settings.currentSettings.timeFormat,
        temperatureUnit: settings.currentSettings.temperatureUnit,
        distanceUnit: settings.currentSettings.distanceUnit,
        languageId: settings.currentLanguageId,
        hudHeight: settings.currentSettings.hudHeight,
        hudBrightnessControl: settings.currentSettings.hudBrightnessControl,
        hudBrightness: settings.currentSettings.hudBrightness,
        hudCalibration: settings.currentSettings.hudCalibration,
        hudRotation: settings.currentSettings.hudRotation,
        hudNavigation: settings.currentSettings.hudNavigation,
        hudDisplay: settings.currentSettings.hudDisplay,
        hudStreetInformation: settings.currentSettings.hudStreetInformation,
        hudNavigationScreen: settings.currentSettings.hudNavigationScreen,
        doorLockAT6Mode: settings.currentSettings.doorLockAT6Mode,
        keylessLockBeepVol: settings.currentSettings.keylessLockBeepVol,
        doorRelockTimer: settings.currentSettings.doorRelockTimer,
        unlockMode: settings.currentSettings.unlockMode,
        walkAwayLock: settings.currentSettings.walkAwayLock,
        handsFreeLiftgate: settings.currentSettings.handsFreeLiftgate,
        speedAlarmOnOff: settings.currentSettings.speedAlarmOnOff,
        speedAlarmValue: settings.currentSettings.speedAlarmValue,
        autoWiper: settings.currentSettings.autoWiper,
        threeFlashTurnSignal: settings.currentSettings.threeFlashTurnSignal,
        turnSignalIndicatorVolume: settings.currentSettings.turnSignalIndicatorVolume,
        lightingInteriorBrightness: settings.currentSettings.lightingInteriorBrightness,
        lightingInteriorTimeoutDoorOpen: settings.currentSettings.lightingInteriorTimeoutDoorOpen,
        lightingInteriorTimeoutDoorClosed:
            settings.currentSettings.lightingInteriorTimeoutDoorClosed,
        lightingHighBeamControl: settings.currentSettings.lightingHighBeamControl,
        lightingAfs: settings.currentSettings.lightingAfs,
        lightingHeadlightOnWarning: settings.currentSettings.lightingHeadlightOnWarning,
        lightingHeadlightOffTimer: settings.currentSettings.lightingHeadlightOffTimer,
        lightingComingHome: settings.currentSettings.lightingComingHome,
        lightingLeavingHome: settings.currentSettings.lightingLeavingHome,
        lightingDaytimeRunningLights: settings.currentSettings.lightingDaytimeRunningLights,
        lightingAutoHeadlightSensitivity: settings.currentSettings.lightingAutoHeadlightSensitivity,
        displayDayNightMode: settings.currentSettings.displayDayNightMode,
        displayBrightness: settings.currentSettings.displayBrightness,
        displayContrast: settings.currentSettings.displayContrast,
        gpsSync: settings.currentSettings.gpsSync,
        timeZoneIndex: settings.currentSettings.timeZoneIndex,
        daylightSavingTime: settings.currentSettings.daylightSavingTime,
        clockOffsetSeconds: settings.currentSettings.clockOffsetSeconds,
        drssMode: settings.currentSettings.drssMode,
        drssDistance: settings.currentSettings.drssDistance,
        sbsMode: settings.currentSettings.sbsMode,
        sbsDistance: settings.currentSettings.sbsDistance,
        sbsBuzzerVolume: settings.currentSettings.sbsBuzzerVolume,
        scbsMode: settings.currentSettings.scbsMode,
        fowMode: settings.currentSettings.fowMode,
        fowDistance: settings.currentSettings.fowDistance,
        fowBuzzerVolume: settings.currentSettings.fowBuzzerVolume,
        bsmSystem: settings.currentSettings.bsmSystem,
        bsmBuzzerVolume: settings.currentSettings.bsmBuzzerVolume,
        ldwsTiming: settings.currentSettings.ldwsTiming,
        ldwsWarning: settings.currentSettings.ldwsWarning,
        ldwsSound: settings.currentSettings.ldwsSound,
        ldwsSoundVolume: settings.currentSettings.ldwsSoundVolume,
        lasIntervention: settings.currentSettings.lasIntervention,
        lasAlert: settings.currentSettings.lasAlert,
        mrccDistanceControl: settings.currentSettings.mrccDistanceControl,
        driverAttentionAlert: settings.currentSettings.driverAttentionAlert,
        parkingSensor: settings.currentSettings.parkingSensor,
        speedLimitCaution: settings.currentSettings.speedLimitCaution,
        cautionSpeed: settings.currentSettings.cautionSpeed,
        speedLimitHud: settings.currentSettings.speedLimitHud,
        speedLimitCenter: settings.currentSettings.speedLimitCenter,
        tvmAutoViewStart: settings.currentSettings.tvmAutoViewStart,
        tvmVehiclePathLine: settings.currentSettings.tvmVehiclePathLine,
        tvmFrontViewDisplay: settings.currentSettings.tvmFrontViewDisplay,
        bluetooth: settings.currentSettings.bluetooth,
        wifiMode: settings.currentSettings.wifiMode,
        schedMaintSetting: settings.currentSettings.schedMaintSetting,
        schedMaintDistance: settings.currentSettings.schedMaintDistance,
        schedMaintTime: settings.currentSettings.schedMaintTime,
        tireRotationSetting: settings.currentSettings.tireRotationSetting,
        tireRotationDistance: settings.currentSettings.tireRotationDistance,
        oilMaintSetting: settings.currentSettings.oilMaintSetting,
        oilMaintDistance: settings.currentSettings.oilMaintDistance,
        soundBass: settings.currentSettings.soundBass,
        soundTreble: settings.currentSettings.soundTreble,
        soundFade: settings.currentSettings.soundFade,
        soundBalance: settings.currentSettings.soundBalance,
        soundAutoVolume: settings.currentSettings.soundAutoVolume,
        soundGuidanceVol: settings.currentSettings.soundGuidanceVol,
        soundCenterPoint: settings.currentSettings.soundCenterPoint,
        soundAudioPilot: settings.currentSettings.soundAudioPilot,
        soundBeep: settings.currentSettings.soundBeep
    };
    try {
        const previousSettings = loadUserSettings();
        const changedFields = Object.keys(toSave).filter(
            (fieldName) => previousSettings[fieldName] !== toSave[fieldName]
        );
        fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(toSave, null, 2));
        logger.success('settings', 'Saved user settings');
        if (changedFields.length > 0) {
            const changes = changedFields.map(
                (fieldName) => `${fieldName}=${JSON.stringify(toSave[fieldName])}`
            );
            logger.debug('settings', 'Changed fields: %s', changes.join(', '));
        }
    } catch (e) {
        logger.error('settings', 'Could not save user settings: %s', e.message);
    }
}

// ---------------------------------------------------------------------------
// DEFAULT_SETTINGS / currentSettings
// ---------------------------------------------------------------------------
// GuiFramework._getStartupSettings() (GuiFramework.js) sends Global.GetStartupSettings
// and then waits up to 20 seconds for the real "syssettings" MMUI app to report region,
// language, keyboard language, time format, temperature/distance units and vehicle type
// (via Localization.js setters). Only once ALL of them are set does
// Localization._tryInitGui() call framework.initGui() early; otherwise GUI just sits on
// a blank/partial screen until the 20s timeout fires and GuiFramework fills in its own
// hardcoded defaults.
//
// Real MMUI would push these values through actual "msg"/uiaId:"syssettings" frames
// (see syssettingsApp.js's _messageTable: "Region", "KeyboardLanguage", "TimeFormat",
// "Temperature", "Distance", "VehicleType"). We emulate exactly that (see
// startup.js's sendStartupSettings()) instead of waiting out the timeout.
//
// DEFAULT_SETTINGS is the "factory defaults" layer - a plain constant, never mutated at
// runtime. currentSettings is what's actually sent/used; it starts as a copy of
// DEFAULT_SETTINGS with anything found in data/user-settings.json (see the persistence
// block above) overlaid on top, so a value the user changed on a previous run survives
// a restart of this server, while anything never explicitly changed keeps falling back
// to the hardcoded default. Edit DEFAULT_SETTINGS to change what a fresh/reset
// environment boots with - only the listed enum values are recognized by the GUI (see
// Localization.js validation / GuiFramework.js defaults).
//
// NOTE: Language is intentionally kept separate from this object (see currentLanguageId
// below) even though it IS restored at boot now, same as everything here - see the
// "LanguageSupported" comment inside startup.js's sendStartupSettings() for the
// (surprisingly non-obvious) native mechanism that makes that possible.
const DEFAULT_SETTINGS = {
    // Not strictly validated by the GUI - any non-empty string is accepted - but the
    // real values MMUI sends are keys of syssettingsApp.js's KEYBOARD_LANG_CODES
    // table, e.g.: "LANGS_KB_US_ENGLISH" | "LANGS_KB_RU_RUSSIAN" | "LANGS_KB_UK_ENGLISH" |
    // "LANGS_KB_DE_GERMAN" | "LANGS_KB_FR_FRENCH" | ... (see that table for the full list).
    keyboardLanguage: 'LANGS_KB_US_ENGLISH',

    // One of: "hrs12" | "hrs24" (syssettingsApp.js's _TimeFormatMsgHandler normalizes
    // both "hrs12"/"12hrs" and "hrs24"/"24hrs", but "hrsNN" is the wire format MMUI uses)
    timeFormat: 'hrs12',

    // One of: "Fahrenheit" | "Celsius"
    temperatureUnit: 'Fahrenheit',

    // One of: "Miles" | "Kilometers"
    distanceUnit: 'Miles',
    displayDayNightMode: 'Auto',
    displayBrightness: 0,
    displayContrast: 0,

    // Settings -> Clock. Matches syssettingsApp.js's own hardcoded field defaults
    // (this._cachedGPSSync/_cachedTimeZoneIndex/_cachedDayLightSavingsTime in its
    // constructor) so a fresh/reset environment boots identical to real firmware.
    // One of: "On" | "Off". GPS Sync uses the vehicle's GPS/nav fix to keep the clock
    // (and, if navigation hardware is present, the time zone/DST) in sync automatically;
    // while "On", "Adjust Time" is disabled (see syssettingsApp.js's
    // _EnableDisableClockTabItemsOnGpsSyncStatus).
    gpsSync: 'Off',

    // Index 34 is "UTC Coordinated Universal Time" in the firmware timezone list.
    timeZoneIndex: 34,

    // One of: "On" | "Off". Only shown as a Clock Tab list item at all when
    // HARDWARE_CONFIG.region is Region_Europe, Region_NorthAmerica or Region_4A (client-
    // side gate in syssettingsApp.js's _populateListCtrl "ClockTab" case) - hidden
    // entirely for Region_Japan/Region_ChinaTaiwan. Sending this value is harmless even
    // when the item is hidden (the GUI simply ignores it).
    daylightSavingTime: 'Off',

    // Manual clock adjustment offset (seconds) applied on top of the real wall-clock
    // time when reporting "SendCurrentTimeEpoch" (see startup.js's
    // sendCurrentTimeEpoch()). Sent to us by the "Adjust Time" screen's
    // ClockSettings2Ctrl as an absolute epoch (params.payload.u32TimestampSec) every
    // time the driver nudges hours/minutes there; we store the delta from the real
    // clock instead of the absolute value so it keeps applying correctly as real time
    // advances. 0 = clock matches the host machine's real time.
    clockOffsetSeconds: 0,

    hudHeight: 0,
    hudBrightnessControl: 1,
    hudBrightness: 0,
    hudCalibration: 0,
    hudRotation: 0,
    hudNavigation: 2,
    hudDisplay: 1,
    hudStreetInformation: 'Street_Always',
    hudNavigationScreen: 'Navigation_Maneuver',

    // Settings -> Vehicle -> Door Lock. Matches vehsettingsApp.js's own hardcoded
    // field defaults for the AT6 (6-speed automatic) variant, which is the only door
    // lock mode variant this emulator's vehicleEquipment.js currently reports as
    // installed (AutoDoorLockAT6_Installed: 1) - see that file for how to switch to
    // the AT/MT variants instead.
    doorLockAT6Mode: 'AT6_Off', // one of the AT6_* strings, see _DoorLockModeAutoTransmission6CtxtDataList
    keylessLockBeepVol: 'KBV_Middle', // KBV_Big | KBV_Middle | KBV_Small | KBV_Off
    doorRelockTimer: 'Door_Relock_60_Sec', // Door_Relock_90_Sec | _60_Sec | _30_Sec
    unlockMode: 'Unlock_DriverSeat', // Unlock_AllSeat | Unlock_DriverSeat
    walkAwayLock: 'WalkAwayLock_Off', // WalkAwayLock_On | WalkAwayLock_Off
    handsFreeLiftgate: 'HandsFreeLiftgate_Off', // HandsFreeLiftgate_On | _Off

    // Settings -> Vehicle -> Speed Alarm. On real hardware this whole feature is
    // actually driven by a CAN signal (evData 1 = off, 2..51 = on with that speed as
    // the threshold - see vehsettingsApp.js's (client) _GoToSettingsMsgHandler for the
    // exact boundary-clamping rules per distance unit) rather than anything the GUI
    // itself persists, but since we have no real instrument cluster to query, we keep
    // it here like any other user-settable value.
    speedAlarmOnOff: 'SpeedAlarm_Off', // SpeedAlarm_On | SpeedAlarm_Off
    // Client clamps this per distance unit: for km/h anything <=30 is shown/treated as
    // 30 (max 250), for mph anything <=20 is shown/treated as 20 (max 150). 30 is the
    // real minimum threshold on km/h cars (the default here), so keep it at 30, not 20.
    speedAlarmValue: 30, // km/h or mph threshold, depending on distanceUnit

    // Settings -> Vehicle -> Auto Wiper / Rain Sensing Wiper. The GUI names the MMUI
    // events "RainSensingWiper" even though the visible row label is "AutoWiper".
    autoWiper: 'RSW_Off', // RSW_On | RSW_Off

    // Settings -> Vehicle -> Указатель поворота (Turn). Matches vehsettingsApp.js's
    // (client) own hardcoded field defaults at cold boot (this._cachedSafety_
    // 3flashTurnSignal = "Three_Flash_Off", this._cachedSafety_TurnSignalIndicatorVolume
    // = "Turn_Volume_Small"). Both items only show up at all when their matching
    // *_Installed flag (ThreeFlash_Installed / TurnSignalVolume_Installed in
    // vehicleEquipment.js) is 1 - if BOTH are 0, the whole "Указатель поворота" entry
    // disappears from Settings -> Vehicle entirely (see getTrueCountsVehicleTab() in
    // the real firmware).
    threeFlashTurnSignal: 'Three_Flash_Off', // Three_Flash_On | Three_Flash_Off
    turnSignalIndicatorVolume: 'Turn_Volume_Small', // Turn_Volume_Big | Turn_Volume_Small

    // Settings -> Vehicle -> Освещение (Lighting). Defaults mirror the firmware
    // constructor's cached values; visibility is controlled separately by
    // vehicleEquipment.js's Lighting *_Installed flags.
    lightingInteriorBrightness: 'ILB_Medium', // ILB_Bright | ILB_Medium | ILB_Dark | ILB_Off
    lightingInteriorTimeoutDoorOpen: 'ILTDO_10_Min', // ILTDO_60_Min | ILTDO_30_Min | ILTDO_10_Min
    lightingInteriorTimeoutDoorClosed: 'ILTDC_7_5_Sec', // ILTDC_60_Sec | ILTDC_30_Sec | ILTDC_15_Sec | ILTDC_7_5_Sec
    lightingHighBeamControl: 'HBC_Off', // HBC_On | HBC_Off; AHBC uses the same Set/GetHBC value
    lightingAfs: 'AFS_Off', // AFS_On | AFS_Off
    lightingHeadlightOnWarning: 'HOW_Off', // HOW_Big | HOW_Small | HOW_Off
    lightingHeadlightOffTimer: 'HOT_OFF', // HOT_120_Sec | HOT_90_Sec | HOT_60_Sec | HOT_30_Sec | HOT_OFF
    lightingComingHome: 'CHL_OFF', // CHL_120_SEC | CHL_90_SEC | CHL_60_SEC | CHL_30_SEC | CHL_OFF
    lightingLeavingHome: 'LHL_Off', // LHL_On | LHL_Off
    lightingDaytimeRunningLights: 'DRL_Off', // DRL_On | DRL_Off
    lightingAutoHeadlightSensitivity: 'AHS_Standard', // AHS_Extra_High | AHS_High | AHS_Standard | AHS_Low | AHS_Extra_Low

    // Settings -> Safety. Real firmware defaults match the GUI's own cached values at
    // cold boot: DRSS/SBS/SCBS/FOW are all off by default, with short warning distance
    // and no alarm volume until the driver changes them.
    drssMode: 'DRSS_Off',
    drssDistance: 'DRSS_Distance_Short',
    sbsMode: 'SBS_Off',
    sbsDistance: 'SBS_Distance_Short',
    sbsBuzzerVolume: 'SBS_Vol_No_Alarm',
    scbsMode: 'SCBS_Off',
    fowMode: 'FOW_Off',
    fowDistance: 'FOW_Distance_Short',
    fowBuzzerVolume: 'FOW_Vol_No_Alarm',
    bsmSystem: 'BSM_On',
    bsmBuzzerVolume: 'BSM_Vol_No_Alarm',
    ldwsTiming: 'LDWS_Timing_Online',
    ldwsWarning: 'LDWS_Warning_Rare',
    ldwsSound: 'LDWS_Sound_Buzzer',
    ldwsSoundVolume: 'LDWS_Vol_High',
    lasIntervention: 'LAS_Intervention_Off',
    lasAlert: 'LAS_Alert_Off',
    mrccDistanceControl: 'MRCCDistanceControl_Off',
    driverAttentionAlert: 'DA_Off',
    parkingSensor: 'Off',
    speedLimitCaution: 'SLC_Sign',
    cautionSpeed: 'SLCS_0',
    speedLimitHud: 'SLS_HUD_On',
    speedLimitCenter: 'SLS_Center_On',
    tvmAutoViewStart: 'On',
    tvmVehiclePathLine: 'On',
    tvmFrontViewDisplay: 'Off',

    // Settings -> Devices.
    // Bluetooth is always visible in DevicesTab; this value is the on/off checkbox
    // state inside the btpairing/BTConnectionManager screen. 0/1/2 Wi-Fi modes match
    // netmgmtApp.js's NETMGMT_WIFI_Mode enum: disabled/client/access point.
    bluetooth: 'On',
    wifiMode: 0,

    // Applications -> Vehicle Status Monitor -> Maintenance.
    // EU/J78A GUI displays the main list as:
    //   Плановое ТО         Выкл.
    //   Перестановка колес  Выкл.
    //   Замена масла        3700 км
    // Oil change "Настройка интервала" is an on/off checkbox in the user's car
    // (firmware Oil_setting_disp=Manual_Only), not the Flexible/Fixed/Off submenu.
    // "Off" rows remain navigable and are not hidden/disabled.
    schedMaintSetting: 'Off', // On | Off
    schedMaintDistance: 15000, // km
    schedMaintTime: 360, // days; GUI turns >=30 into months on detail screen
    tireRotationSetting: 'Off', // On | Off
    tireRotationDistance: 10000, // km
    oilMaintSetting: 'On', // On | Off in Manual_Only mode; Flexible | Fixed | Off in AutoAndManual mode
    oilMaintDistance: 3700, // km

    // Settings -> Sound. Matches audiosettingsApp.js's own hardcoded field defaults
    // (this._cachedBassValue/_cachedTrebleValue/_cachedFaderValue/_cachedBalanceValue/
    // _cachedAutoVolume all default to 0; this._cachedGuidanceVolValue defaults to 30;
    // this._centerPointValue/_audioPilotValue/_BeepValue all default to 2, i.e. "Off")
    // so a fresh/reset environment boots identical to real firmware. Which of these
    // items the GUI actually shows (and whether "Auto Volume" or "Center Point"/"Audio
    // Pilot" appear at all) depends on HARDWARE_CONFIG.vehicleType and
    // HARDWARE_CONFIG.bose - see SOUND.md for the full breakdown of the three possible
    // item lists.
    soundBass: 0, // range -6..+6
    soundTreble: 0, // range -6..+6
    soundFade: 0, // range -8..+8 (Front/Back)
    soundBalance: 0, // range -8..+8 (Left/Right)
    soundAutoVolume: 0, // range 0..7, only shown when HARDWARE_CONFIG.bose is "Off"
    soundGuidanceVol: 30, // range 0..63 (navigation voice guidance volume)

    // One of: "On" | "Off". "Center Point" only shown when HARDWARE_CONFIG.bose is
    // "On" AND vehicleType is not one of the J03*/J12* families (see SOUND.md).
    soundCenterPoint: 'Off',

    // One of: "On" | "Off". "Audio Pilot" only shown when HARDWARE_CONFIG.bose is "On"
    // (any vehicleType except J03*). Labeled "AudioPilotJPN" instead of "AudioPilot"
    // when HARDWARE_CONFIG.region is Region_Japan (label only, same setting/value).
    soundAudioPilot: 'Off',

    // One of: "On" | "Off". Always shown regardless of vehicleType/Bose.
    soundBeep: 'Off'
};

// ---------------------------------------------------------------------------
// HARDWARE_CONFIG
// ---------------------------------------------------------------------------
// "Region" and "VehicleType" are reported by syssettingsApp.js's _messageTable exactly
// like the settings above, but unlike them there is NO GUI flow anywhere in apps/ that
// lets the driver change either value from the head unit - they only ever flow one way
// (MMUI -> GUI), sourced from how the specific unit was built/coded at the factory
// (sales region, car model). So these are deliberately kept OUT of DEFAULT_SETTINGS /
// currentSettings / data/user-settings.json entirely - they are not "user preferences" and
// must never be persisted or restored from a previous session the way language/clock
// format are. Edit config/vehicle.json to simulate a different market/vehicle.
const HARDWARE_CONFIG = {
    // One of: "Region_Europe" | "Region_NorthAmerica" | "Region_4A" | "Region_Japan" | "Region_ChinaTaiwan"
    // (see jci/gui/framework/js/Localization.js's this.REGIONS for the canonical list).
    region: VEHICLE_CONFIG.region,

    // BUGFIX: this used to be the bare string "J36". That matched nothing - every
    // "_cachedVehicleType === ..." check across apps/ compares against the FULL wire
    // value MMUI actually sends, e.g. "SETTINGS_VehicleModelType_J36" (confirmed via
    // `readelf -p .rodata libjciuiasyssettings.so`, whose SendGUI_VehicleType function
    // embeds these exact strings - "SETTINGS_VehicleModelType_J03A/J03E/J03F/J03G/J03J/
    // J03K/J03W/J12A/J12F/J36/J36IPM/J53/J71/J72A/J78A/Undefined" are all present
    // there). A bare "J36" silently took every "else" branch everywhere (harmless by
    // accident, since "else" is usually the plain/non-J78A path - which is also why
    // this went unnoticed until we started actually looking at HUD's own
    // "_HUDInstalledStatus == true" + "VehicleType === ...J78A" branch), but it made it
    // impossible to ever exercise a model-specific branch (e.g. HUDTabJ78) by editing
    // this constant. GuiFramework.js's OWN internal 20s-timeout fallback (used only if
    // no "VehicleType" msg ever arrives at all) separately hardcodes that same bare
    // "J36" - that one is real firmware behavior we don't control, not something to
    // copy here.
    //
    // Edit this to any of the values above (with the "SETTINGS_VehicleModelType_"
    // prefix) to simulate a different model - e.g. "SETTINGS_VehicleModelType_J78A"
    // switches Settings -> Vehicle/Safety/HUD over to their "J78A" tab variants (see
    // vehsettingsApp.js's _HudInstalledStatusHandler and syssettingsApp.js's own copy
    // of the same check).
    vehicleType: VEHICLE_CONFIG.vehicleType,

    // Separate from VehicleType: the physical HUD hardware reports its own type.
    // The user's vehicle has a color image projected onto the windshield, which
    // corresponds to the WHUD_color value handled by vehsettingsApp.js.
    hudType: VEHICLE_CONFIG.hudType,

    // Navigation SD card / navigation database availability. The GUI receives
    // this as vehsettings:NAVIEquipped, using the wire values "On"/"Off".
    navigationSdCard: VEHICLE_CONFIG.navigationSdCard,
    destinationCode: VEHICLE_CONFIG.destinationCode,

    // Whether the car has the Bose amplifier/speaker system installed. Reported to
    // the GUI as audiosettings:BoseAvailable, payload.status (1 = Bose present, 0 =
    // Bose absent) - see audiosettingsApp.js's _BoseAvailableMsgHandler/_updateDataList
    // for how this flips Settings -> Sound between its "Auto Volume" (no Bose) and
    // "Center Point"/"Audio Pilot" (Bose) variants. See SOUND.md for the full analysis
    // of which Sound-tab item list each combination of vehicleType/bose produces.
    // One of: "On" | "Off".
    bose: VEHICLE_CONFIG.bose,

    // Settings -> Devices capability/current-connection signals. These are not user
    // preferences; real MMUI pushes them from the phone-projection/network stacks.
    appleCarPlayAvailable: VEHICLE_CONFIG.appleCarPlayAvailable,
    appleWirelessCarPlayAvailable: VEHICLE_CONFIG.appleWirelessCarPlayAvailable,
    appleCarPlayConnection: VEHICLE_CONFIG.appleCarPlayConnection,
    appleCarPlaySettings: VEHICLE_CONFIG.appleCarPlaySettings,
    androidAutoAvailable: VEHICLE_CONFIG.androidAutoAvailable,
    androidAutoConnection: VEHICLE_CONFIG.androidAutoConnection,
    androidAutoSettings: VEHICLE_CONFIG.androidAutoSettings
};

// Tracks which language the GUI currently believes is active (as a "LANGS_XX_..." ID,
// see syssettingsApp.js's hardcoded _cachedLanguagesList for the full set of ~42 IDs).
// Defaults to Localization.js's own default ("en_US" -> LANGS_US_ENGLISH is the first
// entry in that list, matching what the GUI boots with before any language message is
// ever sent) unless overridden by a previously saved data/user-settings.json. Updated by
// syssettingsApp.js whenever "SelectLanguageConf"/"SetLanguage" confirms a new language,
// and read both by "SelectChangeLanguage" (to tell the GUI which entry in the Choose
// Language list should show as currently selected/checked) and by startup.js's
// sendStartupSettings() (to actually restore this language's dictionaries at boot - see
// the "LanguageSupported" comment there for how/why that works).
const settings = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    HARDWARE_CONFIG: HARDWARE_CONFIG,
    VEHICLE_CONFIG_FILE: VEHICLE_CONFIG_FILE,
    // currentSettings = DEFAULT_SETTINGS with any saved data/user-settings.json values on
    // top. (HARDWARE_CONFIG is intentionally not part of this merge - see comment above.)
    currentSettings: Object.assign({}, DEFAULT_SETTINGS, loadUserSettings()),
    currentLanguageId: loadUserSettings().languageId || 'LANGS_US_ENGLISH',
    saveUserSettings: saveUserSettings
};

module.exports = settings;
