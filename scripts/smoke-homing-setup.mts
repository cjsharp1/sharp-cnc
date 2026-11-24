/**
 * Smoke: Homing setup helpers (PR 4).
 * Covers Pn: limit parsing, $5/$23 encoding, mock $ExtLimit*, and
 * $H with $22=0 → error:5 (real GRBL).
 * Run: npx --yes tsx scripts/smoke-homing-setup.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { parseActivePins } from "../src/grbl/externalControls.ts";
import {
  HOMING_DIR_BIT,
  advanceSwitchCheck,
  allSwitchesVerified,
  decodeHomingDirMask,
  decodeLimitInvert,
  emptySwitchCheckState,
  encodeHomingDirMask,
  encodeLimitInvert,
  extLimitCommandForAxis,
  flippedLimitInvert,
  suggestHomingFeed,
  suggestHomingSeek,
} from "../src/grbl/homingCalibration.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import { parseStatusReport } from "../src/grbl/parseStatus.ts";
import {
  SETTING_HOMING_CYCLE,
  SETTING_HOMING_DIR_MASK,
  SETTING_LIMIT_INVERT,
} from "../src/grbl/settings.ts";
import { writeGrblSetting } from "../src/grbl/settingsIo.ts";
import { CALIBRATION_GUIDED_STEPS } from "../src/grbl/calibrationConfig.ts";
import { MOCK_ONLY_COMMANDS } from "../src/grbl/grblProtocolFixtures.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

console.log("smoke-homing-setup");

// --- Wizard order -----------------------------------------------------------

assert(
  CALIBRATION_GUIDED_STEPS.join(",") ===
    "zero,direction,steps,rates,homing,travel",
  `guided steps order: ${CALIBRATION_GUIDED_STEPS.join(",")}`,
);
pass("wizard order includes Homing before Soft travel");

// --- Pn: limit parsing ------------------------------------------------------

const lim = parseActivePins("XYZ");
assert(lim.limitX && lim.limitY && lim.limitZ, "Pn:XYZ → all limits");
assert(!lim.probe && !lim.feedHold, "XYZ does not set control pins");

const mixed = parseActivePins("XP");
assert(mixed.limitX && mixed.probe && !mixed.limitY, "Pn:XP");

const fromStatus = parseStatusReport(
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0|Pn:YZ>",
);
assert(fromStatus?.pins?.limitY === true, "status Pn:Y");
assert(fromStatus?.pins?.limitZ === true, "status Pn:Z");
assert(fromStatus?.pins?.limitX !== true, "status no X");

const cleared = parseStatusReport(
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0>",
  fromStatus,
);
assert(cleared?.pins === undefined, "Pn omitted clears limits");
pass("Pn: limitX/Y/Z parsing");

// --- Switch check state machine ---------------------------------------------

let sw = emptySwitchCheckState();
assert(!allSwitchesVerified(sw), "empty not verified");
sw = advanceSwitchCheck(sw, { X: true, Y: false, Z: false });
assert(sw.X.seenOn && !sw.X.verified, "X seen on");
sw = advanceSwitchCheck(sw, { X: false, Y: false, Z: false });
assert(sw.X.verified, "X verified after off");
sw = advanceSwitchCheck(sw, { X: false, Y: true, Z: true });
sw = advanceSwitchCheck(sw, { X: false, Y: false, Z: false });
assert(allSwitchesVerified(sw), "all three verified");
pass("switch check on→off → ✓");

// --- $5 / $23 encoding ------------------------------------------------------

assert(encodeLimitInvert(false) === 0, "$5 false → 0");
assert(encodeLimitInvert(true) === 1, "$5 true → 1");
assert(decodeLimitInvert(1) === true, "decode $5=1");
assert(flippedLimitInvert(0) === 1, "flip 0→1");
assert(flippedLimitInvert(1) === 0, "flip 1→0");
assert(SETTING_LIMIT_INVERT === 5, "$5 id");

assert(HOMING_DIR_BIT.X === 1 && HOMING_DIR_BIT.Y === 2 && HOMING_DIR_BIT.Z === 4);

const swMask = encodeHomingDirMask({ xyCorner: "SW", zSide: "top" });
assert(swMask === (1 | 2), `SW → $23=3 got ${swMask}`);
assert(encodeHomingDirMask({ xyCorner: "NE", zSide: "top" }) === 0, "NE → 0");
assert(encodeHomingDirMask({ xyCorner: "SE", zSide: "top" }) === 2, "SE → 2");
assert(encodeHomingDirMask({ xyCorner: "NW", zSide: "top" }) === 1, "NW → 1");
// Z top never sets bit 2
assert((swMask & HOMING_DIR_BIT.Z) === 0, "Z top → Z bit clear");

assert(decodeHomingDirMask(3).xyCorner === "SW", "decode 3 → SW");
assert(decodeHomingDirMask(0).xyCorner === "NE", "decode 0 → NE");
assert(decodeHomingDirMask(3).zSide === "top", "Z always top");
assert(SETTING_HOMING_DIR_MASK === 23, "$23 id");
pass("$5 boolean + $23 corner encoding");

assert(suggestHomingFeed(100) === 50, "feed capped to suggest max");
assert(suggestHomingFeed(10) === 25, "feed floored to suggest min");
assert(
  suggestHomingSeek(500, { x: 500, y: 400, z: 300 }) === 150,
  "seek ≤ 50% of slowest rate",
);
pass("seek/feed suggestions");

// --- Mock $ExtLimit* + sticky Pn: -------------------------------------------

assert(
  MOCK_ONLY_COMMANDS.includes("$ExtLimitX"),
  "$ExtLimitX listed mock-only",
);
assert(extLimitCommandForAxis("Y") === "$ExtLimitY", "ext cmd for Y");

{
  const transport = createMockTransport();
  const client = createGrblClient(transport, {
    softResetOnConnect: false,
    statusPollMs: 10_000,
  });
  await client.connect({ path: "MOCK://homing-limits" });
  await new Promise((r) => setTimeout(r, 20));

  let lastPins = "";
  client.onStatus((s) => {
    lastPins = s.pins?.raw ?? "";
  });

  await client.sendLine("$ExtLimitX");
  await client.requestStatus();
  await new Promise((r) => setTimeout(r, 40));
  assert(lastPins.includes("X"), `sticky X after ExtLimitX: ${lastPins}`);

  await client.sendLine("$ExtLimitY");
  await client.requestStatus();
  await new Promise((r) => setTimeout(r, 40));
  assert(
    lastPins.includes("X") && lastPins.includes("Y"),
    `X+Y sticky: ${lastPins}`,
  );

  await client.sendLine("$ExtLimitX"); // toggle off
  await client.requestStatus();
  await new Promise((r) => setTimeout(r, 40));
  assert(
    !lastPins.includes("X") && lastPins.includes("Y"),
    `X off Y on: ${lastPins}`,
  );

  await client.disconnect();
  pass("mock $ExtLimit* sticky toggles");
}

// --- $H with $22=0 → error:5 ------------------------------------------------

{
  const transport = createMockTransport();
  const client = createGrblClient(transport, {
    softResetOnConnect: false,
    statusPollMs: 10_000,
  });
  await client.connect({ path: "MOCK://homing-disabled" });
  await new Promise((r) => setTimeout(r, 20));

  await writeGrblSetting(client, SETTING_HOMING_CYCLE, 0, { timeoutMs: 1500 });

  let sawError5 = false;
  const off = transport.onLine((line) => {
    if (line.trim() === "error:5") sawError5 = true;
  });
  await client.sendLine("$H");
  await new Promise((r) => setTimeout(r, 80));
  off();
  assert(sawError5, "emitted error:5 when $22=0");

  // Re-enable and $H enters Home (no error:5)
  sawError5 = false;
  const off2 = transport.onLine((line) => {
    if (line.trim() === "error:5") sawError5 = true;
  });
  await writeGrblSetting(client, SETTING_HOMING_CYCLE, 1, { timeoutMs: 1500 });
  await client.sendLine("$H");
  await new Promise((r) => setTimeout(r, 120));
  off2();
  assert(!sawError5, "$22=1 must not emit error:5");
  await client.disconnect();
  pass("$H with $22=0 → error:5; $22=1 homes");
}

console.log("smoke-homing-setup: all passed");
