/**
 * Homing setup helpers for Calibrate (PR 4): limit invert ($5), homing
 * direction ($23), seek/feed/pull-off suggestions, switch-check tracking.
 */

import {
  SETTING_HOMING_CYCLE,
  SETTING_HOMING_DIR_MASK,
  SETTING_HOMING_FEED,
  SETTING_HOMING_PULLOFF,
  SETTING_HOMING_SEEK,
  SETTING_LIMIT_INVERT,
} from "./settings";
import type { Axis } from "./types";

export {
  SETTING_HOMING_CYCLE,
  SETTING_HOMING_DIR_MASK,
  SETTING_HOMING_FEED,
  SETTING_HOMING_PULLOFF,
  SETTING_HOMING_SEEK,
  SETTING_LIMIT_INVERT,
};

/** Bit masks for `$23` (bit set = home toward negative). */
export const HOMING_DIR_BIT: Record<Axis, number> = {
  X: 1 << 0,
  Y: 1 << 1,
  Z: 1 << 2,
};

/**
 * Bed corner where X/Y zero-side switches sit (map layout: NW/NE top, SW/SE bottom).
 * Homing seeks toward this corner.
 */
export type HomingXyCorner = "SW" | "SE" | "NW" | "NE";

/** Z switch location — this machine only supports top. */
export type HomingZSide = "top";

export interface HomingDirChoice {
  xyCorner: HomingXyCorner;
  zSide: HomingZSide;
}

/** Suggested ranges for Part C copy / defaults. */
export const HOMING_FEED_SUGGEST_MIN = 25;
export const HOMING_FEED_SUGGEST_MAX = 50;
export const HOMING_PULLOFF_TYPICAL_MIN = 1;
export const HOMING_PULLOFF_TYPICAL_MAX = 2;
/** Seek should stay ≤ this fraction of the slowest axis max rate. */
export const HOMING_SEEK_RATE_FRACTION = 0.5;

export type LimitAxis = "X" | "Y" | "Z";

/** Per-axis switch check: must see on, then off, for ✓. */
export interface SwitchCheckAxis {
  seenOn: boolean;
  verified: boolean;
}

export type SwitchCheckState = Record<LimitAxis, SwitchCheckAxis>;

export function emptySwitchCheckState(): SwitchCheckState {
  return {
    X: { seenOn: false, verified: false },
    Y: { seenOn: false, verified: false },
    Z: { seenOn: false, verified: false },
  };
}

/**
 * Advance switch-check tracking from live limit pin flags.
 * ✓ once an axis has been seen active and then inactive.
 */
export function advanceSwitchCheck(
  prev: SwitchCheckState,
  limits: { X: boolean; Y: boolean; Z: boolean },
): SwitchCheckState {
  const next: SwitchCheckState = {
    X: { ...prev.X },
    Y: { ...prev.Y },
    Z: { ...prev.Z },
  };
  for (const ax of ["X", "Y", "Z"] as const) {
    if (next[ax].verified) continue;
    if (limits[ax]) {
      next[ax] = { ...next[ax], seenOn: true };
    } else if (next[ax].seenOn) {
      next[ax] = { seenOn: true, verified: true };
    }
  }
  return next;
}

export function allSwitchesVerified(state: SwitchCheckState): boolean {
  return state.X.verified && state.Y.verified && state.Z.verified;
}

/** Decode `$5` boolean (stock GRBL: 0 = normal, 1 = inverted). */
export function decodeLimitInvert(value: number): boolean {
  return (Number.isFinite(value) ? Math.trunc(value) : 0) !== 0;
}

/** Encode `$5` boolean to 0 | 1. */
export function encodeLimitInvert(inverted: boolean): number {
  return inverted ? 1 : 0;
}

/** Flip `$5` 0 ↔ 1. */
export function flippedLimitInvert(current: number): number {
  return encodeLimitInvert(!decodeLimitInvert(current));
}

/**
 * Compute `$23` from corner + Z side.
 * Bit set = home toward negative (GRBL 1.1).
 * - SW switches → seek −X −Y → bits 0+1
 * - SE → +X −Y → bit 1 only
 * - NW → −X +Y → bit 0 only
 * - NE → +X +Y → no X/Y bits
 * Z at top (+Z) → Z bit clear (this machine only).
 */
export function encodeHomingDirMask(choice: HomingDirChoice): number {
  let mask = 0;
  // X: negative home when corner is on the west (min X) side
  if (choice.xyCorner === "SW" || choice.xyCorner === "NW") {
    mask |= HOMING_DIR_BIT.X;
  }
  // Y: negative home when corner is on the south (min Y) side
  if (choice.xyCorner === "SW" || choice.xyCorner === "SE") {
    mask |= HOMING_DIR_BIT.Y;
  }
  // Z top → home toward +Z → bit clear
  void choice.zSide;
  return mask & 0b111;
}

/** Decode `$23` into corner + Z side (Z always top on this machine). */
export function decodeHomingDirMask(mask: number): HomingDirChoice {
  const m = (Number.isFinite(mask) ? Math.trunc(mask) : 0) & 0b111;
  const negX = (m & HOMING_DIR_BIT.X) !== 0;
  const negY = (m & HOMING_DIR_BIT.Y) !== 0;
  let xyCorner: HomingXyCorner;
  if (negX && negY) xyCorner = "SW";
  else if (!negX && negY) xyCorner = "SE";
  else if (negX && !negY) xyCorner = "NW";
  else xyCorner = "NE";
  return { xyCorner, zSide: "top" };
}

export function describeHomingDirMask(mask: number): string {
  const { xyCorner } = decodeHomingDirMask(mask);
  return `${xyCorner} corner · Z top`;
}

/** Suggest seek ≤ 50% of the slowest axis max rate (or current if lower). */
export function suggestHomingSeek(
  currentSeek: number | null,
  maxRates: { x: number | null; y: number | null; z: number | null },
): number | null {
  const rates = [maxRates.x, maxRates.y, maxRates.z].filter(
    (n): n is number => n !== null && Number.isFinite(n) && n > 0,
  );
  if (rates.length === 0) return currentSeek;
  const cap = Math.round(Math.min(...rates) * HOMING_SEEK_RATE_FRACTION);
  if (currentSeek !== null && Number.isFinite(currentSeek) && currentSeek > 0) {
    return Math.min(currentSeek, cap);
  }
  return cap;
}

export function suggestHomingFeed(current: number | null): number {
  if (current !== null && Number.isFinite(current) && current > 0) {
    return Math.min(
      HOMING_FEED_SUGGEST_MAX,
      Math.max(HOMING_FEED_SUGGEST_MIN, Math.round(current)),
    );
  }
  return HOMING_FEED_SUGGEST_MIN;
}

export function suggestHomingPullOff(current: number | null): number {
  if (current !== null && Number.isFinite(current) && current > 0) {
    return current;
  }
  return HOMING_PULLOFF_TYPICAL_MIN;
}

/** Plain labels for homing settings (GRBL code secondary in UI). */
export function homingSettingPlainLabel(id: number): string {
  switch (id) {
    case SETTING_LIMIT_INVERT:
      return "Limit switch polarity";
    case SETTING_HOMING_DIR_MASK:
      return "Homing direction";
    case SETTING_HOMING_FEED:
      return "Final touch speed";
    case SETTING_HOMING_SEEK:
      return "How fast it looks for the switch";
    case SETTING_HOMING_PULLOFF:
      return "Pull-off after touch";
    case SETTING_HOMING_CYCLE:
      return "Homing enabled";
    default:
      return `Setting $${id}`;
  }
}

export function homingSettingUnit(id: number): string {
  switch (id) {
    case SETTING_HOMING_FEED:
    case SETTING_HOMING_SEEK:
      return "mm/min";
    case SETTING_HOMING_PULLOFF:
      return "mm";
    default:
      return "";
  }
}

/** Mock-only limit pin toggles (never send to USB). */
export const EXT_LIMIT_COMMANDS = [
  "$ExtLimitX",
  "$ExtLimitY",
  "$ExtLimitZ",
] as const;

export type ExtLimitCommand = (typeof EXT_LIMIT_COMMANDS)[number];

export function extLimitCommandForAxis(axis: LimitAxis): ExtLimitCommand {
  return `$ExtLimit${axis}` as ExtLimitCommand;
}
