const protocol = require('./protocol');
const sendContextChange = protocol.sendContextChange;
const navigationState = require('./navigationState');
const dialogState = require('./dialogState');
const systemApp = require('./systemApp');
const syssettingsApp = require('./syssettingsApp');
const sysupdateApp = require('./sysupdateApp');
const vehsettingsApp = require('./vehsettingsApp');
const audiosettingsApp = require('./audiosettingsApp');
const btpairingApp = require('./btpairingApp');
const netmgmtApp = require('./netmgmtApp');
const schedmaintApp = require('./schedmaintApp');
const ecoenergyApp = require('./ecoenergyApp');

const handleMmuiEvent = function (ws, uiaId, eventId, params) {
    switch (eventId) {
        case 'Global.GetStartupSettings':
            systemApp.handleGetStartupSettings(ws);
            break;
        case 'SelectDriveRecord':
            sendContextChange(ws, 'vdt', 'DriveChartDetails');
            break;
        case 'SelectEcoEnergy':
            systemApp.handleSelectEcoEnergy(ws);
            break;
        case 'SelectSwitchView':
            ecoenergyApp.handleSelectSwitchView(ws);
            break;
        case 'ResetConfirm':
            ecoenergyApp.handleResetConfirm(ws);
            break;
        case 'SelectVehicleStatusMonitor':
            systemApp.handleSelectVehicleStatusMonitor(ws);
            break;
        case 'SelectWarnGuide':
            systemApp.handleSelectWarnGuide(ws);
            break;
        case 'SelectSchedMaint':
            systemApp.handleSelectSchedMaint(ws);
            break;
        case 'SelectScheduledMaintenance':
            schedmaintApp.handleSelectScheduledMaintenance(ws);
            break;
        case 'SelectTireRotation':
            schedmaintApp.handleSelectTireRotation(ws);
            break;
        case 'SelectOilChange':
            schedmaintApp.handleSelectOilChange(ws);
            break;
        case 'SelectSettingInterval':
            schedmaintApp.handleSelectSettingInterval(ws, params);
            break;
        case 'SelectReset':
            if (uiaId === 'ecoenergy') {
                ecoenergyApp.handleResetConfirmYes(ws);
            } else {
                schedmaintApp.handleSelectReset(ws);
            }
            break;
        case 'SetSchedMaintOnOff':
            schedmaintApp.handleSetSchedMaintOnOff(ws, params);
            break;
        case 'SetTireRotationOnOff':
            schedmaintApp.handleSetTireRotationOnOff(ws, params);
            break;
        case 'SetOilChange':
            schedmaintApp.handleSetOilChange(ws, params);
            break;
        case 'SetTimeValue':
            schedmaintApp.handleSetTimeValue(ws, params);
            break;
        case 'SetDistanceValue':
            schedmaintApp.handleSetDistanceValue(ws, params, params && params.currentContextId);
            break;
        case 'Global.InitGui':
            systemApp.handleInitGui(ws);
            break;
        case 'Global.IntentHome':
            systemApp.handleIntentHome(ws);
            break;
        case 'Global.Yes':
            if (dialogState.disclaimerActive && (uiaId === 'common' || uiaId === 'Common')) {
                systemApp.dismissDisclaimer(ws);
            } else if (
                dialogState.softwareInfoDialogActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                sysupdateApp.handleSoftwareInfoOk(ws);
            } else if (
                dialogState.musicDBUpdateActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                sysupdateApp.handleMusicDBUpdateClose(ws);
            } else if (
                dialogState.factoryResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                syssettingsApp.handleFactoryResetYes(ws);
            } else if (
                dialogState.displayResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                syssettingsApp.handleDisplayResetYes(ws);
            } else if (
                dialogState.hudResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleHudResetYes(ws);
            } else if (
                dialogState.hudDisplayInfoResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleDisplayInfoResetYes(ws);
            } else if (
                dialogState.doorLockResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleDoorLockResetYes(ws);
            } else if (
                dialogState.turnResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleTurnResetYes(ws);
            } else if (
                dialogState.lightingResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleLightingResetYes(ws);
            } else if (
                dialogState.drssResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleDrssResetYes(ws);
            } else if (
                dialogState.sbsJ36IpmResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleSbsJ36IpmResetYes(ws);
            } else if (
                dialogState.sbsResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleSbsResetYes(ws);
            } else if (
                dialogState.fowResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleFowResetYes(ws);
            } else if (
                dialogState.ldwsResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleLdwsResetYes(ws);
            } else if (
                dialogState.lasResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleLasResetYes(ws);
            } else if (
                dialogState.sliResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleSliResetYes(ws);
            } else if (
                dialogState.schedMaintResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                schedmaintApp.handleResetYes(ws);
            } else if (
                dialogState.schedMaintOffConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                schedmaintApp.handleOffYes(ws);
            } else if (uiaId === 'ecoenergy') {
                ecoenergyApp.handleResetConfirmYes(ws);
            }
            break;
        case 'Global.No':
            // Global.No is shared by dialogs; guard it with dialog state.
            if (dialogState.languageConfActive && (uiaId === 'common' || uiaId === 'Common')) {
                syssettingsApp.handleLanguageConfNo(ws);
            } else if (
                dialogState.factoryResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                syssettingsApp.handleFactoryResetNo(ws);
            } else if (
                dialogState.displayResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                syssettingsApp.handleDisplayResetNo(ws);
            } else if (
                dialogState.hudResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleHudResetNo(ws);
            } else if (
                dialogState.hudDisplayInfoResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleDisplayInfoResetNo(ws);
            } else if (
                dialogState.doorLockResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleDoorLockResetNo(ws);
            } else if (
                dialogState.turnResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleTurnResetNo(ws);
            } else if (
                dialogState.lightingResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleLightingResetNo(ws);
            } else if (
                dialogState.drssResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleDrssResetNo(ws);
            } else if (
                dialogState.sbsJ36IpmResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleSbsJ36IpmResetNo(ws);
            } else if (
                dialogState.sbsResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleSbsResetNo(ws);
            } else if (
                dialogState.fowResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleFowResetNo(ws);
            } else if (
                dialogState.ldwsResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleLdwsResetNo(ws);
            } else if (
                dialogState.lasResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleLasResetNo(ws);
            } else if (
                dialogState.sliResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                vehsettingsApp.handleSliResetNo(ws);
            } else if (
                dialogState.schedMaintResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                schedmaintApp.handleResetNo(ws);
            } else if (
                dialogState.schedMaintOffConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                schedmaintApp.handleOffNo(ws);
            }
            break;
        case 'Global.Cancel':
            // Global.Cancel is shared by the music database dialogs.
            if (btpairingApp.handleCancel(ws)) {
                break;
            }
            if (dialogState.musicDBUpdateActive && (uiaId === 'common' || uiaId === 'Common')) {
                sysupdateApp.handleMusicDBUpdateClose(ws);
            } else if (
                (uiaId === 'ecoenergy' || uiaId === 'Common' || uiaId === 'common') &&
                ecoenergyApp.isResetConfirmActive()
            ) {
                ecoenergyApp.handleResetCancel(ws);
            }
            break;
        case 'Timeout':
            // Timeout is shared by system dialogs; only handle it for the disclaimer.
            if (dialogState.disclaimerActive && uiaId === 'system') {
                systemApp.dismissDisclaimer(ws);
            }
            break;
        case 'Global.GoBack':
            if (
                dialogState.schedMaintResetConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                schedmaintApp.handleResetNo(ws);
                break;
            }
            if (
                dialogState.schedMaintOffConfirmActive &&
                (uiaId === 'common' || uiaId === 'Common')
            ) {
                schedmaintApp.handleOffNo(ws);
                break;
            }
            if (navigationState.goBackStack.length > 1) {
                // Clear dialog flags when Back dismisses their contexts.
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                        'sysupdate' &&
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                        'SoftwareInfo'
                ) {
                    dialogState.softwareInfoDialogActive = false;
                }
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                        'syssettings' &&
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                        'LanguageConf'
                ) {
                    dialogState.languageConfActive = false;
                    dialogState.pendingLanguageId = null;
                }
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                        'sysupdate' &&
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                        'SearchMusicDBUpdates'
                ) {
                    dialogState.musicDBUpdateActive = false;
                }
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                        'syssettings' &&
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                        'FactoryResetConfirm'
                ) {
                    dialogState.factoryResetConfirmActive = false;
                }
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                    'vehsettings'
                ) {
                    var safetyDialogContext =
                        navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId;
                    if (safetyDialogContext === 'DRSSReset')
                        dialogState.drssResetConfirmActive = false;
                    if (safetyDialogContext === 'SBSReset')
                        dialogState.sbsResetConfirmActive = false;
                    if (safetyDialogContext === 'SBS_SCBSReset_J36IPM')
                        dialogState.sbsJ36IpmResetConfirmActive = false;
                    if (safetyDialogContext === 'FOWReset')
                        dialogState.fowResetConfirmActive = false;
                    if (safetyDialogContext === 'LDWSReset')
                        dialogState.ldwsResetConfirmActive = false;
                    if (safetyDialogContext === 'LASReset') {
                        dialogState.lasResetConfirmActive = false;
                        dialogState.lasResetProgressActive = false;
                    }
                    if (safetyDialogContext === 'SLIReset') {
                        dialogState.sliResetConfirmActive = false;
                        dialogState.sliResetProgressActive = false;
                    }
                }
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                        'schedmaint' &&
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                        'ConfirmReset'
                ) {
                    dialogState.schedMaintResetConfirmActive = false;
                    dialogState.schedMaintResetContext = null;
                }
                if (
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].uiaId ===
                        'schedmaint' &&
                    navigationState.goBackStack[navigationState.goBackStack.length - 1].ctxtId ===
                        'ConfirmOff'
                ) {
                    dialogState.schedMaintOffConfirmActive = false;
                    dialogState.schedMaintOffContext = null;
                }
                navigationState.goBackStack.pop();
                var context = navigationState.goBackStack[navigationState.goBackStack.length - 1];
                // Re-display the new stack top without pushing it again.
                sendContextChange(
                    ws,
                    context.uiaId,
                    context.ctxtId,
                    context.params,
                    context.contextSeq,
                    true
                );
            }
            break;
        case 'SelectApplications':
            systemApp.handleSelectApplications(ws);
            break;
        case 'SelectSourceMenu':
            ecoenergyApp.handleSelectSourceMenu(ws);
            break;
        case 'SelectEntertainment':
            systemApp.handleSelectEntertainment(ws);
            break;
        case 'SelectCommunication':
            systemApp.handleSelectCommunication(ws);
            break;
        case 'SelectNavigation':
            systemApp.handleSelectNavigation(ws);
            break;
        case 'SelectSettings':
            if (uiaId === 'ecoenergy') {
                ecoenergyApp.handleSelectSettings(ws);
            } else {
                systemApp.handleSelectSettings(ws);
            }
            break;
        case 'Global.IntentSettingsTab':
            systemApp.handleIntentSettingsTab(ws, params);
            break;
        case 'SelectLanguageConf':
            syssettingsApp.handleSelectLanguageConf(ws, params);
            break;
        case 'SetLanguage':
            syssettingsApp.handleSetLanguage(ws, params);
            break;
        case 'SetTimeFormat':
            syssettingsApp.handleSetTimeFormat(params);
            break;
        case 'SetUnitsTemperature':
            syssettingsApp.handleSetUnitsTemperature(params);
            break;
        case 'SetUnitsDistance':
            syssettingsApp.handleSetUnitsDistance(params);
            break;
        case 'SetDayNightAuto':
            syssettingsApp.handleSetDisplayDayNight(params);
            break;
        case 'SetBrightness':
            syssettingsApp.handleSetDisplayBrightness(params);
            break;
        case 'SetContrast':
            syssettingsApp.handleSetDisplayContrast(params);
            break;
        case 'DisplaySettingsResetConf':
            syssettingsApp.handleDisplayReset(ws);
            break;
        case 'SetGpsSync':
            syssettingsApp.handleSetGpsSync(params);
            break;
        case 'SetTimeZone':
            syssettingsApp.handleSetTimeZone(params);
            break;
        case 'SetDaylightSavingTime':
            syssettingsApp.handleSetDaylightSavingTime(params);
            break;
        case 'SetTime':
            syssettingsApp.handleSetTime(params);
            break;
        case 'SetAudioBass':
            audiosettingsApp.handleSetAudioBass(params);
            break;
        case 'SetAudioTreble':
            audiosettingsApp.handleSetAudioTreble(params);
            break;
        case 'SetAudioFader':
            audiosettingsApp.handleSetAudioFader(params);
            break;
        case 'SetAudioBalance':
            audiosettingsApp.handleSetAudioBalance(params);
            break;
        case 'SetAudioAutoVolume':
            audiosettingsApp.handleSetAudioAutoVolume(params);
            break;
        case 'SetAudioGuidanceVol':
            audiosettingsApp.handleSetAudioGuidanceVol(params);
            break;
        case 'SetAudioCenterpoint':
            audiosettingsApp.handleSetAudioCenterpoint(params);
            break;
        case 'SetAudioAudioPilot':
            audiosettingsApp.handleSetAudioAudioPilot(params);
            break;
        case 'SetBeepOnOff':
            audiosettingsApp.handleSetBeepOnOff(params);
            break;
        case 'SelectTimeZone':
            // The firmware context is literally named SelectTimeZone.
            sendContextChange(ws, uiaId, 'SelectTimeZone');
            break;
        case 'SelectDisplayOff':
        case 'SelectDisplayClock':
            // These are native commands, not GUI contexts.
            break;
        case 'SelectChangeLanguage':
            syssettingsApp.handleSelectChangeLanguage(ws, uiaId);
            break;
        case 'SelectAgreementsAndDisclaimers':
            syssettingsApp.handleSelectAgreementsAndDisclaimers(ws, uiaId);
            break;
        case 'SelectVersion':
            sysupdateApp.handleSelectVersion(ws);
            break;
        case 'SelectMusicDatabaseUpdate':
            sysupdateApp.handleSelectMusicDatabaseUpdate(ws);
            break;
        case 'SearchForUpdates':
            sysupdateApp.handleSearchForUpdates(ws);
            break;
        case 'SelectFactoryReset':
            syssettingsApp.handleSelectFactoryReset(ws, uiaId);
            break;
        case 'SelectBluetooth':
            btpairingApp.handleSelectBluetooth(ws);
            break;
        case 'SelectBluetoothSettings':
            btpairingApp.handleSelectBluetoothSettings(ws);
            break;
        case 'ToggleBluetoothOn':
            btpairingApp.handleToggleBluetooth(ws, true);
            break;
        case 'ToggleBluetoothOff':
            btpairingApp.handleToggleBluetooth(ws, false);
            break;
        case 'AddNewDevice':
            btpairingApp.handleAddNewDevice(ws);
            break;
        case 'SelectNetworkManagement':
            netmgmtApp.handleSelectNetworkManagement(ws);
            break;
        case 'SetWifiConnection':
            netmgmtApp.handleSetWifiConnection(ws, params);
            break;
        case 'SelectNetworkConnection':
            netmgmtApp.handleSelectNetworkConnection(ws);
            break;
        case 'SelectWifiMode':
            netmgmtApp.handleSelectWifiMode(ws, params);
            break;
        case 'SetAppleCarPlay':
        case 'SetAndroidAuto':
            // These rows are visible but disabled in the vehicle configuration.
            syssettingsApp.sendDevicesState(ws);
            break;
        case 'GoHUDReset':
            vehsettingsApp.handleGoHudReset(ws);
            break;
        case 'GoDRSSReset':
            vehsettingsApp.handleGoDRSSReset(ws);
            break;
        case 'GoSBSReset':
        case 'GoSBS_SCBSReset':
            vehsettingsApp.handleGoSbsReset(ws);
            break;
        case 'GoSBS_SCBS_J36IPMReset':
            vehsettingsApp.handleGoSbsJ36IpmReset(ws);
            break;
        case 'ResetFOWSettings':
        case 'GoFOWReset':
        case 'GoFowReset':
            vehsettingsApp.handleGoFowReset(ws);
            break;
        case 'SelectDRSS':
            sendContextChange(ws, uiaId, 'DRSS');
            break;
        case 'GoSBS':
            vehsettingsApp.handleGoSBS(ws);
            break;
        case 'GoSBS_SCBS':
            vehsettingsApp.handleGoSBS_SCBS(ws);
            break;
        case 'GoSBS_SCBS_J36IPM':
        case 'SetSCBS_J36IPM':
            vehsettingsApp.handleGoSBS_SCBS_J36IPM(ws);
            break;
        case 'GoFOW':
            vehsettingsApp.handleGoFOW(ws);
            break;
        case 'SelectBSMBuzzerVolume':
            vehsettingsApp.handleOpenSafetyContext(ws, 'BSMVolume');
            break;
        case 'SelectBSMSystem':
            vehsettingsApp.handleOpenSafetyContext(ws, 'BSMSystem');
            break;
        case 'SelectLaneDepartureWarning':
            vehsettingsApp.handleOpenSafetyContext(ws, 'LDWS');
            break;
        case 'GoLDWSTiming':
            vehsettingsApp.handleOpenSafetyContext(ws, 'LDWSTiming');
            break;
        case 'GoLDWSReset':
            vehsettingsApp.handleGoLdwsReset(ws);
            break;
        case 'GoLAS':
            vehsettingsApp.handleOpenSafetyContext(ws, 'LAS');
            break;
        case 'GoLASTiming':
            vehsettingsApp.handleOpenSafetyContext(ws, 'LASTiming');
            break;
        case 'GoLASSound':
            vehsettingsApp.handleOpenSafetyContext(ws, 'LASSound');
            break;
        case 'GoLASReset':
            vehsettingsApp.handleGoLasReset(ws);
            break;
        case 'GoMRCC':
            vehsettingsApp.handleOpenSafetyContext(ws, 'MRCC');
            break;
        case 'SelectSpeedLimitInfo':
            vehsettingsApp.handleSelectSpeedLimitInfo(ws);
            break;
        case 'SelectSLSign':
            vehsettingsApp.handleOpenSafetyContext(ws, 'SLSign');
            break;
        case 'SelectSLCaution':
            vehsettingsApp.handleOpenSafetyContext(ws, 'SLCaution');
            break;
        case 'SelectCautionSpeed':
            vehsettingsApp.handleOpenSafetyContext(ws, 'CautionSpeed');
            break;
        case 'SelectSPIReset':
            vehsettingsApp.handleGoSliReset(ws);
            break;
        case 'GoCamera360View':
            vehsettingsApp.handleOpenSafetyContext(ws, 'Camera360View');
            break;
        case 'GoDoorLock':
            vehsettingsApp.handleGoDoorLock(ws);
            break;
        case 'GoKeylessLockBeepVol':
            vehsettingsApp.handleGoKeylessLockBeepVol(ws);
            break;
        case 'GoDoorRelockTime':
            vehsettingsApp.handleGoDoorRelockTime(ws);
            break;
        case 'GoDoorLockReset':
            vehsettingsApp.handleGoDoorLockReset(ws);
            break;
        case 'GoTurnSettings':
            vehsettingsApp.handleGoTurnSettings(ws);
            break;
        case 'GoTurnReset':
            vehsettingsApp.handleGoTurnReset(ws);
            break;
        case 'Set3FlashTurnSignal':
        case 'SetTurnSignalIndicatorVolume':
            vehsettingsApp.handleTurnSettingsEvent(ws, eventId, params);
            break;
        case 'GoLighting':
            vehsettingsApp.handleGoLighting(ws);
            break;
        case 'SelectInteriorLightTimeoutDoorOpen':
            vehsettingsApp.handleOpenLightingContext(ws, 'IntLightTimeoutDoorOpen');
            break;
        case 'SelectInteriorLightTimeoutDoorClosed':
            vehsettingsApp.handleOpenLightingContext(ws, 'IntLightTimeoutDoorClosed');
            break;
        case 'SelectHeadlightOffTimer':
            vehsettingsApp.handleOpenLightingContext(ws, 'HeadlightOffTimer');
            break;
        case 'GoCHLT':
            vehsettingsApp.handleOpenLightingContext(ws, 'CHLT');
            break;
        case 'GoAutoHeadlightOn':
            vehsettingsApp.handleOpenLightingContext(ws, 'AutoHeadlightOn');
            break;
        case 'SelectILB':
            vehsettingsApp.handleOpenLightingContext(ws, 'IntLightingBrightness');
            break;
        case 'GoLightingReset':
            vehsettingsApp.handleGoLightingReset(ws);
            break;
        case 'SetHBC':
        case 'SetAFS':
        case 'SetHeadlightOnWarning':
        case 'SetHeadlightOffTimer':
        case 'SetCHLT':
        case 'SetLHL':
        case 'SetDaytimeRunningLights':
        case 'SetAutoHeadlightSensitivity':
        case 'SetInteriorLightTimeoutDoorOpen':
        case 'SetInteriorLightTimeoutDoorClosed':
        case 'SetILB':
            vehsettingsApp.handleLightingSettingsEvent(ws, eventId, params);
            break;
        case 'SetDRSS':
        case 'SetDRSSDistance':
        case 'SetSBS':
        case 'SetSBSDistance':
        case 'SetSBSBuzzerVolume':
        case 'SetSCBS':
        case 'SetSCBSMode_J36IPM':
        case 'SetSCBSDistance_J36IPM':
        case 'SetFOW':
        case 'SetFOWDistance':
        case 'SetFOWBuzzerVolume':
        case 'SetRainSensingWiper':
        case 'SetBSMBuzzerVolume':
        case 'SetBSMSystem':
        case 'SetBSMVolume':
        case 'SetLDWSTiming':
        case 'SetLDWSWarning':
        case 'SetBuzzerSetting':
        case 'SetLASSound':
        case 'SetLDWSBuzzerVolume':
        case 'SetLDWSRumbleVolume':
        case 'SetLASSoundVol':
        case 'SetLASIntervention':
        case 'SetLASAlert':
        case 'SetMRCCDistanceControl':
        case 'SetDA':
        case 'SetParkingSensor':
        case 'SetSLC':
        case 'SetCautionSpeed':
        case 'SetSLS_HUD':
        case 'SetSLS_WHUD':
        case 'SetSLS_Center':
        case 'SetTVMAutoViewStart':
        case 'SetTVMVehiclePathLine':
        case 'SetTVMFrontViewDisplay':
            vehsettingsApp.handleSafetySettingsEvent(ws, eventId, params);
            break;
        case 'SetAutoDoorLockAT6':
        case 'SetKeylessLockBeepVol':
        case 'SetAutoRelockTimer':
        case 'SetUnlockMode':
        case 'SetWalkAwayLock':
        case 'SetHandsFreeLiftgate':
        case 'SetSpeedAlarmOnOff':
        case 'SetSpeedAlarm':
            vehsettingsApp.handleVehicleSettingsEvent(ws, eventId, params);
            break;
        case 'SetHudHeight':
        case 'SetHudBrightnessControl':
        case 'SetHudBrightness':
        case 'SetHudCalibration':
        case 'SetHUDRotation':
        case 'SetHudNavigation':
        case 'SetHudOpenClose':
        case 'SelectDisplayInformation':
        case 'SelectDisplayInformationJ36':
        case 'SelectHUDStreet':
        case 'SetHUDStreet':
        case 'SelectHUDNavigationScreen':
        case 'SelectHUDNavigation':
        case 'SelectDisplayReset':
            if (
                !vehsettingsApp.handleHudEvent(ws, eventId, params) &&
                eventId === 'SelectHUDNavigation'
            ) {
                break;
            }
            break;
        case 'GoUnlockMode':
            vehsettingsApp.handleGoUnlockMode(ws);
            break;
        case 'GoDoorLockMode':
            vehsettingsApp.handleGoDoorLockMode(ws);
            break;
        default:
            if (eventId.substr(0, 6) === 'Select') {
                sendContextChange(ws, uiaId, eventId.substr(6));
            }
    }
    return true;
};

module.exports = handleMmuiEvent;
