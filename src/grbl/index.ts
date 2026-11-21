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

export type { StockConfig, StockCorner } from "./stockConfig";
export {
  DEFAULT_STOCK,
  loadStock,
  saveStock,
  stockOffsetForCorner,
} from "./stockConfig";

export type { ToolBitType, ToolConfig } from "./toolConfig";
export {
  DEFAULT_TOOL,
  TOOL_BIT_LABELS,
  loadTool,
  saveTool,
} from "./toolConfig";

export type { GrblSetting } from "./settings";
export {
  CALIBRATION_DISTANCE_OPTIONS_MM,
  DEFAULT_CALIBRATION_DISTANCE_MM,
  DEFAULT_GRBL_SETTINGS,
  MAX_TRAVEL_SETTING_FOR_AXIS,
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

export type { GoToWorkZeroOptions, GoToWorkZeroPlan, ZeroAxisSelection } from "./workZero";
export {
  DEFAULT_WCS_P,
  buildSetWorkZeroCommand,
  planGoToWorkZero,
} from "./workZero";

export type { DesktopPortInfo } from "./desktopSerial";
export {
  createDesktopGrblClient,
  createDesktopTransport,
  listDesktopPorts,
} from "./desktopSerial";

export {
  createMockGrblClient,
  createMockTransport,
  listMockPorts,
} from "./mockSerial";

export { createWebGrblClient, createWebSerialTransport } from "./webSerial";

export { createSessionClient, listAvailablePorts, isDesktopShell } from "./session";

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

export type { PathSimSnapshot, SimPhase, SimSpeeds } from "./pathSimulation";
export {
  SIM_FEED_MM_S,
  SIM_RAPID_MM_S,
  advanceSim,
  createIdleSim,
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

export type { OverrideStep } from "./spindleFeed";
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
  SPINDLE_OVERRIDE_COARSE_MINUS,
  SPINDLE_OVERRIDE_COARSE_PLUS,
  SPINDLE_OVERRIDE_FINE_MINUS,
  SPINDLE_OVERRIDE_FINE_PLUS,
  SPINDLE_OVERRIDE_MAX,
  SPINDLE_OVERRIDE_MIN,
  SPINDLE_OVERRIDE_RESET,
  applyOverrideStep,
  buildSpindleOffCommand,
  buildSpindleOnCommand,
  buildSpindleSpeedCommand,
  feedOverrideByte,
  spindleOverrideByte,
} from "./spindleFeed";

export type { GcodeStreamer, StreamPhase, StreamProgress } from "./streamer";
export { GRBL_RX_BUFFER, createGcodeStreamer } from "./streamer";

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

export type { JobsFolderConfig } from "./jobsFolderConfig";
export {
  DEFAULT_JOBS_FOLDER,
  JOBS_FOLDER_POLL_MS,
  loadJobsFolderConfig,
  saveJobsFolderConfig,
  shortFolderLabel,
} from "./jobsFolderConfig";

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
