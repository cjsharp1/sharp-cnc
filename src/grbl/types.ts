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
  | "Unknown"
  /**
   * App-only: SharpCNC's E-Stop latch. Never reported by GRBL; motion gates
   * treat it as locked until the operator clears it.
   */
  | "EStopLatched";

/** Plain-English reason shown wherever the E-Stop latch blocks motion. */
export const ESTOP_LATCHED_REASON =
  "E-Stop latched — check the machine, then click Clear E-Stop in the Safety panel.";

/**
 * Active pins from a GRBL `Pn:` status field.
 * Control letters used by Demon Shield: S=cycle start, H=feed hold, R=reset.
 */
export interface GrblActivePins {
  cycleStart: boolean;
  feedHold: boolean;
  reset: boolean;
  door: boolean;
  /** Probe input active (`P` in `Pn:`). */
  probe: boolean;
  /** Raw letters after `Pn:` (may also include XYZ limits / P probe). */
  raw: string;
}

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
  /**
   * Runtime override percents from `Ov:feed,rapid,spindle` when GRBL reports them.
   * Clients may also track local estimates from override keystrokes.
   */
  overrides?: {
    feed: number;
    rapid: number;
    spindle: number;
  };
  /**
   * Active input pins from `Pn:` (limits, probe, control). Present when GRBL
   * reports any triggered pin; cleared when the field is omitted.
   */
  pins?: GrblActivePins;
  raw?: string;
}

export const ZERO_POSITION: Position3 = { x: 0, y: 0, z: 0 };

export const OFFLINE_STATUS: GrblStatus = {
  state: "Offline",
  machine: { ...ZERO_POSITION },
  work: { ...ZERO_POSITION },
};
