/**
 * Smoke: steps/mm math, $$ / $n= IO on mock, soft-travel + $3 direction helpers.
 * Run: npx --yes tsx scripts/smoke-calibration.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  SETTING_DIR_PORT_INVERT,
  SETTING_SOFT_LIMITS,
  SETTING_STEPS_X,
  canWriteSettings,
  computeStepsPerMm,
  decodeDirInvertMask,
  describeDirInvertMask,
  encodeDirInvertMask,
  formatSettingWrite,
  parseSettingLine,
  parseSettingsDump,
  roundStepsPerMm,
  softLimitsEnabled,
  softTravelFromSettings,
  softTravelWriteCommands,
} from "../src/grbl/settings.ts";
import {
  fetchGrblSettings,
  writeGrblSetting,
  writeGrblSettings,
} from "../src/grbl/settingsIo.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- Pure helpers -----------------------------------------------------------

assert(
  parseSettingLine("$100=250.000")?.id === 100 &&
    parseSettingLine("$100=250.000")?.value === 250,
  "parse $100",
);
assert(parseSettingLine("$J=G91 X10") === null, "jog is not a setting");
assert(
  formatSettingWrite(100, 248.5) === "$100=248.5",
  `format write got ${formatSettingWrite(100, 248.5)}`,
);

const dump = parseSettingsDump([
  "Grbl 1.1h",
  "$100=250.000",
  "$101=250.000",
  "$130=1000.000",
  "ok",
]);
assert(dump.size === 3, "dump size");

const raw = computeStepsPerMm(250, 100, 95);
const next = roundStepsPerMm(raw);
assert(
  Math.abs(raw - 250 * (100 / 95)) < 1e-9,
  `raw steps recompute expected ~${250 * (100 / 95)}, got ${raw}`,
);
assert(next === 263.158, `rounded steps expected 263.158, got ${next}`);

assert(canWriteSettings("Idle", true, false).ok === true, "idle ok");
assert(canWriteSettings("Idle", true, true).ok === false, "block while streaming");
assert(canWriteSettings("Run", true, false).ok === false, "block while Run");
assert(canWriteSettings("Alarm", true, false).ok === false, "block Alarm");

assert(encodeDirInvertMask({ x: false, y: false, z: false }) === 0, "$3 none");
assert(encodeDirInvertMask({ x: true, y: false, z: false }) === 1, "$3 X");
assert(encodeDirInvertMask({ x: false, y: true, z: false }) === 2, "$3 Y");
assert(encodeDirInvertMask({ x: false, y: false, z: true }) === 4, "$3 Z");
assert(encodeDirInvertMask({ x: true, y: true, z: true }) === 7, "$3 XYZ");
assert(encodeDirInvertMask({ x: true, y: false, z: true }) === 5, "$3 X+Z");
const decoded = decodeDirInvertMask(5);
assert(decoded.x && !decoded.y && decoded.z, "decode $3=5");
assert(describeDirInvertMask(0) === "none", "describe none");
assert(describeDirInvertMask(5) === "X+Z", "describe X+Z");
assert(decodeDirInvertMask(13).x && !decodeDirInvertMask(13).y && decodeDirInvertMask(13).z, "mask bits >2 ignored");

const cmds = softTravelWriteCommands(
  { maxX: 980, maxY: 1000, maxZ: null, min: { x: 0, y: 0, z: 0 } },
  true,
);
assert(cmds.includes("$130=980"), "write X travel");
assert(cmds.includes("$131=1000"), "write Y travel");
assert(!cmds.some((c) => c.startsWith("$132=")), "skip unset Z");
assert(cmds.includes("$20=1"), "enable soft limits");

// --- Mock $$ / $n= ----------------------------------------------------------

const transport = createMockTransport();
const client = createGrblClient(transport, {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});

await client.connect({ path: "MOCK://grbl-demo" });
await new Promise((r) => setTimeout(r, 40));

const settings = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(settings.size >= 10, `expected settings dump, got ${settings.size}`);
assert(settings.get(SETTING_STEPS_X)?.value === 250, "default $100");
assert(settings.get(SETTING_DIR_PORT_INVERT)?.value === 0, "default $3");
assert(softLimitsEnabled(settings) === false, "soft limits off by default");

await writeGrblSetting(client, SETTING_DIR_PORT_INVERT, 5, { timeoutMs: 1500 });
const afterDir = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(afterDir.get(SETTING_DIR_PORT_INVERT)?.value === 5, "wrote $3");

await writeGrblSetting(client, SETTING_STEPS_X, 262.5, { timeoutMs: 1500 });
const after = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(after.get(SETTING_STEPS_X)?.value === 262.5, "wrote $100");
assert(after.get(SETTING_DIR_PORT_INVERT)?.value === 5, "$3 still set");

await writeGrblSettings(
  client,
  [
    { id: 130, value: 975 },
    { id: 131, value: 990 },
    { id: SETTING_SOFT_LIMITS, value: 1 },
  ],
  { timeoutMs: 1500 },
);

const finalMap = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(finalMap.get(130)?.value === 975, "$130");
assert(finalMap.get(131)?.value === 990, "$131");
assert(softLimitsEnabled(finalMap) === true, "$20 on");

const travel = softTravelFromSettings(finalMap, DEFAULT_SOFT_TRAVEL);
assert(travel.maxX === 975 && travel.maxY === 990, "soft travel from settings");

await client.disconnect();

console.log("smoke-calibration: ok");
