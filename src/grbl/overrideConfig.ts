/**
 * Persist last feed / rapid / spindle override percents across launches.
 * GRBL realtime bytes still apply on the machine; this keeps the UI honest
 * after reconnect and restores preferred starting percents.
 */

import {
  FEED_OVERRIDE_MAX,
  FEED_OVERRIDE_MIN,
  SPINDLE_OVERRIDE_MAX,
  SPINDLE_OVERRIDE_MIN,
} from "./spindleFeed";

export interface OverridePercents {
  feed: number;
  rapid: number;
  spindle: number;
}

export const DEFAULT_OVERRIDE_PERCENTS: OverridePercents = {
  feed: 100,
  rapid: 100,
  spindle: 100,
};

const STORAGE_KEY = "sharpcnc.overrides.v1";

const RAPID_ALLOWED = new Set([25, 50, 100]);

function clampFeed(n: number): number {
  return Math.min(
    FEED_OVERRIDE_MAX,
    Math.max(FEED_OVERRIDE_MIN, Math.round(n)),
  );
}

function clampSpindle(n: number): number {
  return Math.min(
    SPINDLE_OVERRIDE_MAX,
    Math.max(SPINDLE_OVERRIDE_MIN, Math.round(n)),
  );
}

function normalizeRapid(n: number): number {
  const rounded = Math.round(n);
  if (RAPID_ALLOWED.has(rounded)) return rounded;
  if (rounded <= 37) return 25;
  if (rounded <= 75) return 50;
  return 100;
}

/** Load last override percents (defaults to 100/100/100). */
export function loadOverridePercents(): OverridePercents {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OVERRIDE_PERCENTS };
    const parsed = JSON.parse(raw) as Partial<OverridePercents>;
    if (
      typeof parsed.feed !== "number" ||
      typeof parsed.rapid !== "number" ||
      typeof parsed.spindle !== "number" ||
      !Number.isFinite(parsed.feed) ||
      !Number.isFinite(parsed.rapid) ||
      !Number.isFinite(parsed.spindle)
    ) {
      return { ...DEFAULT_OVERRIDE_PERCENTS };
    }
    return {
      feed: clampFeed(parsed.feed),
      rapid: normalizeRapid(parsed.rapid),
      spindle: clampSpindle(parsed.spindle),
    };
  } catch {
    return { ...DEFAULT_OVERRIDE_PERCENTS };
  }
}

/** Persist override percents. */
export function saveOverridePercents(next: OverridePercents): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        feed: clampFeed(next.feed),
        rapid: normalizeRapid(next.rapid),
        spindle: clampSpindle(next.spindle),
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}
