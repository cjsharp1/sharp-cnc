/**
 * Soft-limit jog clamp regression (UI pad / keyboard / Xbox share clampJogDelta).
 * Locks Machine travel to [min, max] — no command past 0 or past max.
 * Run: npx --yes tsx scripts/smoke-soft-limit-jog.mts
 */

import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";
import {
  buildJogCommand,
  checkSoftLimits,
  clampJogDelta,
  continuousJogDelta,
  jogDeltaFromAxes,
} from "../src/grbl/jog.ts";
import {
  mapGamepadToJog,
  type GamepadSample,
} from "../src/grbl/gamepadJog.ts";
import type { Position3 } from "../src/grbl/types.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function nearly(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

function emptyButtons(n = 16) {
  return Array.from({ length: n }, () => ({ pressed: false, value: 0 }));
}

const limits = {
  ...DEFAULT_SOFT_TRAVEL,
  min: { ...DEFAULT_SOFT_TRAVEL.min },
  maxZ: 200,
};

// --- Shared clamp helper ----------------------------------------------------

const atOrigin: Position3 = { x: 0, y: 0, z: 0 };

const blockNegX = clampJogDelta(atOrigin, { x: -10 }, limits);
assert(blockNegX.clamped, "clamp flags −X at origin");
assert(
  blockNegX.delta.x === undefined || blockNegX.delta.x === 0,
  "−X from 0 → no motion",
);
assert(nearly(blockNegX.targetMachine.x, 0), "target stays at X0");

const blockNegY = clampJogDelta(atOrigin, { y: -5, x: 2 }, limits);
assert(nearly(blockNegY.delta.x ?? 0, 2), "+X still allowed when −Y clamped");
assert(
  blockNegY.delta.y === undefined || blockNegY.delta.y === 0,
  "−Y from 0 dropped",
);
assert(nearly(blockNegY.targetMachine.y, 0), "Y stays 0");

const nearMin = clampJogDelta({ x: 0.4, y: 10, z: 0 }, { x: -1 }, limits);
assert(nearMin.clamped, "partial clamp near min");
assert(nearly(nearMin.delta.x ?? 0, -0.4), "shrinks −X to land on 0");
assert(nearly(nearMin.targetMachine.x, 0), "lands exactly on soft min");

const pastMax = clampJogDelta({ x: 995, y: 10, z: 0 }, { x: 20 }, limits);
assert(pastMax.clamped, "clamp at soft max");
assert(nearly(pastMax.delta.x ?? 0, 5), "shrinks +X to max");
assert(nearly(pastMax.targetMachine.x, 1000), "lands on soft max");

const ok = clampJogDelta({ x: 10, y: 10, z: 0 }, { x: 5, y: -3 }, limits);
assert(!ok.clamped, "inside envelope unchanged");
assert(nearly(ok.delta.x ?? 0, 5) && nearly(ok.delta.y ?? 0, -3), "pass-through");

// checkSoftLimits still refuses (hard gate for calibration / plans)
const refuse = checkSoftLimits(atOrigin, { x: -1 }, limits);
assert(!refuse.ok, "checkSoftLimits still refuses −X at origin");

// --- Continuous burst race (Xbox stick style) -------------------------------
// Simulate overlapping bursts using a pending soft-limit cursor the way App does.

let cursor: Position3 = { x: 1.2, y: 0.5, z: 0 };
const burstAxes = { X: -1 as const, Y: -1 as const };
for (let i = 0; i < 8; i++) {
  const raw = continuousJogDelta(burstAxes, 500, 0.18);
  const step = clampJogDelta(cursor, raw, limits);
  if (
    (step.delta.x === undefined || step.delta.x === 0) &&
    (step.delta.y === undefined || step.delta.y === 0)
  ) {
    break;
  }
  cursor = step.targetMachine;
  assert(cursor.x >= -1e-9, `burst ${i}: X not negative (${cursor.x})`);
  assert(cursor.y >= -1e-9, `burst ${i}: Y not negative (${cursor.y})`);
}
assert(nearly(cursor.x, 0), "cursor settles at X soft min");
assert(nearly(cursor.y, 0), "cursor settles at Y soft min");

// --- Gamepad → axes → continuous delta → clamp (no hardware) ----------------

const stickLeftDown: GamepadSample = {
  axes: [-0.85, 0.9, 0, 0],
  buttons: emptyButtons(),
};
const frame = mapGamepadToJog(stickLeftDown);
assert(frame.continuous?.X === -1 && frame.continuous?.Y === -1, "stick → X− Y−");

const padRaw = continuousJogDelta(frame.continuous!, 500, 0.18);
const padClamp = clampJogDelta(atOrigin, padRaw, limits);
assert(padClamp.clamped, "gamepad burst from origin is clamped");
assert(
  (padClamp.delta.x === undefined || padClamp.delta.x === 0) &&
    (padClamp.delta.y === undefined || padClamp.delta.y === 0),
  "gamepad cannot command past 0 from origin",
);

const dpadLeft: GamepadSample = {
  axes: [0, 0, 0, 0],
  buttons: emptyButtons().map((b, i) =>
    i === 14 ? { pressed: true, value: 1 } : b,
  ),
};
const stepFrame = mapGamepadToJog(dpadLeft, new Set());
assert(stepFrame.step?.X === -1, "D-pad left → X− step");
const stepRaw = jogDeltaFromAxes(stepFrame.step!, 1);
const stepClamp = clampJogDelta(atOrigin, stepRaw, limits);
assert(
  stepClamp.delta.x === undefined || stepClamp.delta.x === 0,
  "D-pad step also respects soft min",
);

const cmd = buildJogCommand(
  clampJogDelta({ x: 0.25, y: 0, z: 0 }, { x: -1 }, limits).delta,
  500,
);
assert(cmd.includes("X-0.25") || cmd.includes("X-.25"), `clamped cmd: ${cmd}`);
assert(!cmd.includes("X-1"), "command uses clamped distance, not raw −1");

console.log("ok — soft-limit jog clamp smoke passed");
