import type { Axis } from "./types";
import type { JogDelta } from "./jog";

/** Stick / trigger magnitude below this is treated as centered (Xbox-ish). */
export const GAMEPAD_DEADZONE = 0.22;

/**
 * Standard Gamepad API indices for an Xbox-layout controller.
 * Browsers and Tauri/WebView2 expose these via `navigator.getGamepads()`.
 */
export const GAMEPAD_MAP = {
  /** Left stick X — negative = X−, positive = X+ */
  axisLeftX: 0,
  /** Left stick Y — browser: negative = up; we map stick-up → Y+ (back on bed). */
  axisLeftY: 1,
  /** Left trigger (LT) as button value 0–1 → Z− */
  buttonLt: 6,
  /** Right trigger (RT) as button value 0–1 → Z+ */
  buttonRt: 7,
  /** B — cancel / stop jog */
  buttonB: 1,
  /** View / Back — also cancel */
  buttonBack: 8,
  /** LB — Z− (digital alternative to LT) */
  buttonLb: 4,
  /** RB — Z+ (digital alternative to RT) */
  buttonRb: 5,
  /** D-pad for one-shot steps */
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export type GamepadAxisMap = Partial<Record<Axis, 1 | -1>>;

export interface GamepadSample {
  axes: readonly number[];
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
}

export interface GamepadJogFrame {
  /** Continuous / hold-style directions from sticks + triggers. */
  continuous: GamepadAxisMap | null;
  /** Edge-triggered D-pad steps (press this frame only). */
  step: GamepadAxisMap | null;
  /** B / Back pressed this frame → cancel jog. */
  cancel: boolean;
  /** Human status for the Move tab (connected / idle). */
  statusLabel: string;
}

function applyDeadzone(v: number, deadzone = GAMEPAD_DEADZONE): number {
  if (!Number.isFinite(v)) return 0;
  return Math.abs(v) < deadzone ? 0 : v;
}

function buttonValue(
  sample: GamepadSample,
  index: number,
): { pressed: boolean; value: number } {
  const b = sample.buttons[index];
  if (!b) return { pressed: false, value: 0 };
  return { pressed: Boolean(b.pressed), value: Number(b.value) || 0 };
}

/**
 * Map one Gamepad API sample to SharpCNC jog intents.
 * `prevButtons` is the previous frame's pressed flags for D-pad / cancel edges.
 */
export function mapGamepadToJog(
  sample: GamepadSample | null | undefined,
  prevButtons: ReadonlySet<number> = new Set(),
  deadzone = GAMEPAD_DEADZONE,
): GamepadJogFrame {
  if (!sample) {
    return {
      continuous: null,
      step: null,
      cancel: false,
      statusLabel: "No gamepad",
    };
  }

  const lx = applyDeadzone(sample.axes[GAMEPAD_MAP.axisLeftX] ?? 0, deadzone);
  // Invert Y: stick up (negative axis) → +Y (bed back / visualizer up).
  const lyRaw = applyDeadzone(sample.axes[GAMEPAD_MAP.axisLeftY] ?? 0, deadzone);
  const ly = -lyRaw;

  const lt = buttonValue(sample, GAMEPAD_MAP.buttonLt);
  const rt = buttonValue(sample, GAMEPAD_MAP.buttonRt);
  const lb = buttonValue(sample, GAMEPAD_MAP.buttonLb);
  const rb = buttonValue(sample, GAMEPAD_MAP.buttonRb);

  const continuous: GamepadAxisMap = {};
  if (lx < 0) continuous.X = -1;
  else if (lx > 0) continuous.X = 1;
  if (ly < 0) continuous.Y = -1;
  else if (ly > 0) continuous.Y = 1;

  const zNeg =
    lt.value > deadzone || lt.pressed || lb.pressed;
  const zPos =
    rt.value > deadzone || rt.pressed || rb.pressed;
  if (zPos && !zNeg) continuous.Z = 1;
  else if (zNeg && !zPos) continuous.Z = -1;

  const hasContinuous = Object.keys(continuous).length > 0;

  const edge = (index: number): boolean => {
    const now = buttonValue(sample, index).pressed;
    return now && !prevButtons.has(index);
  };

  const step: GamepadAxisMap = {};
  if (edge(GAMEPAD_MAP.dpadRight)) step.X = 1;
  if (edge(GAMEPAD_MAP.dpadLeft)) step.X = -1;
  if (edge(GAMEPAD_MAP.dpadUp)) step.Y = 1;
  if (edge(GAMEPAD_MAP.dpadDown)) step.Y = -1;
  const hasStep = Object.keys(step).length > 0;

  const cancel =
    edge(GAMEPAD_MAP.buttonB) || edge(GAMEPAD_MAP.buttonBack);

  return {
    continuous: hasContinuous ? continuous : null,
    step: hasStep ? step : null,
    cancel,
    statusLabel: hasContinuous
      ? "Stick / trigger jog"
      : hasStep
        ? "D-pad step"
        : "Gamepad ready",
  };
}

/** Snapshot pressed button indices for next-frame edge detection. */
export function pressedButtonSet(sample: GamepadSample | null | undefined): Set<number> {
  const out = new Set<number>();
  if (!sample) return out;
  sample.buttons.forEach((b, i) => {
    if (b?.pressed) out.add(i);
  });
  return out;
}

/** Pick the first connected non-null gamepad from `navigator.getGamepads()`. */
export function firstConnectedGamepad(
  pads: Array<Gamepad | null> | null | undefined,
): Gamepad | null {
  if (!pads) return null;
  for (const pad of pads) {
    if (pad && pad.connected) return pad;
  }
  return null;
}

/** Human-readable mapping for UI / docs (SharpCNC Xbox layout). */
export const GAMEPAD_MAPPING_HELP = [
  "Left stick — jog XY (stick up = Y+ / bed back)",
  "LT / LB — Z− · RT / RB — Z+",
  "D-pad — one step (uses Step mm)",
  "B or Back — Stop / cancel jog",
] as const;

/**
 * Scale continuous stick deflection into a jog delta distance for one tick.
 * Magnitude above deadzone increases distance toward a full continuous burst.
 */
export function gamepadContinuousDelta(
  axes: GamepadAxisMap,
  feedMmMin: number,
  durationSec: number,
  stickMagnitude = 1,
): JogDelta {
  const scale = Math.min(1, Math.max(0.15, stickMagnitude));
  const dist = Math.max(0.05, (feedMmMin / 60) * durationSec * scale);
  const delta: JogDelta = {};
  if (axes.X) delta.x = axes.X * dist;
  if (axes.Y) delta.y = axes.Y * dist;
  if (axes.Z) delta.z = axes.Z * dist;
  return delta;
}
