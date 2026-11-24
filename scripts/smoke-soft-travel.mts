/**
 * Smoke: Soft travel polish (PR 5).
 * Covers $22 prerequisite / error:10, soft-limit verify (error:15),
 * optional $21 write, and plain-language helpers.
 * Run: npx --yes tsx scripts/smoke-soft-travel.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { buildJogCommand } from "../src/grbl/jog.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  SETTING_HARD_LIMITS,
  SETTING_HOMING_CYCLE,
  SETTING_SOFT_LIMITS,
  hardLimitsEnabled,
  softLimitsEnabled,
  softTravelWriteCommands,
} from "../src/grbl/settings.ts";
import { writeGrblSetting, writeGrblSettings } from "../src/grbl/settingsIo.ts";
import {
  HARD_LIMITS_OPTIONAL_COPY,
  SOFT_LIMITS_WORKING_COPY,
  SOFT_TRAVEL_MACHINE_NOT_WORK_COPY,
  SOFT_TRAVEL_NEEDS_HOMING_COPY,
  Z_TRAVEL_POSITIVE_COPY,
  isSoftLimitJogError,
  plainSoftLimitsNeedHoming,
  runSoftLimitVerifyJog,
  softLimitVerifyDelta,
} from "../src/grbl/softTravelCalibration.ts";
import { CALIBRATION_GUIDED_STEPS } from "../src/grbl/calibrationConfig.ts";
import { REAL_ERROR_CODES } from "../src/grbl/grblProtocolFixtures.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

console.log("smoke-soft-travel");

// --- Wizard order / copy constants ------------------------------------------

assert(
  CALIBRATION_GUIDED_STEPS[CALIBRATION_GUIDED_STEPS.length - 1] === "travel",
  "Soft travel is last guided step",
);
assert(
  SOFT_TRAVEL_NEEDS_HOMING_COPY.includes("Homing"),
  "prerequisite mentions Homing",
);
assert(
  SOFT_TRAVEL_MACHINE_NOT_WORK_COPY.includes("not your work"),
  "machine-not-work callout",
);
assert(Z_TRAVEL_POSITIVE_COPY.includes("positive"), "Z positive copy");
assert(HARD_LIMITS_OPTIONAL_COPY.includes("false-trigger"), "hard limits copy");
assert(SOFT_LIMITS_WORKING_COPY.includes("✓"), "verify success copy");
assert(REAL_ERROR_CODES[10]?.toLowerCase().includes("homing"), "error:10 catalog");
pass("copy + wizard order");

// --- Verify delta math ------------------------------------------------------

const limits = {
  maxX: 1000,
  maxY: 800,
  maxZ: 80,
  min: { x: 0, y: 0, z: 0 },
};
const atHome = { x: 0, y: 0, z: 0 };
const dx = softLimitVerifyDelta("X", atHome, limits);
assert(dx?.x !== undefined && dx.x > 1000, `X overshoot got ${dx?.x}`);
const dy = softLimitVerifyDelta("Y", { x: 10, y: 790, z: 0 }, limits);
assert(dy?.y !== undefined && dy.y > 10, `Y overshoot from near max`);
const dz = softLimitVerifyDelta("Z", { x: 0, y: 0, z: -10 }, limits);
assert(dz?.z !== undefined && dz.z < -70, `Z overshoot toward bottom got ${dz?.z}`);
assert(
  softLimitVerifyDelta("Z", atHome, {
    ...limits,
    maxZ: null,
  }) === null,
  "Z verify blocked when travel unknown",
);
pass("softLimitVerifyDelta");

assert(isSoftLimitJogError("error:15"), "error:15 match");
assert(!isSoftLimitJogError("error:10"), "error:10 is not jog refuse");
assert(
  plainSoftLimitsNeedHoming("error:10")?.includes("Homing"),
  "plain error:10",
);
assert(plainSoftLimitsNeedHoming("error:15") === null, "no plain for 15");
pass("error helpers");

const withHard = softTravelWriteCommands(limits, true, true);
assert(withHard.includes("$20=1") && withHard.includes("$21=1"), "$21 optional write");
assert(
  !softTravelWriteCommands(limits, true, false).some((c) => c.startsWith("$21=")),
  "$21 omitted by default",
);
pass("softTravelWriteCommands $21");

// --- Mock: $20=1 with $22=0 → error:10 --------------------------------------

{
  const transport = createMockTransport();
  const client = createGrblClient(transport, {
    softResetOnConnect: false,
    statusPollMs: 10_000,
  });
  await client.connect({ path: "MOCK://grbl-demo" });
  await new Promise((r) => setTimeout(r, 40));

  await writeGrblSetting(client, SETTING_SOFT_LIMITS, 0, { timeoutMs: 1500 });
  await writeGrblSetting(client, SETTING_HOMING_CYCLE, 0, { timeoutMs: 1500 });

  let saw = "";
  try {
    await writeGrblSetting(client, SETTING_SOFT_LIMITS, 1, { timeoutMs: 1500 });
    assert(false, "expected error:10");
  } catch (err) {
    saw = err instanceof Error ? err.message : String(err);
  }
  assert(/^error:\s*10\b/i.test(saw), `expected error:10, got ${saw}`);
  assert(plainSoftLimitsNeedHoming(saw), "plain maps error:10");

  await writeGrblSetting(client, SETTING_HOMING_CYCLE, 1, { timeoutMs: 1500 });
  await writeGrblSetting(client, SETTING_SOFT_LIMITS, 1, { timeoutMs: 1500 });
  assert(softLimitsEnabled(
    new Map([[SETTING_SOFT_LIMITS, { id: SETTING_SOFT_LIMITS, value: 1 }]]),
  ), "soft on after $22");

  await client.disconnect();
  pass("$20 without $22 → error:10");
}

// --- Mock strict: verify jog → error:15 -------------------------------------

{
  const transport = createMockTransport({ strict: true });
  const client = createGrblClient(transport, {
    softResetOnConnect: false,
    statusPollMs: 10_000,
  });
  await client.connect({ path: "MOCK://grbl-demo" });
  await new Promise((r) => setTimeout(r, 40));

  // Virtual CNC already has $20/$22/travel; reaffirm travel for clarity.
  await writeGrblSettings(
    client,
    [
      { id: 130, value: 1000 },
      { id: 131, value: 800 },
      { id: 132, value: 80 },
      { id: SETTING_SOFT_LIMITS, value: 1 },
    ],
    { timeoutMs: 1500 },
  );

  const softTravel = {
    maxX: 1000,
    maxY: 800,
    maxZ: 80,
    min: { x: 0, y: 0, z: 0 },
  };
  const machine = { x: 0, y: 0, z: 0 };
  for (const axis of ["Z", "X", "Y"] as const) {
    const delta = softLimitVerifyDelta(axis, machine, softTravel);
    assert(delta, `${axis} delta`);
    const cmd = buildJogCommand(delta!, 500);
    const outcome = await runSoftLimitVerifyJog(client, cmd, { timeoutMs: 2000 });
    assert(outcome.ok && outcome.kind === "error:15", `${axis} verify: ${JSON.stringify(outcome)}`);
  }
  pass("strict soft-limit verify → error:15 (X/Y/Z)");

  await writeGrblSetting(client, SETTING_HARD_LIMITS, 1, { timeoutMs: 1500 });
  assert(
    hardLimitsEnabled(
      new Map([[SETTING_HARD_LIMITS, { id: SETTING_HARD_LIMITS, value: 1 }]]),
    ),
    "$21 enable helper",
  );

  await client.disconnect();
  pass("optional $21 write");
}

console.log("smoke-soft-travel: ok");
