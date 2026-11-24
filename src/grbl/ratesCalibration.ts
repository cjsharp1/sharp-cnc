/**
 * Max rate ($110–$112) and acceleration ($120–$122) calibration helpers (PR 3).
 *
 * Trial values are written temporarily so GRBL's feed ceiling matches the test.
 * Originals are restored on cancel / leave / disconnect (pending restore in
 * localStorage) until the operator accepts a recommendation.
 */

import { maxForAxis, minForAxis, type SoftTravelLimits } from "./machineConfig";
import {
  ACCEL_SETTING_FOR_AXIS,
  RATE_SETTING_FOR_AXIS,
} from "./settings";
import type { Axis, Position3 } from "./types";

export { ACCEL_SETTING_FOR_AXIS, RATE_SETTING_FOR_AXIS } from "./settings";

/** Default out-and-back distance (mm). */
export const RATES_DEFAULT_DISTANCE_XY_MM = 50;
export const RATES_DEFAULT_DISTANCE_Z_MM = 15;

/** Default cycle counts (one cycle = out + back). */
export const RATES_DEFAULT_CYCLES_XY = 10;
export const RATES_DEFAULT_CYCLES_Z = 20;

/** Ramp multiplier after a passing trial. */
export const RATES_RAMP_FACTOR = 1.2;

/** Recommended safety factor on the last passing value (slider 0.7–0.8). */
export const RATES_RECOMMEND_DEFAULT = 0.75;
export const RATES_RECOMMEND_MIN = 0.7;
export const RATES_RECOMMEND_MAX = 0.8;

/** Hard ceiling: trial value cannot exceed this × the pre-test baseline. */
export const RATES_TRIAL_CEILING_MULT = 2;

/** localStorage: abandoned temp writes to restore on next connect. */
export const RATES_PENDING_RESTORE_KEY = "sharpcnc.ratesPendingRestore.v1";

/** One-time banner for profiles already marked calibrated. */
export const CAL_NEW_STEPS_BANNER_KEY = "sharpcnc.calNewStepsBanner.v1";

export type RatesKind = "rate" | "accel";

export type RatesTrialResult = "pass" | "off" | "stall";

export interface RatesPendingRestoreEntry {
  id: number;
  value: number;
}

export interface RatesPendingRestore {
  entries: RatesPendingRestoreEntry[];
  savedAt: number;
}

export function defaultRatesDistanceMm(axis: Axis): number {
  return axis === "Z" ? RATES_DEFAULT_DISTANCE_Z_MM : RATES_DEFAULT_DISTANCE_XY_MM;
}

export function defaultRatesCycles(axis: Axis): number {
  return axis === "Z" ? RATES_DEFAULT_CYCLES_Z : RATES_DEFAULT_CYCLES_XY;
}

/** Setting id for the active kind + axis. */
export function ratesSettingId(kind: RatesKind, axis: Axis): number {
  return kind === "rate" ? RATE_SETTING_FOR_AXIS[axis] : ACCEL_SETTING_FOR_AXIS[axis];
}

/** Plain-language label for the setting (GRBL code secondary). */
export function ratesSettingPlainLabel(kind: RatesKind, axis: Axis): string {
  return kind === "rate"
    ? `How fast ${axis} can move`
    : `How quickly ${axis} speeds up`;
}

export function ratesSettingUnit(kind: RatesKind): string {
  return kind === "rate" ? "mm/min" : "mm/sec²";
}

/** Outbound signed delta: X/Y +, Z down (−). */
export function ratesOutDeltaMm(axis: Axis, distanceMm: number): number {
  const d = Math.abs(distanceMm);
  return axis === "Z" ? -d : d;
}

/** Hard ceiling for a trial ramp from a baseline value. */
export function ratesTrialCeiling(baseline: number): number {
  if (!Number.isFinite(baseline) || baseline <= 0) return 0;
  return baseline * RATES_TRIAL_CEILING_MULT;
}

/**
 * Next ramp trial (+20%), or null when already at/above the 2× ceiling.
 * Rounds rates to whole numbers; accel to 1 decimal when needed.
 */
export function nextRatesTrialValue(
  currentTrial: number,
  ceiling: number,
  kind: RatesKind,
): number | null {
  if (!Number.isFinite(currentTrial) || currentTrial <= 0) return null;
  if (!Number.isFinite(ceiling) || ceiling <= 0) return null;
  const raw = currentTrial * RATES_RAMP_FACTOR;
  const next =
    kind === "rate" ? Math.round(raw) : Math.round(raw * 10) / 10;
  if (next > ceiling + 1e-9) return null;
  if (next <= currentTrial + 1e-9) return null;
  return next;
}

/** lastPassing × factor, clamped to slider range semantics (factor already 0.7–0.8). */
export function recommendRatesValue(
  lastPassing: number,
  factor: number,
  kind: RatesKind,
): number {
  const f = Math.min(
    RATES_RECOMMEND_MAX,
    Math.max(RATES_RECOMMEND_MIN, factor),
  );
  const raw = lastPassing * f;
  return kind === "rate" ? Math.round(raw) : Math.round(raw * 10) / 10;
}

/**
 * Guard: out-and-back must fit inside soft travel from the current machine pos.
 * Uses PR 0 range helpers (Z ∈ [−$132, 0]).
 */
export function canFitRatesTest(
  machine: Position3,
  limits: SoftTravelLimits,
  axis: Axis,
  distanceMm: number,
): { ok: boolean; reason?: string } {
  if (!Number.isFinite(distanceMm) || distanceMm <= 0) {
    return { ok: false, reason: "Test distance must be a positive number of millimeters." };
  }
  const key = axis.toLowerCase() as "x" | "y" | "z";
  const start = machine[key];
  const out = ratesOutDeltaMm(axis, distanceMm);
  const end = start + out;
  const min = minForAxis(limits, axis);
  const max = maxForAxis(limits, axis);

  if (end < min - 1e-6) {
    return {
      ok: false,
      reason: `${axis} test would go past soft travel (need ${Math.abs(out).toFixed(1)} mm room toward the ${axis === "Z" ? "bottom" : "home side"}).`,
    };
  }
  if (max !== null && end > max + 1e-6) {
    return {
      ok: false,
      reason: `${axis} test would go past soft travel (need ${Math.abs(out).toFixed(1)} mm room toward the ${axis === "Z" ? "top" : "far end"}).`,
    };
  }
  // Back returns to start — already inside if start is inside.
  if (start < min - 1e-6 || (max !== null && start > max + 1e-6)) {
    return {
      ok: false,
      reason: `${axis} is already outside soft travel — home / jog back first.`,
    };
  }
  return { ok: true };
}

/**
 * Queued G1 out-and-back sequence (planner uses full accel — not `$J=`).
 * Z starts with a down move. Ends with G90.
 */
export function buildRatesTrialLines(
  axis: Axis,
  distanceMm: number,
  cycles: number,
  feedMmMin: number,
): string[] {
  if (!Number.isFinite(distanceMm) || distanceMm <= 0) {
    throw new Error("Test distance must be positive.");
  }
  if (!Number.isInteger(cycles) || cycles < 1) {
    throw new Error("Cycle count must be a positive integer.");
  }
  if (!Number.isFinite(feedMmMin) || feedMmMin <= 0) {
    throw new Error("Feed must be positive.");
  }
  const out = ratesOutDeltaMm(axis, distanceMm);
  const back = -out;
  const fmt = (n: number) => {
    const t = Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
    return t;
  };
  const feed = fmt(feedMmMin);
  const lines: string[] = ["G21", "G91"];
  for (let i = 0; i < cycles; i++) {
    lines.push(`G1 ${axis}${fmt(out)} F${feed}`);
    lines.push(`G1 ${axis}${fmt(back)} F${feed}`);
  }
  lines.push("G90");
  return lines;
}

/** First motion line's signed delta (for soft-limit precheck / Z down-first asserts). */
export function ratesFirstMotionDelta(
  axis: Axis,
  distanceMm: number,
): { axis: Axis; delta: number } {
  return { axis, delta: ratesOutDeltaMm(axis, distanceMm) };
}

export function loadPendingRatesRestore(): RatesPendingRestore | null {
  try {
    const raw = localStorage.getItem(RATES_PENDING_RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RatesPendingRestore>;
    if (!Array.isArray(parsed.entries) || parsed.entries.length === 0) {
      return null;
    }
    const entries: RatesPendingRestoreEntry[] = [];
    for (const e of parsed.entries) {
      if (
        e &&
        typeof e.id === "number" &&
        Number.isInteger(e.id) &&
        typeof e.value === "number" &&
        Number.isFinite(e.value)
      ) {
        entries.push({ id: e.id, value: e.value });
      }
    }
    if (entries.length === 0) return null;
    return {
      entries,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function savePendingRatesRestore(
  entries: readonly RatesPendingRestoreEntry[],
): void {
  if (entries.length === 0) {
    clearPendingRatesRestore();
    return;
  }
  const payload: RatesPendingRestore = {
    entries: entries.map((e) => ({ id: e.id, value: e.value })),
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(RATES_PENDING_RESTORE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

export function clearPendingRatesRestore(): void {
  try {
    localStorage.removeItem(RATES_PENDING_RESTORE_KEY);
  } catch {
    /* ignore */
  }
}

/** Merge/overwrite pending entries by setting id. */
export function mergePendingRatesRestore(
  existing: readonly RatesPendingRestoreEntry[],
  patch: readonly RatesPendingRestoreEntry[],
): RatesPendingRestoreEntry[] {
  const map = new Map<number, number>();
  for (const e of existing) map.set(e.id, e.value);
  for (const e of patch) {
    // First write for an id keeps the original baseline (do not overwrite).
    if (!map.has(e.id)) map.set(e.id, e.value);
  }
  return [...map.entries()].map(([id, value]) => ({ id, value }));
}

export function loadCalNewStepsBannerDismissed(): boolean {
  try {
    return localStorage.getItem(CAL_NEW_STEPS_BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveCalNewStepsBannerDismissed(): void {
  try {
    localStorage.setItem(CAL_NEW_STEPS_BANNER_KEY, "1");
  } catch {
    /* ignore */
  }
}
