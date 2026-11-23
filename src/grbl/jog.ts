import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import type { Axis, Position3 } from "./types";

/** Real-time jog cancel byte (GRBL 1.1). */
export const JOG_CANCEL_BYTE = 0x85;

export const JOG_STEP_OPTIONS_MM = [0.1, 1, 10, 50] as const;

/** Conservative jog feeds (mm/min). Cap keeps accidental full-speed crashes unlikely. */
export const JOG_FEED_OPTIONS_MM_MIN = [200, 500, 1000, 2000] as const;
export const DEFAULT_JOG_FEED_MM_MIN = 500;
export const MAX_JOG_FEED_MM_MIN = 3000;

export type JogMode = "incremental" | "continuous";

export interface JogDelta {
  x?: number;
  y?: number;
  z?: number;
}

export interface SoftLimitCheck {
  ok: boolean;
  /** Human-readable reason when blocked. */
  reason?: string;
  /** Target machine position after the jog (clamped view of intent). */
  targetMachine: Position3;
}

function fmt(n: number): string {
  // Trim trailing zeros but keep enough precision for 0.1 mm steps.
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

/**
 * Build a GRBL jog command (`$J=`). Always G21 (mm) + G91 (incremental).
 * Example: `$J=G91 G21 X10 F500`
 */
export function buildJogCommand(
  delta: JogDelta,
  feedMmMin: number,
): string {
  const feed = Math.min(
    Math.max(1, Math.round(feedMmMin)),
    MAX_JOG_FEED_MM_MIN,
  );
  const parts: string[] = ["$J=G91", "G21"];
  if (delta.x !== undefined && delta.x !== 0) parts.push(`X${fmt(delta.x)}`);
  if (delta.y !== undefined && delta.y !== 0) parts.push(`Y${fmt(delta.y)}`);
  if (delta.z !== undefined && delta.z !== 0) parts.push(`Z${fmt(delta.z)}`);
  parts.push(`F${feed}`);
  return parts.join(" ");
}

/**
 * Continuous jog uses a short incremental burst each press/hold tick.
 * Distance scales with feed so motion feels responsive without huge overshoot.
 */
export function continuousJogDelta(
  axes: Partial<Record<Axis, 1 | -1>>,
  feedMmMin: number,
  durationSec = 0.2,
): JogDelta {
  const dist = Math.max(0.05, (feedMmMin / 60) * durationSec);
  const delta: JogDelta = {};
  if (axes.X) delta.x = axes.X * dist;
  if (axes.Y) delta.y = axes.Y * dist;
  if (axes.Z) delta.z = axes.Z * dist;
  return delta;
}

/**
 * Soft-limit check against known machine travel.
 * Axes with unknown max travel are not blocked (calibration UI comes later).
 */
export function checkSoftLimits(
  machine: Position3,
  delta: JogDelta,
  limits: SoftTravelLimits,
): SoftLimitCheck {
  const target: Position3 = {
    x: machine.x + (delta.x ?? 0),
    y: machine.y + (delta.y ?? 0),
    z: machine.z + (delta.z ?? 0),
  };

  const axes: Axis[] = ["X", "Y", "Z"];
  for (const axis of axes) {
    const key = axis.toLowerCase() as keyof Position3;
    const d = delta[key];
    if (d === undefined || d === 0) continue;

    const min = minForAxis(limits, axis);
    const max = maxForAxis(limits, axis);
    const next = target[key];

    if (next < min - 1e-6) {
      return {
        ok: false,
        reason: `${axis} would go below soft min (${min} mm)`,
        targetMachine: target,
      };
    }
    if (max !== null && next > max + 1e-6) {
      return {
        ok: false,
        reason: `${axis} would exceed soft max (${max} mm)`,
        targetMachine: target,
      };
    }
  }

  return { ok: true, targetMachine: target };
}

export interface SoftLimitClamp {
  /** Delta after clamping into soft travel (axes may be dropped if already at limit). */
  delta: JogDelta;
  /** True when any axis was shortened or dropped to stay inside limits. */
  clamped: boolean;
  /** Human-readable hint when motion was limited or fully blocked. */
  reason?: string;
  /** Target machine position after applying the clamped delta. */
  targetMachine: Position3;
}

function jogDeltaIsEmpty(delta: JogDelta): boolean {
  return (
    (delta.x === undefined || delta.x === 0) &&
    (delta.y === undefined || delta.y === 0) &&
    (delta.z === undefined || delta.z === 0)
  );
}

/**
 * Clamp a jog delta so the resulting machine position stays in soft travel
 * [min, max] per axis (max may be unknown → that side is not clipped).
 *
 * Used by every jog source (UI pad, keyboard hold, Xbox/gamepad) so continuous
 * bursts cannot command past 0 or past max even when MPos status lags.
 */
export function clampJogDelta(
  machine: Position3,
  delta: JogDelta,
  limits: SoftTravelLimits,
): SoftLimitClamp {
  const out: JogDelta = {};
  let clamped = false;
  let reason: string | undefined;
  const axes: Axis[] = ["X", "Y", "Z"];

  for (const axis of axes) {
    const key = axis.toLowerCase() as keyof Position3;
    const d = delta[key];
    if (d === undefined || d === 0) continue;

    const min = minForAxis(limits, axis);
    const max = maxForAxis(limits, axis);
    const start = machine[key];
    let next = start + d;

    if (next < min - 1e-9) {
      next = min;
      clamped = true;
      reason = `${axis} soft min (${min} mm)`;
    }
    if (max !== null && next > max + 1e-9) {
      next = max;
      clamped = true;
      reason = `${axis} soft max (${max} mm)`;
    }

    const clampedD = next - start;
    if (Math.abs(clampedD) > 1e-6) {
      out[key] = clampedD;
    } else if (Math.abs(d) > 1e-6) {
      clamped = true;
      if (!reason) reason = `${axis} at soft limit`;
    }
  }

  const targetMachine: Position3 = {
    x: machine.x + (out.x ?? 0),
    y: machine.y + (out.y ?? 0),
    z: machine.z + (out.z ?? 0),
  };

  if (jogDeltaIsEmpty(out) && !jogDeltaIsEmpty(delta) && !reason) {
    reason = "At soft limit";
    clamped = true;
  }

  return { delta: out, clamped, reason, targetMachine };
}

export function jogDeltaFromAxes(
  axes: Partial<Record<Axis, 1 | -1>>,
  stepMm: number,
): JogDelta {
  const delta: JogDelta = {};
  if (axes.X) delta.x = axes.X * stepMm;
  if (axes.Y) delta.y = axes.Y * stepMm;
  if (axes.Z) delta.z = axes.Z * stepMm;
  return delta;
}
