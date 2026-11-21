export type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
export { DEFAULT_BAUD } from "./transport";

export type {
  Axis,
  GrblMachineState,
  GrblStatus,
  Position3,
} from "./types";
export { OFFLINE_STATUS, ZERO_POSITION } from "./types";

export { parseStatusReport } from "./parseStatus";
export { createGrblClient } from "./client";

export type { SoftTravelLimits } from "./machineConfig";
export {
  DEFAULT_SOFT_TRAVEL,
  bedSizeFromLimits,
  maxForAxis,
  minForAxis,
} from "./machineConfig";

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

export type { GcodeStreamer, StreamPhase, StreamProgress } from "./streamer";
export { GRBL_RX_BUFFER, createGcodeStreamer } from "./streamer";
