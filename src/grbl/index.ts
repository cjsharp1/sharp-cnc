export type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
export { DEFAULT_BAUD } from "./transport";

export type {
  Axis,
  GrblActivePins,
  GrblMachineState,
  GrblStatus,
  Position3,
} from "./types";
export { OFFLINE_STATUS, ZERO_POSITION } from "./types";

export { parseStatusReport } from "./parseStatus";
export { createGrblClient } from "./client";

export type {
  ExternalControlAction,
  ExternalControlAdapter,
  ExternalControlEvent,
  ExternalControlObserveInput,
  ExternalControlSource,
} from "./externalControls";
export {
  createDemonShieldExternalControlAdapter,
  isGrblResetBanner,
  parseActivePins,
} from "./externalControls";

export type { SoftTravelLimits } from "./machineConfig";
export {
  DEFAULT_SOFT_TRAVEL,
  bedSizeFromLimits,
  loadSoftTravel,
  maxForAxis,
  minForAxis,
  saveSoftTravel,
} from "./machineConfig";

export type {
  StockConfig,
  StockCorner,
  StockHandle,
  StockHit,
} from "./stockConfig";
export {
  DEFAULT_STOCK,
  MIN_STOCK_XY_MM,
  applyStockSizeKeepingOrigin,
  clampStockToBed,
  cursorForStockHit,
  hitTestStock,
  loadStock,
  moveStockBy,
  resizeStockFromHandle,
  roundStockMm,
  saveStock,
  stockBounds,
  stockOffsetForCorner,
  stockOffsetForWorkOriginCorner,
} from "./stockConfig";

export type { ToolBitType, ToolConfig } from "./toolConfig";
export {
  DEFAULT_TOOL,
  TOOL_BIT_LABELS,
  loadTool,
  saveTool,
} from "./toolConfig";

export type { AxisDirInvert, GrblSetting } from "./settings";
export {
  CALIBRATION_DISTANCE_OPTIONS_MM,
  DEFAULT_CALIBRATION_DISTANCE_MM,
  DEFAULT_GRBL_SETTINGS,
  DIR_INVERT_BIT,
  DIR_TEST_JOG_MM,
  MAX_TRAVEL_SETTING_FOR_AXIS,
  SETTING_DIR_PORT_INVERT,
  SETTING_LABELS,
  SETTING_MAX_TRAVEL_X,
  SETTING_MAX_TRAVEL_Y,
  SETTING_MAX_TRAVEL_Z,
  SETTING_SOFT_LIMITS,
  SETTING_STEPS_X,
  SETTING_STEPS_Y,
  SETTING_STEPS_Z,
  STEPS_SETTING_FOR_AXIS,
  canWriteSettings,
  computeStepsPerMm,
  decodeDirInvertMask,
  describeDirInvertMask,
  encodeDirInvertMask,
  formatSettingWrite,
  parseSettingLine,
  parseSettingsDump,
  roundStepsPerMm,
  softLimitsEnabled,
  softTravelFromSettings,
  softTravelWriteCommands,
} from "./settings";

export {
  fetchGrblSettings,
  writeGrblSetting,
  writeGrblSettings,
} from "./settingsIo";

export type { JogDelta, JogMode, SoftLimitCheck } from "./jog";
export {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_CANCEL_BYTE,
  JOG_FEED_OPTIONS_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  MAX_JOG_FEED_MM_MIN,
  buildJogCommand,
  checkSoftLimits,
  continuousJogDelta,
  jogDeltaFromAxes,
} from "./jog";

export type {
  BedTravelCornerId,
  BedTravelGate,
  BedTravelPlan,
  BedTravelSegment,
  BedTravelSegmentPhase,
  PlanBedTravelOptions,
} from "./bedTravelTest";
export {
  BED_TRAVEL_APPROACH_FEED_MM_MIN,
  BED_TRAVEL_APPROACH_MM,
  BED_TRAVEL_CRUISE_FEED_MM_MIN,
  BED_TRAVEL_PROXIMITY_MM,
  BED_TRAVEL_SAFE_Z_LIFT_MM,
  BED_TRAVEL_Z_MARGIN_MM,
  canStartBedTravelTest,
  describeBedTravelProgress,
  distanceToSoftEdgeMm,
  planBedTravelTest,
} from "./bedTravelTest";
export type {
  PlanStockPerimeterOptions,
  StockPerimeterCornerId,
  StockPerimeterGate,
  StockPerimeterPlan,
  StockPerimeterSegment,
  StockPerimeterSegmentPhase,
} from "./stockPerimeterTest";
export {
  STOCK_PERIMETER_APPROACH_FEED_MM_MIN,
  STOCK_PERIMETER_APPROACH_MM,
  STOCK_PERIMETER_CRUISE_FEED_MM_MIN,
  STOCK_PERIMETER_PROXIMITY_MM,
  STOCK_PERIMETER_SAFE_Z_LIFT_MM,
  STOCK_PERIMETER_Z_MARGIN_MM,
  canStartStockPerimeterTest,
  describeStockPerimeterProgress,
  planStockPerimeterTest,
  stockCornerMachine,
  stockCornerWork,
} from "./stockPerimeterTest";
export { playProximityBeep } from "./proximityBeep";

export type { GoToWorkZeroOptions, GoToWorkZeroPlan, ZeroAxisSelection } from "./workZero";
export {
  DEFAULT_WCS_P,
  buildSetWorkZeroCommand,
  planGoToWorkZero,
} from "./workZero";

export type { HomingConfig } from "./homing";
export {
  DEFAULT_HOMING_CONFIG,
  HOME_COMMAND,
  HOMING_CONFIG_KEY,
  canHome,
  describeClearHomeState,
  loadHomingConfig,
  saveHomingConfig,
} from "./homing";

export type {
  SavedWorkOffset,
  WcsId,
  WorkOffsetsStore,
} from "./workOffsets";
export {
  DEFAULT_WORK_OFFSETS,
  WCS_OPTIONS,
  WORK_OFFSETS_KEY,
  buildRecallOffsetCommands,
  buildSelectWcsCommand,
  buildSetAbsoluteWcoCommand,
  currentWcoFromStatus,
  loadWorkOffsets,
  parseWcsId,
  saveWorkOffsets,
  snapshotOffset,
  wcsP,
} from "./workOffsets";

export type { GcodeMacro } from "./consoleMacros";
export {
  DEFAULT_MACROS,
  MACROS_KEY,
  canSendConsole,
  createMacro,
  loadMacros,
  parseConsoleLines,
  saveMacros,
} from "./consoleMacros";

export type {
  CornerProbeOptions,
  EdgeDirection,
  EdgeProbeOptions,
  ToolLengthProbeOptions,
} from "./xyProbe";
export {
  bitRadiusMm,
  buildAxisProbeSeekCommand,
  buildEdgeWorkZeroCommand,
  buildRelativeRetractCommand,
  canToolLengthProbe,
  runCornerProbeCycle,
  runEdgeProbeCycle,
  runToolLengthProbeCycle,
} from "./xyProbe";

export type { DryRunOptions, JobTimeEstimate } from "./jobControls";
export {
  ESTIMATE_FEED_MM_MIN,
  ESTIMATE_RAPID_MM_MIN,
  buildDryRunLines,
  clampScrubIndex,
  estimateJobTime,
  estimateJobTimeFromJob,
  findNextToolChange,
  isToolChangeLine,
  sliceJobFromLine,
} from "./jobControls";

export type {
  AlarmGuide,
  AlarmGuideKind,
  AlarmGuideStep,
} from "./alarmGuide";
export {
  classifyAlarm,
  guideForAlarm,
  guideFromAlarmLine,
} from "./alarmGuide";

export type { DesktopPortInfo } from "./desktopSerial";
export {
  createDesktopGrblClient,
  createDesktopTransport,
  listDesktopPorts,
} from "./desktopSerial";

export {
  createMockGrblClient,
  createMockTransport,
  isVirtualCncPath,
  listMockPorts,
  VIRTUAL_CNC_PATH,
} from "./mockSerial";

export { createWebGrblClient, createWebSerialTransport } from "./webSerial";

export { createRoutingTransport } from "./routingTransport";

export {
  createSessionClient,
  listAvailablePorts,
  isDesktopShell,
} from "./session";

export type { GamepadJogFrame, GamepadSample, GamepadAxisMap } from "./gamepadJog";
export {
  GAMEPAD_DEADZONE,
  GAMEPAD_MAP,
  GAMEPAD_MAPPING_HELP,
  firstConnectedGamepad,
  gamepadContinuousDelta,
  mapGamepadToJog,
  pressedButtonSet,
} from "./gamepadJog";

export type { LoadedJob, PathMotion, ToolpathSegment } from "./gcode";
export {
  GCODE_EXTENSIONS,
  canStartJob,
  extractToolpath,
  isGcodeFileName,
  loadJobFromText,
  parseGcodeLines,
  stripGcodeComments,
} from "./gcode";

export type {
  PathSimSnapshot,
  SimActivity,
  SimPhase,
  SimSpeedRate,
  SimSpeeds,
} from "./pathSimulation";
export {
  DEFAULT_SIM_SPEED,
  SIM_FEED_MM_S,
  SIM_RAPID_MM_S,
  SIM_SPEED_PRESETS,
  SIM_Z_MM_S,
  advanceSim,
  classifySimActivity,
  createIdleSim,
  formatSimActivityLabel,
  pathLength,
  pauseSim,
  resumeSim,
  samplePathAtDistance,
  segmentLength,
  startSim,
  stopSim,
} from "./pathSimulation";

export type { Point2, Polyline2 } from "./svgPath";
export {
  boundsOfPolylines,
  normalizePolylinesForCnc,
  parsePathData,
  tokenizePathData,
} from "./svgPath";

export type { SvgImportResult } from "./svgImport";
export {
  extractSvgPolylines,
  importSvg,
  isSvgFileName,
  lengthToMm,
  polylinesToPreview,
} from "./svgImport";

export type { SampleSvgSpec } from "./sampleSvgs";
export {
  SAMPLE_SVGS,
  fetchSampleSvg,
  sampleSvgUrl,
} from "./sampleSvgs";

export type { SvgCutMode, SvgToolpathParams } from "./svgToolpath";
export {
  DEFAULT_SVG_TOOLPATH,
  buildJobFromSvg,
  formatMm,
  generateSvgGcode,
} from "./svgToolpath";

export type {
  CutStyle,
  FeedsSpeedsSelection,
  FeedsSpeedsSuggestion,
  MaterialKind,
  MaterialPreset,
} from "./materialPresets";
export {
  CUT_STYLE_LABELS,
  DEFAULT_FEEDS_SELECTION,
  MATERIAL_LABELS,
  MATERIAL_PRESETS,
  REF_BIT_DIAMETER_MM,
  getMaterialPreset,
  loadFeedsSpeedsSelection,
  saveFeedsSpeedsSelection,
  selectionFromSuggestion,
  suggestFeedsSpeeds,
} from "./materialPresets";

export type { OverridePercents } from "./overrideConfig";
export {
  DEFAULT_OVERRIDE_PERCENTS,
  loadOverridePercents,
  saveOverridePercents,
} from "./overrideConfig";

export type { CustomFeedsPreset } from "./customPresets";
export {
  deleteCustomFeedsPreset,
  loadCustomFeedsPresets,
  upsertCustomFeedsPreset,
} from "./customPresets";

export type { OverrideStep, RapidOverrideStep } from "./spindleFeed";
export {
  DEFAULT_SPINDLE_RPM,
  FEED_OVERRIDE_COARSE_MINUS,
  FEED_OVERRIDE_COARSE_PLUS,
  FEED_OVERRIDE_FINE_MINUS,
  FEED_OVERRIDE_FINE_PLUS,
  FEED_OVERRIDE_MAX,
  FEED_OVERRIDE_MIN,
  FEED_OVERRIDE_RESET,
  MAX_SPINDLE_RPM,
  MIN_SPINDLE_RPM,
  RAPID_OVERRIDE_LOW,
  RAPID_OVERRIDE_MEDIUM,
  RAPID_OVERRIDE_RESET,
  SPINDLE_OVERRIDE_COARSE_MINUS,
  SPINDLE_OVERRIDE_COARSE_PLUS,
  SPINDLE_OVERRIDE_FINE_MINUS,
  SPINDLE_OVERRIDE_FINE_PLUS,
  SPINDLE_OVERRIDE_MAX,
  SPINDLE_OVERRIDE_MIN,
  SPINDLE_OVERRIDE_RESET,
  applyOverrideStep,
  applyRapidOverrideStep,
  buildSpindleOffCommand,
  buildSpindleOnCommand,
  buildSpindleSpeedCommand,
  feedOverrideByte,
  rapidOverrideByte,
  spindleOverrideByte,
} from "./spindleFeed";

export type {
  GcodeStreamer,
  StreamPhase,
  StreamProgress,
  StreamStartOptions,
} from "./streamer";
export { GRBL_RX_BUFFER, createGcodeStreamer } from "./streamer";

export type { JobRecoveryCheckpoint } from "./jobRecovery";
export {
  clearJobRecoveryCheckpoint,
  formatRecoveryPos,
  isIncompleteRecovery,
  loadJobRecoveryCheckpoint,
  recoveryResumeLineLabel,
  saveJobRecoveryCheckpoint,
} from "./jobRecovery";

export type {
  ActivityAppendOptions,
  ActivityCategory,
  ActivityEntry,
  ActivityFilter,
  ActivityKind,
  ActivityLog,
} from "./activityLog";
export {
  createActivityLog,
  entryMatchesFilter,
  formatActivityLine,
  formatTxPayload,
  inferActivityCategory,
  isStatusChatter,
} from "./activityLog";

export { instrumentTransport } from "./instrumentTransport";

export type {
  BuildDebugSnapshotInput,
  DebugBridgeConnection,
  DebugBridgeJob,
  DebugBridgeMachine,
  DebugBridgeSnapshot,
  DebugBridgeStatus,
} from "./debugBridge";
export {
  DEBUG_BRIDGE_DEFAULT_PORT,
  DEBUG_BRIDGE_SCHEMA_VERSION,
  buildDebugSnapshot,
  debugBridgeBaseUrl,
  publishDebugSnapshot,
  queryDebugBridgeStatus,
  startDebugBridge,
  stopDebugBridge,
} from "./debugBridge";

export {
  DEFAULT_DEBUG_MODE,
  loadDebugMode,
  saveDebugMode,
} from "./debugModeConfig";

export type { FirstRunState, FirstRunStepId } from "./firstRunConfig";
export {
  DEFAULT_FIRST_RUN,
  FIRST_RUN_STEPS,
  loadFirstRunState,
  resetFirstRunState,
  saveFirstRunCompleted,
} from "./firstRunConfig";

export type { UiTheme } from "./themeConfig";
export {
  DEFAULT_UI_THEME,
  applyUiTheme,
  loadUiTheme,
  saveUiTheme,
} from "./themeConfig";

export type { ParsedAlarm } from "./safety";
export {
  UNLOCK_COMMAND,
  canJogOrZero,
  checkJobSoftLimits,
  parseAlarmLine,
} from "./safety";

export type {
  ProbeConfig,
  ProbeResult,
  RunZProbeOptions,
  RunZProbeOutcome,
} from "./probe";
export {
  DEFAULT_PROBE_CONFIG,
  PROBE_CONFIG_KEY,
  buildManualZZeroCommand,
  buildProbeRetractCommand,
  buildProbeWorkZZeroCommand,
  buildZProbeSeekCommand,
  canProbe,
  loadProbeConfig,
  parseProbeResult,
  runZProbeCycle,
  saveProbeConfig,
} from "./probe";

export type { JobsFolderConfig, JobsFolderHealth } from "./jobsFolderConfig";
export {
  DEFAULT_JOBS_FOLDER,
  JOBS_FOLDER_ERROR_BACKOFF_MS,
  JOBS_FOLDER_POLL_MS,
  jobsFolderHealthLabel,
  loadJobsFolderConfig,
  saveJobsFolderConfig,
  shortFolderLabel,
} from "./jobsFolderConfig";

export type { RecentJobEntry } from "./recentJobs";
export {
  loadRecentJobs,
  recentJobThumbnailSvg,
  rememberRecentJob,
  removeRecentJob,
} from "./recentJobs";

export type { DriveConfig } from "./driveConfig";
export {
  DEFAULT_DRIVE_CONFIG,
  clearDriveConfig,
  getDriveClientId,
  isDriveConfigured,
  loadDriveConfig,
  saveDriveConfig,
} from "./driveConfig";

export type { JobFileEntry } from "./desktopJobsFolder";
export {
  jobsFolderExists,
  listJobFiles,
  pickJobsFolder,
  readJobFile,
} from "./desktopJobsFolder";

export type { DriveConnectResult, DriveFileEntry } from "./googleDrive";
export {
  beginDriveConnect,
  driveStatusLabel,
  listDriveJobFiles,
  readDriveJobFile,
} from "./googleDrive";

export type {
  LatestReleaseInfo,
  ReleaseAsset,
  UpdateCheckResult,
} from "./appVersion";
export {
  GITHUB_API_LATEST_RELEASE,
  GITHUB_OWNER,
  GITHUB_RELEASES_LATEST_URL,
  GITHUB_REPO,
  checkLatestRelease,
  compareVersions,
  formatVersionLabel,
  isNewerVersion,
  normalizeVersion,
  openExternalUrl,
  packagedAppVersion,
  parseGithubReleaseJson,
  parseSemver,
  pickNsisAsset,
  resolveAppVersion,
  summarizeReleaseNotes,
} from "./appVersion";
export type {
  DesktopUpdateProgress,
  DesktopUpdateResult,
} from "./desktopUpdater";
export {
  checkDesktopUpdater,
  installDesktopUpdateAndRelaunch,
} from "./desktopUpdater";
