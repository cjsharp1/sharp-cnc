/**
 * Smoke: max rate / accel calibration helpers (PR 3).
 * Covers trial-write, restore-on-cancel, pending-restore-after-disconnect,
 * 2× ceiling, and Z down-first ordering.
 * Run: npx --yes tsx scripts/smoke-rates-test.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  ACCEL_SETTING_FOR_AXIS,
  RATE_SETTING_FOR_AXIS,
  RATES_PENDING_RESTORE_KEY,
  RATES_RAMP_FACTOR,
  RATES_RECOMMEND_DEFAULT,
  RATES_TRIAL_CEILING_MULT,
  buildRatesTrialLines,
  canFitRatesTest,
  clearPendingRatesRestore,
  defaultRatesCycles,
  defaultRatesDistanceMm,
  loadPendingRatesRestore,
  mergePendingRatesRestore,
  nextRatesTrialValue,
  ratesFirstMotionDelta,
  ratesOutDeltaMm,
  ratesSettingId,
  ratesTrialCeiling,
  recommendRatesValue,
  savePendingRatesRestore,
} from "../src/grbl/ratesCalibration.ts";
import {
  fetchGrblSettings,
  writeGrblSetting,
} from "../src/grbl/settingsIo.ts";

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

assert(RATE_SETTING_FOR_AXIS.X === 110, "$110 X rate");
assert(RATE_SETTING_FOR_AXIS.Z === 112, "$112 Z rate");
assert(ACCEL_SETTING_FOR_AXIS.Y === 121, "$121 Y accel");
assert(ratesSettingId("rate", "Z") === 112, "Z rate id");
assert(ratesSettingId("accel", "X") === 120, "X accel id");

assert(defaultRatesDistanceMm("X") === 50, "XY default distance");
assert(defaultRatesDistanceMm("Z") === 15, "Z default distance");
assert(defaultRatesCycles("X") === 10, "XY cycles");
assert(defaultRatesCycles("Z") === 20, "Z cycles");

assert(ratesOutDeltaMm("X", 50) === 50, "X out +");
assert(ratesOutDeltaMm("Z", 15) === -15, "Z out down-first");
assert(ratesFirstMotionDelta("Z", 15).delta === -15, "Z first motion down");

assert(ratesTrialCeiling(500) === 500 * RATES_TRIAL_CEILING_MULT, "2× ceiling");
assert(RATES_TRIAL_CEILING_MULT === 2, "ceiling mult is 2");

const next = nextRatesTrialValue(500, 1000, "rate");
assert(next === Math.round(500 * RATES_RAMP_FACTOR), `ramp +20% got ${next}`);
assert(
  nextRatesTrialValue(900, 1000, "rate") === null ||
    (nextRatesTrialValue(900, 1000, "rate") ?? 0) <= 1000,
  "ramp respects ceiling",
);
assert(nextRatesTrialValue(1000, 1000, "rate") === null, "at ceiling → null");

const rec = recommendRatesValue(800, RATES_RECOMMEND_DEFAULT, "rate");
assert(rec === Math.round(800 * 0.75), `recommend ×0.75 got ${rec}`);
assert(
  recommendRatesValue(100, 0.7, "rate") === 70,
  "slider low 0.7",
);
assert(
  recommendRatesValue(100, 0.8, "rate") === 80,
  "slider high 0.8",
);

const lines = buildRatesTrialLines("X", 50, 2, 500);
assert(lines[0] === "G21", "G21 first");
assert(lines[1] === "G91", "G91 relative");
assert(lines[2] === "G1 X50 F500", "out +X");
assert(lines[3] === "G1 X-50 F500", "back −X");
assert(lines[4] === "G1 X50 F500", "cycle 2 out");
assert(lines[lines.length - 1] === "G90", "restore absolute");

const zLines = buildRatesTrialLines("Z", 15, 1, 400);
assert(zLines[2] === "G1 Z-15 F400", "Z down-first out");
assert(zLines[3] === "G1 Z15 F400", "Z up back");

const soft = {
  ...DEFAULT_SOFT_TRAVEL,
  maxX: 300,
  maxY: 200,
  maxZ: 80,
};
assert(
  canFitRatesTest({ x: 10, y: 10, z: -5 }, soft, "X", 50).ok,
  "X fits from 10",
);
assert(
  !canFitRatesTest({ x: 280, y: 10, z: -5 }, soft, "X", 50).ok,
  "X blocked near far end",
);
assert(
  canFitRatesTest({ x: 10, y: 10, z: -5 }, soft, "Z", 15).ok,
  "Z down fits from −5",
);
assert(
  !canFitRatesTest({ x: 10, y: 10, z: -75 }, soft, "Z", 15).ok,
  "Z blocked near bottom",
);
assert(
  canFitRatesTest({ x: 10, y: 10, z: 0 }, soft, "Z", 15).ok,
  "Z from home (0) down 15 fits in [−80,0]",
);

// Pending restore localStorage
clearPendingRatesRestore();
assert(loadPendingRatesRestore() === null, "no pending");
savePendingRatesRestore([{ id: 110, value: 500 }]);
assert(memStore.has(RATES_PENDING_RESTORE_KEY), "key written");
const pending = loadPendingRatesRestore();
assert(pending?.entries.length === 1, "one entry");
assert(pending?.entries[0]?.id === 110 && pending.entries[0].value === 500, "values");

const merged = mergePendingRatesRestore(
  [{ id: 110, value: 500 }],
  [{ id: 110, value: 600 }, { id: 120, value: 10 }],
);
assert(
  merged.find((e) => e.id === 110)?.value === 500,
  "merge keeps original baseline for existing id",
);
assert(merged.find((e) => e.id === 120)?.value === 10, "merge adds new id");
clearPendingRatesRestore();
assert(loadPendingRatesRestore() === null, "cleared");

// --- Mock IO: trial-write + restore-on-cancel + reconnect pending ----------

async function withClient<T>(fn: (client: ReturnType<typeof createGrblClient>) => Promise<T>): Promise<T> {
  const transport = createMockTransport();
  const client = createGrblClient(transport, { softResetOnConnect: true, statusPollMs: 50 });
  await client.connect({ path: "MOCK://grbl-demo" });
  try {
    return await fn(client);
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

await withClient(async (client) => {
  const before = await fetchGrblSettings(client, { timeoutMs: 2000 });
  const baseline = before.get(110)?.value ?? 500;
  assert(Number.isFinite(baseline), "baseline rate");

  // Trial write
  const trial = Math.round(baseline * 1.2);
  await writeGrblSetting(client, 110, trial, { timeoutMs: 1500 });
  const mid = await fetchGrblSettings(client, { timeoutMs: 2000 });
  assert(mid.get(110)?.value === trial, `trial-write expected ${trial}`);

  // Persist pending restore (as cancel/leave would)
  savePendingRatesRestore([{ id: 110, value: baseline }]);

  // Restore-on-cancel
  await writeGrblSetting(client, 110, baseline, { timeoutMs: 1500 });
  clearPendingRatesRestore();
  const afterCancel = await fetchGrblSettings(client, { timeoutMs: 2000 });
  assert(
    afterCancel.get(110)?.value === baseline,
    "restore-on-cancel restored baseline",
  );

  // pending-restore-after-disconnect: leave pending, "reconnect", apply
  await writeGrblSetting(client, 110, trial, { timeoutMs: 1500 });
  savePendingRatesRestore([{ id: 110, value: baseline }]);
});

// Fresh connect simulates reconnect; pending still in localStorage
await withClient(async (client) => {
  const pending2 = loadPendingRatesRestore();
  assert(pending2?.entries[0]?.value !== undefined, "pending survives disconnect");
  for (const e of pending2!.entries) {
    await writeGrblSetting(client, e.id, e.value, { timeoutMs: 1500 });
  }
  clearPendingRatesRestore();
  const restored = await fetchGrblSettings(client, { timeoutMs: 2000 });
  assert(
    restored.get(110)?.value === pending2!.entries[0]!.value,
    "pending-restore-after-disconnect applied",
  );
});

// Ceiling clamp sanity with live baseline
await withClient(async (client) => {
  const map = await fetchGrblSettings(client, { timeoutMs: 2000 });
  const baseline = map.get(112)?.value ?? 500;
  const ceiling = ratesTrialCeiling(baseline);
  let trial = baseline;
  let steps = 0;
  while (steps < 20) {
    const n = nextRatesTrialValue(trial, ceiling, "rate");
    if (n === null) break;
    trial = n;
    steps++;
  }
  assert(trial <= ceiling + 1e-9, "ramp never exceeds 2× ceiling");
  assert(steps >= 1, "at least one ramp step from baseline");
});

console.log("smoke-rates-test: ok");
