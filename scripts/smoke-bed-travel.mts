/**
 * Smoke: full work-bed travel test planner + mock jog sequence.
 * Run: npx --yes tsx scripts/smoke-bed-travel.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import {
  BED_TRAVEL_APPROACH_FEED_MM_MIN,
  BED_TRAVEL_APPROACH_MM,
  BED_TRAVEL_CRUISE_FEED_MM_MIN,
  canStartBedTravelTest,
  describeBedTravelProgress,
  distanceToSoftEdgeMm,
  planBedTravelTest,
} from "../src/grbl/bedTravelTest.ts";
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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const limits: SoftTravelLimits = {
  maxX: 1000,
  maxY: 800,
  maxZ: 80,
  min: { x: 0, y: 0, z: 0 },
};

assert(
  canStartBedTravelTest(limits, false).ok === false,
  "refuse when soft limits off",
);
assert(
  canStartBedTravelTest(
    { ...limits, maxX: null },
    true,
  ).ok === false,
  "refuse when max X unset",
);
assert(
  canStartBedTravelTest(
    { ...limits, maxY: null },
    true,
  ).ok === false,
  "refuse when max Y unset",
);
assert(canStartBedTravelTest(limits, true).ok === true, "ready when set");

const start = { x: 100, y: 100, z: 5 };
const plan = planBedTravelTest({
  machine: start,
  softTravel: limits,
  softLimitsOn: true,
});
assert(plan.ok, plan.blocked ?? "plan ok");
assert(plan.segments.length >= 5, `expected several segments, got ${plan.segments.length}`);
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
  plan.segments.some((s) => s.feedMmMin === BED_TRAVEL_CRUISE_FEED_MM_MIN),
  "cruise feed used",
);
assert(
  plan.segments.some((s) => s.feedMmMin === BED_TRAVEL_APPROACH_FEED_MM_MIN),
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
  Math.abs(last.targetMachine.x - 0) < 1e-6 &&
    Math.abs(last.targetMachine.y - 0) < 1e-6,
  "ends at SW machine origin corner",
);

const nearEdge = distanceToSoftEdgeMm({ x: 5, y: 400, z: 10 }, limits);
assert(nearEdge <= 5 + 1e-6, `near-edge distance got ${nearEdge}`);
const mid = distanceToSoftEdgeMm({ x: 500, y: 400, z: 10 }, limits);
assert(mid > BED_TRAVEL_APPROACH_MM, `mid-bed distance got ${mid}`);

const progress = describeBedTravelProgress(0, plan);
assert(progress.percent === 0, "start progress 0");
const midProgress = describeBedTravelProgress(
  Math.floor(plan.segments.length / 2),
  plan,
);
assert(midProgress.percent > 0 && midProgress.percent < 100, "mid progress");
const doneProgress = describeBedTravelProgress(plan.segments.length, plan);
assert(doneProgress.percent === 100, "done progress 100");

// Proximity pulse: segment that enters the proximity band should flag once.
assert(
  plan.segments.some((s) => s.proximityPulse),
  "at least one proximity pulse on the path",
);

const blocked = planBedTravelTest({
  machine: start,
  softTravel: limits,
  softLimitsOn: false,
});
assert(!blocked.ok && blocked.blocked, "plan blocked when $20 off");

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

const mockPlan = planBedTravelTest({
  machine: { x: 50, y: 50, z: 2 },
  softTravel: {
    maxX: 1000,
    maxY: 800,
    maxZ: 80,
    min: { x: 0, y: 0, z: 0 },
  },
  softLimitsOn: true,
});
assert(mockPlan.ok, mockPlan.blocked ?? "mock plan");

for (const seg of mockPlan.segments.slice(0, 3)) {
  await client.sendLine(seg.command);
  await new Promise((r) => setTimeout(r, 120));
  await client.requestStatus();
}

await client.cancelJog();
await client.disconnect();

console.log("smoke-bed-travel: ok");
