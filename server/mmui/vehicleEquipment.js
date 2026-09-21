// Vehicle equipment flags: 1 means installed, 0 means unavailable.
const VEHICLE_EQUIPMENT = {
    // --- Lighting ---
    AFS_Installed: 0, // Adaptive Front-lighting System
    AHBC_Installed: 1, // Adaptive LED Headlights
    HBC_Installed: 0, // High Beam Control (auto high-beam)
    DRL_Installed: 0, // Daytime Running Lights
    HeadlightON_Installed: 1, // Auto Headlight On
    HeadlightAutoSensitivity_Installed: 1, // Auto headlight sensitivity adjustment
    HeadOffTimer_Installed: 0, // Headlight-off delay timer
    ILB_Installed: 0, // Interior lighting brightness control
    LHL_Installed: 1, // Low-beam-related headlight feature
    ThreeFlash_Installed: 1, // Triple-flash turn signal
    TurnSignalVolume_Installed: 1, // Turn signal click volume
    CHLT_Installed: 1, // Coming-Home Light Timer

    // --- Safety / ADAS ---
    BSM_Installed: 1, // Blind Spot Monitoring
    LAS_Installed: 1, // Lane-keep Assist System
    LDW_Installed: 0, // Lane Departure Warning
    LDWSSound_Installed: 0, // LDW warning sound
    DRSS_Installed: 0, // Distance Recognition Support System
    FOW_Installed: 0, // Forward Obstruction Warning
    SBS_Installed: 0, // Smart Brake Support
    SCBS_Installed: 4, // Smart City Brake Support; 0/1 hide, 4/5 = J36IPM submenu, other = ordinary checkbox SCBS
    RVM_Installed: 0, // Rear Vehicle Monitoring
    MRCC_Installed: 0, // Mazda Radar Cruise Control
    DA_Installed: 1, // Driver (Attention) Alert
    ParkingSensor_Installed: 1, // Front/rear parking sensors
    SpeedAlarm_Installed: 1, // Speed alarm

    // --- Doors / locks ---
    AutoDoorLockAT_Installed: 0, // Auto door lock (5-speed/other automatic transmission)
    AutoDoorLockAT6_Installed: 1, // Auto door lock (6-speed automatic transmission)
    AutoDoorLockMT_Installed: 0, // Auto door lock (manual transmission)
    AutoDoorRelock_Installed: 1, // Auto door re-lock
    UnlockMode_Installed: 0, // Door unlock mode selection (absent on the user's real car)
    BuzzerAnswerback_Installed: 1, // Lock/unlock confirmation beep
    HandsFreeLiftgate_Installed: 0, // Hands-free power liftgate
    WalkAway_Installed: 1, // Auto-lock on walk-away

    // --- Wipers / interior timers ---
    AutoWiper_Installed: 1, // Rain-sensing wipers
    LightTimeoutDoorOpen_Installed: 1, // Interior light timeout (door open)
    LightTimeoutDoorClosed_Installed: 1, // Interior light timeout (door closed)

    // --- Displays ---
    Hud_Installed: 1, // Head-Up Display

    // --- Other ---
    TVM_Installed: 1, // Traffic View Monitor / 360 View Monitor

    // --- Units (not real optional equipment, always present on any real car) ---
    TemperatureUnit_Installed: 1,
    DistanceUnit_Installed: 1
};

const VEHICLE_CAPABILITIES = {
    NewBSM_Support: 1, // 1 = BSM System screen, 0 = legacy BSM volume row
    TSRStatus: 'TSR_Enabled', // TSR_Enabled | TSR_Disabled
    TSRMode: 'TSR_New' // TSR_New | TSR_Euro_NCAP | TSR_Default
};

const SYSSETTINGS_UIA_FLAGS = ['TemperatureUnit_Installed', 'DistanceUnit_Installed'];

function getUiaIdForFlag(flagName) {
    return SYSSETTINGS_UIA_FLAGS.indexOf(flagName) !== -1 ? 'syssettings' : 'vehsettings';
}

module.exports = {
    VEHICLE_EQUIPMENT: VEHICLE_EQUIPMENT,
    VEHICLE_CAPABILITIES: VEHICLE_CAPABILITIES,
    getUiaIdForFlag: getUiaIdForFlag
};
