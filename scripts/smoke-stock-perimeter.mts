/**
 * Smoke: stock blank perimeter planner + mock jog sequence.
 * Run: npx --yes tsx scripts/smoke-stock-perimeter.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import {
  STOCK_PERIMETER_APPROACH_FEED_MM_MIN,
  STOCK_PERIMETER_CRUISE_FEED_MM_MIN,
  canStartStockPerimeterTest,
  describeStockPerimeterProgress,
  planStockPerimeterTest,
  stockCornerMachine,
  stockCornerWork,
} from "../src/grbl/stockPerimeterTest.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  SETTING_SOFT_LIMITS,
  softLimitsEnabled,
} from "../src/grbl/settings.ts";
import {
  fetchGrblSettings,
  writeGrblSettings,
} from "../src/grbl/settingsIo.ts";
import type { SoftTravelLimits } from "../src/grbl/machineConfig.ts";
import type { StockConfig } from "../src/grbl/stockConfig.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const limits: SoftTravelLimits = {
  maxX: 1000,
  maxY: 800,
  maxZ: 80,
  min: { x: 0, y: 0, z: 0 },
};

const stock: StockConfig = {
  widthMm: 300,
  lengthMm: 200,
  thicknessMm: 18,
  offsetXMm: 0,
  offsetYMm: 0,
  originCorner: "sw",
};

const wco = { x: 50, y: 40, z: 10 };

assert(
  canStartStockPerimeterTest(limits, false, stock, wco).ok === false,
  "refuse when soft limits off",
);
assert(
  canStartStockPerimeterTest({ ...limits, maxX: null }, true, stock, wco).ok ===
    false,
  "refuse when max X unset",
);
assert(
  canStartStockPerimeterTest(
    limits,
    true,
    { ...stock, widthMm: 0 },
    wco,
  ).ok === false,
  "refuse when stock width unset",
);
assert(
  canStartStockPerimeterTest(limits, true, stock, null).ok === false,
  "refuse when WCO missing",
);
assert(
  canStartStockPerimeterTest(limits, true, stock, wco).ok === true,
  "ready when set",
);

const swWork = stockCornerWork(stock, "SW");
assert(swWork.x === 0 && swWork.y === 0, "SW work at origin");
const neWork = stockCornerWork(stock, "NE");
assert(neWork.x === 300 && neWork.y === 200, "NE work at far corner");
const neMach = stockCornerMachine(stock, "NE", wco, 20);
assert(
  Math.abs(neMach.x - 350) < 1e-6 && Math.abs(neMach.y - 240) < 1e-6,
  "NE machine = work + WCO",
);

const start = { x: 100, y: 100, z: 5 };
const plan = planStockPerimeterTest({
  machine: start,
  softTravel: limits,
  softLimitsOn: true,
  stock,
  wco,
});
assert(plan.ok, plan.blocked ?? "plan ok");
assert(
  plan.segments.length >= 5,
  `expected several segments, got ${plan.segments.length}`,
);
assert(
  plan.segments[0]!.phase === "retract",
  `first segment should retract Z, got ${plan.segments[0]!.phase}`,
);
assert(
  plan.segments.some((s) => s.phase === "cruise"),
  "has cruise segments",
);
assert(
  plan.segments.some((s) => s.phase === "approach"),
  "has approach segments",
);
assert(
  plan.segments.every((s) => s.command.startsWith("$J=G91")),
  "all segments are incremental jogs",
);
assert(
  plan.segments.some((s) => s.feedMmMin === STOCK_PERIMETER_CRUISE_FEED_MM_MIN),
  "cruise feed used",
);
assert(
  plan.segments.some(
    (s) => s.feedMmMin === STOCK_PERIMETER_APPROACH_FEED_MM_MIN,
  ),
  "approach feed used",
);

const corners = plan.segments
  .map((s) => s.corner)
  .filter((c): c is NonNullable<typeof c> => c !== null);
assert(corners.includes("SW"), "visits SW");
assert(corners.includes("SE"), "visits SE");
assert(corners.includes("NE"), "visits NE");
assert(corners.includes("NW"), "visits NW");

const last = plan.segments[plan.segments.length - 1]!;
assert(last.corner === "SW", "circuit returns to SW");
assert(
  Math.abs(last.targetMachine.x - (0 + wco.x)) < 1e-6 &&
    Math.abs(last.targetMachine.y - (0 + wco.y)) < 1e-6,
  "ends at SW stock corner in machine space",
);

const progress = describeStockPerimeterProgress(0, plan);
assert(progress.percent === 0, "start progress 0");
const midProgress = describeStockPerimeterProgress(
  Math.floor(plan.segments.length / 2),
  plan,
);
assert(midProgress.percent > 0 && midProgress.percent < 100, "mid progress");
const doneProgress = describeStockPerimeterProgress(plan.segments.length, plan);
assert(doneProgress.percent === 100, "done progress 100");

const blockedSoft = planStockPerimeterTest({
  machine: start,
  softTravel: limits,
  softLimitsOn: false,
  stock,
  wco,
});
assert(!blockedSoft.ok && blockedSoft.blocked, "plan blocked when $20 off");

// Stock outside soft travel should fail soft-limit checks.
const oversized: StockConfig = {
  ...stock,
  widthMm: 2000,
  lengthMm: 2000,
  offsetXMm: 0,
  offsetYMm: 0,
  originCorner: "sw",
};
const overPlan = planStockPerimeterTest({
  machine: { x: 10, y: 10, z: 5 },
  softTravel: limits,
  softLimitsOn: true,
  stock: oversized,
  wco: { x: 0, y: 0, z: 0 },
});
assert(!overPlan.ok && overPlan.blocked, "oversized stock blocked by soft limits");

// SE origin corner: blank grows into -X
const seStock: StockConfig = {
  widthMm: 100,
  lengthMm: 80,
  thicknessMm: 12,
  offsetXMm: -100,
  offsetYMm: 0,
  originCorner: "se",
};
const seWco = { x: 200, y: 100, z: 5 };
const sePlan = planStockPerimeterTest({
  machine: { x: 150, y: 120, z: 3 },
  softTravel: limits,
  softLimitsOn: true,
  stock: seStock,
  wco: seWco,
});
assert(sePlan.ok, sePlan.blocked ?? "SE origin plan");
const seCorners = sePlan.segments
  .map((s) => s.corner)
  .filter((c): c is NonNullable<typeof c> => c !== null);
assert(seCorners.includes("SE"), "SE-origin path visits SE");

// --- Mock serial: write soft travel + jog first retract segment ------------

const transport = createMockTransport();
const client = createGrblClient(transport, {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});

await client.connect({ path: "MOCK://grbl-demo" });
await new Promise((r) => setTimeout(r, 40));

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

const settings = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(softLimitsEnabled(settings) === true, "mock $20 on");

const mockPlan = planStockPerimeterTest({
  machine: { x: 80, y: 60, z: 2 },
  softTravel: {
    maxX: 1000,
    maxY: 800,
    maxZ: 80,
    min: { x: 0, y: 0, z: 0 },
  },
  softLimitsOn: true,
  stock,
  wco,
});
assert(mockPlan.ok, mockPlan.blocked ?? "mock plan");

for (const seg of mockPlan.segments.slice(0, 3)) {
  await client.sendLine(seg.command);
  await new Promise((r) => setTimeout(r, 120));
  await client.requestStatus();
}

await client.cancelJog();
await client.disconnect();

console.log("smoke-stock-perimeter: ok");
