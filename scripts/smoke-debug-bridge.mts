/**
 * Smoke: structured activity categories, JSON export, debug snapshot builder.
 * Run: npx --yes tsx scripts/smoke-debug-bridge.mts
 */
import {
  createActivityLog,
  entryMatchesFilter,
  formatActivityLine,
  inferActivityCategory,
} from "../src/grbl/activityLog.ts";
import {
  DEBUG_BRIDGE_DEFAULT_PORT,
  buildDebugSnapshot,
  debugBridgeBaseUrl,
} from "../src/grbl/debugBridge.ts";
import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(inferActivityCategory("tx", "G0 X1") === "serial", "tx → serial");
assert(inferActivityCategory("alarm", "ALARM:1") === "alarm", "alarm kind");
assert(
  inferActivityCategory("event", "Connected COM3") === "connect",
  "connect event",
);
assert(inferActivityCategory("event", "Jog X1") === "jog", "jog event");
assert(inferActivityCategory("event", "Job start: a.nc") === "job", "job event");
assert(
  inferActivityCategory("event", "Read $$ (12 settings)") === "settings",
  "settings event",
);
assert(
  inferActivityCategory("event", "Simulated alarm (mock)") === "alarm",
  "alarm text",
);

const log = createActivityLog({ capacity: 5 });
log.append("event", "Connected MOCK://grbl-demo");
log.append("tx", "G91");
log.append("rx", "ok");
log.append("event", "Jog X1.000");
log.append("alarm", "ALARM:1");
log.append("event", "extra (ring drop)");
assert(log.getEntries().length === 5, "ring capacity");
assert(log.getEntries()[0]?.text.includes("G91"), "oldest dropped");
assert(log.getLast(2).length === 2, "getLast");

const text = log.exportText("raw");
assert(text.includes("[serial]") && text.includes("[alarm]"), "text categories");

const json = JSON.parse(log.exportJson("raw")) as {
  schemaVersion: number;
  count: number;
  entries: Array<{ category: string }>;
};
assert(json.schemaVersion === 1, "json schema");
assert(json.count === 5, "json count");
assert(
  json.entries.some((e) => e.category === "jog"),
  "json has jog",
);

assert(
  log.getEntries().filter((e) => entryMatchesFilter(e, "connect")).length >= 0,
  "category filter ok",
);
assert(formatActivityLine(log.getEntries()[0]!).includes("["), "format line");

const snapshot = buildDebugSnapshot({
  connection: {
    phase: "connected",
    port: "MOCK://grbl-demo",
    shell: "browser",
    connected: true,
  },
  machine: {
    state: "Idle",
    mpos: { x: 1, y: 2, z: 3 },
    wpos: { x: 0, y: 0, z: 0 },
    alarm: null,
  },
  job: { name: "demo.nc", phase: "idle", progress: null },
  softTravel: DEFAULT_SOFT_TRAVEL,
  log,
  logLimit: 3,
});
assert(snapshot.schemaVersion === 1, "snapshot schema");
assert(snapshot.logs.length === 3, "snapshot log limit");
assert(snapshot.machine.mpos.x === 1, "snapshot mpos");
assert(snapshot.control.enabled === false, "control stub");
assert(
  debugBridgeBaseUrl() === `http://127.0.0.1:${DEBUG_BRIDGE_DEFAULT_PORT}`,
  "base url",
);

console.log("smoke-debug-bridge: ok");
