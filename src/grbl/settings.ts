import type { SoftTravelLimits } from "./machineConfig";
import type { Axis, GrblMachineState } from "./types";

/** GRBL setting IDs used by SharpCNC calibration / soft travel. */
export const SETTING_DIR_PORT_INVERT = 3;
export const SETTING_STEPS_X = 100;
export const SETTING_STEPS_Y = 101;
export const SETTING_STEPS_Z = 102;
export const SETTING_MAX_TRAVEL_X = 130;
export const SETTING_MAX_TRAVEL_Y = 131;
export const SETTING_MAX_TRAVEL_Z = 132;
export const SETTING_SOFT_LIMITS = 20;

/** Default GRBL 1.1-ish values used by the mock and as UI placeholders. */
export const DEFAULT_GRBL_SETTINGS: Record<number, number> = {
  0: 10,
  1: 25,
  2: 0,
  3: 0, // direction port invert mask (bit0=X, bit1=Y, bit2=Z)
  10: 1,
  11: 0.01,
  12: 0.002,
  13: 0,
  20: 0, // soft limits off until calibrated
  21: 0,
  22: 0,
  23: 0,
  24: 25,
  25: 500,
  26: 250,
  27: 1,
  30: 1000,
  31: 0,
  32: 0,
  100: 250,
  101: 250,
  102: 250,
  110: 500,
  111: 500,
  112: 500,
  120: 10,
  121: 10,
  122: 10,
  130: 1000,
  131: 1000,
  132: 200,
};

export const STEPS_SETTING_FOR_AXIS: Record<Axis, number> = {
  X: SETTING_STEPS_X,
  Y: SETTING_STEPS_Y,
  Z: SETTING_STEPS_Z,
};

export const MAX_TRAVEL_SETTING_FOR_AXIS: Record<Axis, number> = {
  X: SETTING_MAX_TRAVEL_X,
  Y: SETTING_MAX_TRAVEL_Y,
  Z: SETTING_MAX_TRAVEL_Z,
};

/** Short labels for common settings shown in the editor. */
export const SETTING_LABELS: Record<number, string> = {
  3: "Direction invert mask",
  20: "Soft limits enable",
  21: "Hard limits enable",
  22: "Homing cycle enable",
  100: "X steps/mm",
  101: "Y steps/mm",
  102: "Z steps/mm",
  110: "X max rate (mm/min)",
  111: "Y max rate (mm/min)",
  112: "Z max rate (mm/min)",
  120: "X accel (mm/sec²)",
  121: "Y accel (mm/sec²)",
  122: "Z accel (mm/sec²)",
  130: "X max travel (mm)",
  131: "Y max travel (mm)",
  132: "Z max travel (mm)",
};

/** Per-axis direction invert flags encoded in GRBL `$3`. */
export interface AxisDirInvert {
  x: boolean;
  y: boolean;
  z: boolean;
}

/** Bit masks for `$3` (GRBL direction port invert). */
export const DIR_INVERT_BIT: Record<Axis, number> = {
  X: 1 << 0,
  Y: 1 << 1,
  Z: 1 << 2,
};

/** Short calibration test jog distance for verifying axis direction. */
export const DIR_TEST_JOG_MM = 5;

/** Decode `$3` bitmask into X/Y/Z invert toggles (only bits 0–2). */
export function decodeDirInvertMask(mask: number): AxisDirInvert {
  const m = (Number.isFinite(mask) ? Math.trunc(mask) : 0) & 0b111;
  return {
    x: (m & DIR_INVERT_BIT.X) !== 0,
    y: (m & DIR_INVERT_BIT.Y) !== 0,
    z: (m & DIR_INVERT_BIT.Z) !== 0,
  };
}

/** Encode X/Y/Z invert toggles into a `$3` bitmask (0–7). */
export function encodeDirInvertMask(flags: AxisDirInvert): number {
  return (
    (flags.x ? DIR_INVERT_BIT.X : 0) |
    (flags.y ? DIR_INVERT_BIT.Y : 0) |
    (flags.z ? DIR_INVERT_BIT.Z : 0)
  );
}

/** Human-readable summary of a `$3` mask, e.g. `X+Y` or `none`. */
export function describeDirInvertMask(mask: number): string {
  const flags = decodeDirInvertMask(mask);
  const parts: string[] = [];
  if (flags.x) parts.push("X");
  if (flags.y) parts.push("Y");
  if (flags.z) parts.push("Z");
  return parts.length > 0 ? parts.join("+") : "none";
}

export interface GrblSetting {
  id: number;
  value: number;
  /** Original dump text after `=` when available. */
  raw?: string;
}

/** Parse one `$$` dump line: `$100=250.000` */
export function parseSettingLine(line: string): GrblSetting | null {
  const m = /^\$(\d+)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/.exec(line.trim());
  if (!m) return null;
  const id = Number(m[1]);
  const value = Number(m[2]);
  if (!Number.isFinite(id) || !Number.isFinite(value)) return null;
  return { id, value, raw: m[2] };
}

/** Parse a full `$$` dump into a map. Ignores non-setting lines. */
export function parseSettingsDump(lines: string[]): Map<number, GrblSetting> {
  const map = new Map<number, GrblSetting>();
  for (const line of lines) {
    const parsed = parseSettingLine(line);
    if (parsed) map.set(parsed.id, parsed);
  }
  return map;
}

/** Format a setting write: `$100=250.000` */
export function formatSettingWrite(id: number, value: number): string {
  if (!Number.isInteger(id) || id < 0) {
    throw new Error(`Invalid setting id: ${id}`);
  }
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid setting value: ${value}`);
  }
  // GRBL accepts integers or decimals; keep up to 3 decimals for steps/mm.
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/\.?0+$/, "") || "0";
  return `$${id}=${formatted}`;
}

/**
 * Recompute steps/mm after a calibration move.
 * If the controller commanded `commandedMm` but the ruler reads `measuredMm`,
 * newSteps = oldSteps × (commanded / measured).
 */
export function computeStepsPerMm(
  oldSteps: number,
  commandedMm: number,
  measuredMm: number,
): number {
  if (!Number.isFinite(oldSteps) || oldSteps <= 0) {
    throw new Error("Current steps/mm must be a positive number.");
  }
  if (!Number.isFinite(commandedMm) || commandedMm === 0) {
    throw new Error("Commanded distance must be non-zero.");
  }
  if (!Number.isFinite(measuredMm) || measuredMm === 0) {
    throw new Error("Measured distance must be non-zero.");
  }
  return oldSteps * (commandedMm / measuredMm);
}

export function roundStepsPerMm(value: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Soft-limits enable value: 1 = on, 0 = off. */
export function softLimitsEnabled(settings: Map<number, GrblSetting>): boolean {
  return (settings.get(SETTING_SOFT_LIMITS)?.value ?? 0) !== 0;
}

/** Build soft-travel app state from GRBL $130–$132 (null when unset / zero). */
export function softTravelFromSettings(
  settings: Map<number, GrblSetting>,
  previous: SoftTravelLimits,
): SoftTravelLimits {
  const read = (id: number): number | null => {
    const v = settings.get(id)?.value;
    if (v === undefined || !Number.isFinite(v) || v <= 0) return null;
    return v;
  };
  return {
    maxX: read(SETTING_MAX_TRAVEL_X) ?? previous.maxX,
    maxY: read(SETTING_MAX_TRAVEL_Y) ?? previous.maxY,
    maxZ: read(SETTING_MAX_TRAVEL_Z) ?? previous.maxZ,
    min: { ...previous.min },
  };
}

/** Writes needed to push soft travel + enable $20 into GRBL. */
export function softTravelWriteCommands(
  limits: SoftTravelLimits,
  enableSoftLimits = true,
): string[] {
  const cmds: string[] = [];
  if (limits.maxX !== null && limits.maxX > 0) {
    cmds.push(formatSettingWrite(SETTING_MAX_TRAVEL_X, limits.maxX));
  }
  if (limits.maxY !== null && limits.maxY > 0) {
    cmds.push(formatSettingWrite(SETTING_MAX_TRAVEL_Y, limits.maxY));
  }
  if (limits.maxZ !== null && limits.maxZ > 0) {
    cmds.push(formatSettingWrite(SETTING_MAX_TRAVEL_Z, limits.maxZ));
  }
  if (enableSoftLimits) {
    cmds.push(formatSettingWrite(SETTING_SOFT_LIMITS, 1));
  }
  return cmds;
}

/**
 * Gate for reading/writing GRBL EEPROM settings.
 * Never allow while a job is streaming or the machine is mid-motion.
 */
export function canWriteSettings(
  state: GrblMachineState,
  connected: boolean,
  streaming: boolean,
): { ok: boolean; reason?: string } {
  if (!connected) return { ok: false, reason: "Connect first." };
  if (streaming) {
    return { ok: false, reason: "Stop the job before changing settings." };
  }
  if (state === "Alarm") {
    return { ok: false, reason: "Alarm lock — unlock before writing settings." };
  }
  if (state === "Hold") {
    return { ok: false, reason: "Feed hold active — resume or reset first." };
  }
  if (state === "Offline") return { ok: false, reason: "Machine offline." };
  if (state === "Run" || state === "Jog" || state === "Home") {
    return { ok: false, reason: `Busy (${state}) — wait for Idle.` };
  }
  return { ok: true };
}

/** Suggested calibration move distances (mm). */
export const CALIBRATION_DISTANCE_OPTIONS_MM = [50, 100, 200] as const;
export const DEFAULT_CALIBRATION_DISTANCE_MM = 100;
