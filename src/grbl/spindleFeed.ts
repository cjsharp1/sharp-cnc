/**
 * GRBL 1.1 PWM spindle + feed/spindle realtime overrides (Demon Shield).
 *
 * Absolute speed uses program words (`M3`/`M5`/`S`). Runtime percent uses
 * single-byte realtime commands (no newline) so they work during a job.
 */

/** Feed override: set programmed feed to 100%. */
export const FEED_OVERRIDE_RESET = 0x90;
/** Feed override: +10%. */
export const FEED_OVERRIDE_COARSE_PLUS = 0x91;
/** Feed override: −10%. */
export const FEED_OVERRIDE_COARSE_MINUS = 0x92;
/** Feed override: +1%. */
export const FEED_OVERRIDE_FINE_PLUS = 0x93;
/** Feed override: −1%. */
export const FEED_OVERRIDE_FINE_MINUS = 0x94;

/** Spindle override: set programmed speed to 100%. */
export const SPINDLE_OVERRIDE_RESET = 0x99;
/** Spindle override: +10%. */
export const SPINDLE_OVERRIDE_COARSE_PLUS = 0x9a;
/** Spindle override: −10%. */
export const SPINDLE_OVERRIDE_COARSE_MINUS = 0x9b;
/** Spindle override: +1%. */
export const SPINDLE_OVERRIDE_FINE_PLUS = 0x9c;
/** Spindle override: −1%. */
export const SPINDLE_OVERRIDE_FINE_MINUS = 0x9d;

export type OverrideStep = "reset" | "coarse+" | "coarse-" | "fine+" | "fine-";

const FEED_BYTES: Record<OverrideStep, number> = {
  reset: FEED_OVERRIDE_RESET,
  "coarse+": FEED_OVERRIDE_COARSE_PLUS,
  "coarse-": FEED_OVERRIDE_COARSE_MINUS,
  "fine+": FEED_OVERRIDE_FINE_PLUS,
  "fine-": FEED_OVERRIDE_FINE_MINUS,
};

const SPINDLE_BYTES: Record<OverrideStep, number> = {
  reset: SPINDLE_OVERRIDE_RESET,
  "coarse+": SPINDLE_OVERRIDE_COARSE_PLUS,
  "coarse-": SPINDLE_OVERRIDE_COARSE_MINUS,
  "fine+": SPINDLE_OVERRIDE_FINE_PLUS,
  "fine-": SPINDLE_OVERRIDE_FINE_MINUS,
};

/** GRBL clamps feed override roughly 10–200%. */
export const FEED_OVERRIDE_MIN = 10;
export const FEED_OVERRIDE_MAX = 200;
/** GRBL clamps spindle override roughly 10–200%. */
export const SPINDLE_OVERRIDE_MIN = 10;
export const SPINDLE_OVERRIDE_MAX = 200;

export const DEFAULT_SPINDLE_RPM = 12_000;
export const MIN_SPINDLE_RPM = 0;
export const MAX_SPINDLE_RPM = 24_000;

/** Byte for a feed-override step. */
export function feedOverrideByte(step: OverrideStep): number {
  return FEED_BYTES[step];
}

/** Byte for a spindle-override step. */
export function spindleOverrideByte(step: OverrideStep): number {
  return SPINDLE_BYTES[step];
}

/**
 * Apply a GRBL-style override step to a tracked percent (UI estimate).
 * Real machine value comes from status when reported; this keeps the panel honest.
 */
export function applyOverrideStep(
  currentPercent: number,
  step: OverrideStep,
  min = FEED_OVERRIDE_MIN,
  max = FEED_OVERRIDE_MAX,
): number {
  let next = currentPercent;
  switch (step) {
    case "reset":
      next = 100;
      break;
    case "coarse+":
      next += 10;
      break;
    case "coarse-":
      next -= 10;
      break;
    case "fine+":
      next += 1;
      break;
    case "fine-":
      next -= 1;
      break;
  }
  return Math.min(max, Math.max(min, Math.round(next)));
}

/** `M3 Sxxxx` — spindle CW + PWM speed (RPM). */
export function buildSpindleOnCommand(rpm: number): string {
  const s = Math.round(
    Math.min(MAX_SPINDLE_RPM, Math.max(MIN_SPINDLE_RPM, rpm)),
  );
  return `M3 S${s}`;
}

/** `M5` — spindle stop. */
export function buildSpindleOffCommand(): string {
  return "M5";
}

/** Standalone `S` word (speed change while already spinning). */
export function buildSpindleSpeedCommand(rpm: number): string {
  const s = Math.round(
    Math.min(MAX_SPINDLE_RPM, Math.max(MIN_SPINDLE_RPM, rpm)),
  );
  return `S${s}`;
}
