import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import type { SoftLimitCheck } from "./jog";
import { ESTOP_LATCHED_REASON, type GrblMachineState, type Position3 } from "./types";

/** Unlock alarm lock (GRBL `$X`). */
export const UNLOCK_COMMAND = "$X";

/** Well-known GRBL alarm codes → short description. */
const ALARM_MESSAGES: Record<number, string> = {
  1: "Hard limit triggered",
  2: "Soft limit / motion exceeded travel",
  3: "Reset while in motion",
  4: "Probe fail (already touching at start)",
  5: "Probe fail (no contact)",
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
  if (state === "EStopLatched") return { ok: false, reason: ESTOP_LATCHED_REASON };
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
 * Check whether a job fits within soft travel, given the current WCO
 * (machine = work + WCO). XY uses the job's bounds (arcs included); Z uses the
 * job's Z range, so a clearance retract above Z home or a cut deeper than Z
 * travel is caught before Start instead of as ALARM:2 mid-job.
 */
export function checkJobSoftLimits(
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null,
  wco: Position3,
  limits: SoftTravelLimits,
  zRange?: { minZ: number; maxZ: number } | null,
): SoftLimitCheck {
  const fmtMm = (v: number) => `${Math.abs(v).toFixed(1)} mm`;

  if (bounds) {
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
            reason: `Job ${axis} goes ${fmtMm(min - v)} past the home side of travel. Move the material origin or the stock.`,
            targetMachine: corner,
          };
        }
        if (max !== null && v > max + 1e-6) {
          return {
            ok: false,
            reason: `Job ${axis} goes ${fmtMm(v - max)} past the far end of travel. Move the material origin or the stock.`,
            targetMachine: corner,
          };
        }
      }
    }
  }

  if (zRange) {
    const topZ = maxForAxis(limits, "Z");
    const bottomZ = minForAxis(limits, "Z");
    const highest = zRange.maxZ + wco.z;
    const lowest = zRange.minZ + wco.z;
    if (topZ !== null && highest > topZ + 1e-6) {
      return {
        ok: false,
        reason: `The job lifts Z to ${zRange.maxZ.toFixed(1)} mm above material zero, which is ${fmtMm(highest - topZ)} above Z home (top of travel). Lower the job's clearance/safe height, or raise the spindle so material zero sits lower in Z travel.`,
        targetMachine: { x: wco.x, y: wco.y, z: highest },
      };
    }
    if (Number.isFinite(bottomZ) && lowest < bottomZ - 1e-6) {
      return {
        ok: false,
        reason: `The job cuts to ${zRange.minZ.toFixed(1)} mm, which is ${fmtMm(bottomZ - lowest)} below the bottom of Z travel. Check the cut depth and the Z zero.`,
        targetMachine: { x: wco.x, y: wco.y, z: lowest },
      };
    }
  }

  return {
    ok: true,
    targetMachine: bounds
      ? { x: bounds.minX + wco.x, y: bounds.minY + wco.y, z: wco.z }
      : { x: wco.x, y: wco.y, z: wco.z },
  };
}
