/**
 * Smoke: Xbox/gamepad → SharpCNC jog mapping (deadzone, axes, cancel edges).
 * Mirrors src/grbl/gamepadJog.ts so plain `node` can run without a TS loader.
 * Run: node scripts/smoke-gamepad-jog.mjs
 */

const GAMEPAD_DEADZONE = 0.22;
const GAMEPAD_MAP = {
  axisLeftX: 0,
  axisLeftY: 1,
  buttonLt: 6,
  buttonRt: 7,
  buttonB: 1,
  buttonBack: 8,
  buttonLb: 4,
  buttonRb: 5,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
};

function applyDeadzone(v, deadzone = GAMEPAD_DEADZONE) {
  if (!Number.isFinite(v)) return 0;
  return Math.abs(v) < deadzone ? 0 : v;
}

function buttonValue(sample, index) {
  const b = sample.buttons[index];
  if (!b) return { pressed: false, value: 0 };
  return { pressed: Boolean(b.pressed), value: Number(b.value) || 0 };
}

function mapGamepadToJog(sample, prevButtons = new Set(), deadzone = GAMEPAD_DEADZONE) {
  if (!sample) {
    return { continuous: null, step: null, cancel: false, statusLabel: "No gamepad" };
  }
  const lx = applyDeadzone(sample.axes[GAMEPAD_MAP.axisLeftX] ?? 0, deadzone);
  const ly = -applyDeadzone(sample.axes[GAMEPAD_MAP.axisLeftY] ?? 0, deadzone);
  const lt = buttonValue(sample, GAMEPAD_MAP.buttonLt);
  const rt = buttonValue(sample, GAMEPAD_MAP.buttonRt);
  const lb = buttonValue(sample, GAMEPAD_MAP.buttonLb);
  const rb = buttonValue(sample, GAMEPAD_MAP.buttonRb);

  const continuous = {};
  if (lx < 0) continuous.X = -1;
  else if (lx > 0) continuous.X = 1;
  if (ly < 0) continuous.Y = -1;
  else if (ly > 0) continuous.Y = 1;
  const zNeg = lt.value > deadzone || lt.pressed || lb.pressed;
  const zPos = rt.value > deadzone || rt.pressed || rb.pressed;
  if (zPos && !zNeg) continuous.Z = 1;
  else if (zNeg && !zPos) continuous.Z = -1;

  const edge = (index) => {
    const now = buttonValue(sample, index).pressed;
    return now && !prevButtons.has(index);
  };
  const step = {};
  if (edge(GAMEPAD_MAP.dpadRight)) step.X = 1;
  if (edge(GAMEPAD_MAP.dpadLeft)) step.X = -1;
  if (edge(GAMEPAD_MAP.dpadUp)) step.Y = 1;
  if (edge(GAMEPAD_MAP.dpadDown)) step.Y = -1;

  return {
    continuous: Object.keys(continuous).length ? continuous : null,
    step: Object.keys(step).length ? step : null,
    cancel: edge(GAMEPAD_MAP.buttonB) || edge(GAMEPAD_MAP.buttonBack),
    statusLabel: "ok",
  };
}

function emptyButtons(n = 16) {
  return Array.from({ length: n }, () => ({ pressed: false, value: 0 }));
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(mapGamepadToJog(null).continuous === null, "null sample → idle");

const centered = { axes: [0, 0, 0, 0], buttons: emptyButtons() };
assert(mapGamepadToJog(centered).continuous === null, "deadzone: centered stick idle");

const noise = { axes: [0.1, -0.1, 0, 0], buttons: emptyButtons() };
assert(mapGamepadToJog(noise).continuous === null, "deadzone: small noise ignored");

const rightUp = { axes: [0.8, -0.9, 0, 0], buttons: emptyButtons() };
const ru = mapGamepadToJog(rightUp);
assert(ru.continuous?.X === 1 && ru.continuous?.Y === 1, "stick right+up → X+ Y+");

const leftDown = { axes: [-0.7, 0.6, 0, 0], buttons: emptyButtons() };
const ld = mapGamepadToJog(leftDown);
assert(ld.continuous?.X === -1 && ld.continuous?.Y === -1, "stick left+down → X− Y−");

const buttonsZ = emptyButtons();
buttonsZ[7] = { pressed: true, value: 1 };
assert(
  mapGamepadToJog({ axes: [0, 0, 0, 0], buttons: buttonsZ }).continuous?.Z === 1,
  "RT → Z+",
);

const buttonsZdown = emptyButtons();
buttonsZdown[6] = { pressed: false, value: 0.9 };
assert(
  mapGamepadToJog({ axes: [0, 0, 0, 0], buttons: buttonsZdown }).continuous?.Z === -1,
  "LT axis → Z−",
);

const dpad = emptyButtons();
dpad[12] = { pressed: true, value: 1 };
assert(
  mapGamepadToJog({ axes: [0, 0, 0, 0], buttons: dpad }, new Set()).step?.Y === 1,
  "D-pad up edge → Y+ step",
);
assert(
  mapGamepadToJog({ axes: [0, 0, 0, 0], buttons: dpad }, new Set([12])).step === null,
  "D-pad held → no repeat step",
);

const cancelBtn = emptyButtons();
cancelBtn[1] = { pressed: true, value: 1 };
assert(
  mapGamepadToJog({ axes: [0, 0, 0, 0], buttons: cancelBtn }, new Set()).cancel,
  "B edge → cancel",
);
assert(
  !mapGamepadToJog({ axes: [0, 0, 0, 0], buttons: cancelBtn }, new Set([1])).cancel,
  "B held → no cancel edge",
);

console.log("smoke-gamepad-jog: ok");
