import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import type { SoftLimitCheck } from "./jog";
import type { GrblMachineState, Position3 } from "./types";

/** Unlock alarm lock (GRBL `$X`). */
export const UNLOCK_COMMAND = "$X";

/** Well-known GRBL alarm codes → short description. */
const ALARM_MESSAGES: Record<number, string> = {
  1: "Hard limit triggered",
  2: "Soft limit / motion exceeded travel",
  3: "Reset while in motion",
  4: "Probe fail (no contact)",
  5: "Probe fail (contact early)",
  6: "Homing fail (reset during home)",
  7: "Homing fail (door / safety door)",
  8: "Homing fail (pull-off)",
  9: "Homing fail (not found)",
};

export interface ParsedAlarm {
  code: number | null;
  message: string;
  raw: string;
}

/** Parse `ALARM:1` / `error: Alarm lock` style lines. */
export function parseAlarmLine(line: string): ParsedAlarm | null {
  const trimmed = line.trim();
  const alarm = /^ALARM:\s*(\d+)/i.exec(trimmed);
  if (alarm) {
    const code = Number(alarm[1]);
    const known = Number.isFinite(code) ? ALARM_MESSAGES[code] : undefined;
    return {
      code: Number.isFinite(code) ? code : null,
      message: known
        ? `ALARM:${code} — ${known}`
        : `ALARM:${alarm[1]}`,
      raw: trimmed,
    };
  }
  if (/^error:\s*Alarm/i.test(trimmed)) {
    return {
      code: null,
      message: "Alarm lock — unlock ($X) before motion",
      raw: trimmed,
    };
  }
  return null;
}

export function canJogOrZero(
  state: GrblMachineState,
  connected: boolean,
  streaming: boolean,
): { ok: boolean; reason?: string } {
  if (!connected) return { ok: false, reason: "Connect first." };
  if (streaming) return { ok: false, reason: "Stop the job first." };
  if (state === "Alarm") {
    return { ok: false, reason: "Alarm lock — unlock before jogging." };
  }
  if (state === "Hold") {
    return { ok: false, reason: "Feed hold active — resume or reset first." };
  }
  if (state === "Offline") return { ok: false, reason: "Machine offline." };
  if (state === "Run" || state === "Home") {
    return { ok: false, reason: `Busy (${state}).` };
  }
  return { ok: true };
}

/**
 * Check whether a job's work-coordinate XY bounds fit within soft travel,
 * given the current WCO (machine = work + WCO).
 */
export function checkJobSoftLimits(
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
  wco: Position3,
  limits: SoftTravelLimits,
): SoftLimitCheck {
  if (!bounds) {
    return {
      ok: true,
      targetMachine: { x: wco.x, y: wco.y, z: wco.z },
    };
  }

  const corners: Position3[] = [
    { x: bounds.minX + wco.x, y: bounds.minY + wco.y, z: wco.z },
    { x: bounds.minX + wco.x, y: bounds.maxY + wco.y, z: wco.z },
    { x: bounds.maxX + wco.x, y: bounds.minY + wco.y, z: wco.z },
    { x: bounds.maxX + wco.x, y: bounds.maxY + wco.y, z: wco.z },
  ];

  for (const corner of corners) {
    for (const axis of ["X", "Y"] as const) {
      const key = axis.toLowerCase() as "x" | "y";
      const min = minForAxis(limits, axis);
      const max = maxForAxis(limits, axis);
      const v = corner[key];
      if (v < min - 1e-6) {
        return {
          ok: false,
          reason: `Job ${axis} would go below soft min (${min} mm) in machine coords`,
          targetMachine: corner,
        };
      }
      if (max !== null && v > max + 1e-6) {
        return {
          ok: false,
          reason: `Job ${axis} would exceed soft max (${max} mm) in machine coords`,
          targetMachine: corner,
        };
      }
    }
  }

  return {
    ok: true,
    targetMachine: corners[0],
  };
}
