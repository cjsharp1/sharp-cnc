/**
 * Smoke: steps/mm math, $$ / $n= IO on mock, soft-travel + $3 direction helpers,
 * settings backup round-trip / diff / Calibrate undo (PR 1),
 * direction/steps polish helpers (PR 2).
 * Run: npx --yes tsx scripts/smoke-calibration.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  SETTING_DIR_PORT_INVERT,
  SETTING_HOMING_CYCLE,
  SETTING_SOFT_LIMITS,
  SETTING_STEPS_X,
  STEPS_MM_LARGE_CHANGE_FRACTION,
  STEPS_RETEST_TOLERANCE_MM,
  canWriteSettings,
  computeStepsPerMm,
  decodeDirInvertMask,
  describeDirInvertMask,
  encodeDirInvertMask,
  estimateStepsPerMm,
  formatSettingWrite,
  homingEnabled,
  parseSettingLine,
  parseSettingsDump,
  roundStepsPerMm,
  softLimitsEnabled,
  softTravelFromSettings,
  softTravelWriteCommands,
  stepsPerMmChangeFraction,
} from "../src/grbl/settings.ts";
import {
  SETTINGS_BACKUP_MAX,
  SETTINGS_BACKUP_STORAGE_KEY,
  diffSettings,
  formatCalibrateUndoLabel,
  formatSettingsDumpText,
  loadSettingsBackups,
  popCalibrateUndo,
  pushCalibrateUndo,
  pushSettingsBackup,
  restoreWriteEntries,
  settingsMapToRecord,
  settingsRecordToMap,
} from "../src/grbl/settingsBackup.ts";
import {
  fetchGrblSettings,
  writeGrblSetting,
  writeGrblSettings,
} from "../src/grbl/settingsIo.ts";

/** Minimal localStorage for Node smoke (settings backup helpers). */
const memStore = new Map<string, string>();
(
  globalThis as { localStorage?: Storage }
).localStorage = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memStore.set(k, String(v));
  },
  removeItem: (k: string) => {
    memStore.delete(k);
  },
  clear: () => memStore.clear(),
  key: () => null,
  get length() {
    return memStore.size;
  },
} as Storage;
memStore.clear();

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

// Negative commanded distance (Z down) uses absolute travel for the ratio.
const zNeg = computeStepsPerMm(250, -20, 19);
assert(
  Math.abs(zNeg - 250 * (20 / 19)) < 1e-9,
  `Z-down steps abs distance expected ~${250 * (20 / 19)}, got ${zNeg}`,
);

assert(
  stepsPerMmChangeFraction(250, 300) === 0.2,
  "±20% change fraction",
);
assert(
  stepsPerMmChangeFraction(250, 301) > STEPS_MM_LARGE_CHANGE_FRACTION,
  "301/250 is above large-change guard",
);
assert(
  stepsPerMmChangeFraction(250, 260) < STEPS_MM_LARGE_CHANGE_FRACTION,
  "small change below guard",
);

assert(estimateStepsPerMm(200, 8, 2) === 800, "200×8÷2 = 800 steps/mm");
assert(roundStepsPerMm(estimateStepsPerMm(200, 16, 8)) === 400, "belt estimate");

assert(STEPS_RETEST_TOLERANCE_MM === 0.1, "re-test tolerance 0.1 mm");
assert(
  Math.abs(20.05 - 20) <= STEPS_RETEST_TOLERANCE_MM,
  "re-test pass within ±0.1",
);
assert(
  Math.abs(20.2 - 20) > STEPS_RETEST_TOLERANCE_MM,
  "re-test fail outside ±0.1",
);

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
// Virtual CNC is a perfectly calibrated machine — soft limits on by default.
// Real Demon Shield EEPROM still ships with $20=0 until calibration writes it.
assert(softLimitsEnabled(settings) === true, "Virtual CNC soft limits on by default");
// Virtual CNC enables homing ($22=1); real EEPROM may ship with $22=0.
assert(homingEnabled(settings) === true, "Virtual CNC $22 on by default");
assert(
  settings.get(SETTING_HOMING_CYCLE)?.value === 1,
  "$$ includes $22=1 for direction↔homing note",
);

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

// --- Settings backup / diff / undo (PR 1) ------------------------------------

memStore.clear();
const snap1 = pushSettingsBackup(finalMap, 1_700_000_000_000);
assert(snap1.snapshots.length === 1, "one snapshot stored");
assert(
  Object.keys(snap1.snapshots[0]!.settings).length === finalMap.size,
  "snapshot has full map",
);
assert(
  memStore.has(SETTINGS_BACKUP_STORAGE_KEY),
  "persisted under sharpcnc.settingsBackup.v1",
);

// Round-trip: dump text → parse → same values for key ids.
const dumpText = formatSettingsDumpText(finalMap);
assert(dumpText.includes("$100=262.5"), `dump has $100, got:\n${dumpText}`);
assert(dumpText.includes("$3=5"), "dump has $3");
const reparsed = parseSettingsDump(dumpText.split("\n"));
assert(reparsed.get(100)?.value === 262.5, "round-trip $100");
assert(reparsed.get(SETTING_DIR_PORT_INVERT)?.value === 5, "round-trip $3");

// Keep last 5 (newest first). Values 200..205 → keep 201..205.
for (let i = 0; i < 6; i++) {
  const m = new Map(finalMap);
  m.set(100, { id: 100, value: 200 + i });
  pushSettingsBackup(m, 1_700_000_000_000 + i + 1);
}
const kept = loadSettingsBackups();
assert(
  kept.snapshots.length === SETTINGS_BACKUP_MAX,
  `keep last ${SETTINGS_BACKUP_MAX}, got ${kept.snapshots.length}`,
);
assert(
  kept.snapshots[0]!.settings["100"] === 205,
  "newest snapshot first",
);
assert(
  kept.snapshots[SETTINGS_BACKUP_MAX - 1]!.settings["100"] === 201,
  "oldest kept is 201",
);

// Diff: only changed settings (snapshot → current; restore writes `from`).
const baseline = settingsRecordToMap(kept.snapshots[0]!.settings); // $100=205
const currentish = new Map(baseline);
currentish.set(100, { id: 100, value: 999 });
currentish.set(112, { id: 112, value: 375 });
const diff = diffSettings(baseline, currentish);
assert(diff.length === 2, `expected 2 changed, got ${diff.length}`);
assert(
  diff.some((d) => d.id === 100 && d.from === 205 && d.to === 999),
  "$100 in diff",
);
assert(
  diff.some((d) => d.id === 112 && d.from !== null && d.to === 375),
  "$112 in diff",
);
const writes = restoreWriteEntries(diff);
assert(
  writes.every((w) => Number.isFinite(w.value)),
  "restore writes have values",
);
assert(
  writes.find((w) => w.id === 100)?.value === 205,
  "restore writes snapshot (from) value",
);

// Empty diff when equal.
assert(diffSettings(baseline, baseline).length === 0, "identical → empty diff");

// Session undo stack.
let stack = pushCalibrateUndo([], { id: 112, before: 500, after: 375 });
stack = pushCalibrateUndo(stack, { id: 100, before: 250, after: 262.5 });
assert(
  formatCalibrateUndoLabel(stack[stack.length - 1]!) ===
    "Undo $100 (262.5 → 250)",
  `undo label got ${formatCalibrateUndoLabel(stack[stack.length - 1]!)}`,
);
const popped = popCalibrateUndo(stack);
assert(popped.entry?.id === 100, "pop newest");
assert(popped.next.length === 1 && popped.next[0]!.id === 112, "stack left");

// Undo write against mock: restore $100 to 250.
await writeGrblSetting(client, SETTING_STEPS_X, 250, { timeoutMs: 1500 });
const afterUndo = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(afterUndo.get(SETTING_STEPS_X)?.value === 250, "undo write $100");

// Record → map helpers.
const rec = settingsMapToRecord(afterUndo);
assert(rec["100"] === 250, "map→record");
assert(settingsRecordToMap(rec).get(100)?.value === 250, "record→map");

await client.disconnect();

console.log("smoke-calibration: ok");
