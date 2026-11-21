/** Shared GRBL status / position types used by desktop and browser shells. */

export type Axis = "X" | "Y" | "Z";

export interface Position3 {
  x: number;
  y: number;
  z: number;
}

export type GrblMachineState =
  | "Idle"
  | "Run"
  | "Hold"
  | "Jog"
  | "Alarm"
  | "Door"
  | "Check"
  | "Home"
  | "Sleep"
  | "Offline"
  | "Unknown";

/** Parsed subset of a GRBL real-time status report (`?` response). */
export interface GrblStatus {
  state: GrblMachineState;
  /** Machine coordinates (MPos), millimeters. */
  machine: Position3;
  /** Work coordinates (WPos), millimeters. */
  work: Position3;
  /**
   * Work coordinate offset (WCO = MPos − WPos) when known.
   * GRBL only includes `WCO:` periodically; clients should retain the last value.
   */
  wco?: Position3;
  /** Feed rate when reported (mm/min). */
  feedRate?: number;
  /** Spindle speed when reported (RPM). */
  spindleSpeed?: number;
  raw?: string;
}

export const ZERO_POSITION: Position3 = { x: 0, y: 0, z: 0 };

export const OFFLINE_STATUS: GrblStatus = {
  state: "Offline",
  machine: { ...ZERO_POSITION },
  work: { ...ZERO_POSITION },
};
