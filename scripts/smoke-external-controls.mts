/**
 * Smoke: Demon Shield external control adapter + Pn: parse + streamer sync.
 * Run: npx --yes tsx scripts/smoke-external-controls.mts
 */
import {
  createDemonShieldExternalControlAdapter,
  isGrblResetBanner,
  parseActivePins,
} from "../src/grbl/externalControls.ts";
import { parseStatusReport } from "../src/grbl/parseStatus.ts";
import { createGcodeStreamer } from "../src/grbl/streamer.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import { createGrblClient } from "../src/grbl/client.ts";
import type { GrblStatus } from "../src/grbl/types.ts";
import { OFFLINE_STATUS } from "../src/grbl/types.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- Pn: parsing ------------------------------------------------------------

const pins = parseActivePins("HS");
assert(pins.feedHold && pins.cycleStart && !pins.reset, "parse H+S");
assert(parseActivePins("").raw === "", "empty pins");
assert(isGrblResetBanner("Grbl 1.1h ['$' for help]"), "welcome banner");
assert(isGrblResetBanner("[MSG:Reset to continue]"), "reset msg");
assert(!isGrblResetBanner("ok"), "ok is not banner");

const withPn = parseStatusReport(
  "<Hold:0|MPos:1.000,2.000,3.000|FS:0,0|Pn:H>",
);
assert(withPn?.state === "Hold", "Hold state");
assert(withPn?.pins?.feedHold === true, "Pn:H parsed");

const cleared = parseStatusReport(
  "<Idle|MPos:1.000,2.000,3.000|FS:0,0>",
  withPn,
);
assert(cleared?.pins === undefined, "Pn omitted clears pins");

// --- Adapter: state transitions + software suppress -------------------------

const adapter = createDemonShieldExternalControlAdapter({
  softwareSuppressMs: 500,
});

const base = (over: Partial<GrblStatus>): GrblStatus => ({
  ...OFFLINE_STATUS,
  state: "Idle",
  machine: { x: 0, y: 0, z: 0 },
  work: { x: 0, y: 0, z: 0 },
  ...over,
});

let t = 1_000;
adapter.observe({
  status: base({ state: "Run" }),
  streamPhase: "running",
  nowMs: t,
});

let ev = adapter.observe({
  status: base({ state: "Hold", pins: parseActivePins("H") }),
  streamPhase: "running",
  nowMs: (t += 50),
});
assert(
  ev.some((e) => e.action === "hold"),
  `expected hold, got ${JSON.stringify(ev)}`,
);

ev = adapter.observe({
  status: base({ state: "Hold" }),
  streamPhase: "paused",
  nowMs: (t += 50),
});
assert(ev.length === 0, "no duplicate hold");

ev = adapter.observe({
  status: base({ state: "Run" }),
  streamPhase: "paused",
  nowMs: (t += 50),
});
assert(
  ev.some((e) => e.action === "resume"),
  `expected resume, got ${JSON.stringify(ev)}`,
);

adapter.noteSoftwareAction("hold", (t += 10));
ev = adapter.observe({
  status: base({ state: "Hold" }),
  streamPhase: "running",
  nowMs: (t += 20),
});
assert(ev.length === 0, "software hold suppressed");

adapter.reset();
t += 1000;
adapter.observe({
  status: base({ state: "Run" }),
  streamPhase: "running",
  nowMs: t,
});
ev = adapter.observe({
  status: base({ state: "Idle" }),
  streamPhase: "running",
  nowMs: (t += 50),
});
assert(
  ev.some((e) => e.action === "abort"),
  `expected abort on Idle, got ${JSON.stringify(ev)}`,
);

adapter.reset();
t += 1000;
adapter.observe({
  status: base({ state: "Idle" }),
  streamPhase: "idle",
  nowMs: t,
});
ev = adapter.observe({
  status: base({ state: "Idle", pins: parseActivePins("S") }),
  streamPhase: "idle",
  nowMs: (t += 50),
});
assert(
  ev.some((e) => e.action === "cycle-start-idle"),
  `expected cycle-start-idle, got ${JSON.stringify(ev)}`,
);

adapter.reset();
t += 1000;
ev = adapter.observe({
  status: base({ state: "Run" }),
  streamPhase: "running",
  rawLine: "Grbl 1.1h ['$' for help]",
  nowMs: t,
});
assert(
  ev.some((e) => e.action === "abort" && e.source === "reset-banner"),
  "reset banner abort",
);

// --- Streamer sync (no second ! / ~ / reset) --------------------------------

const transport = createMockTransport();
const writes: string[] = [];
const origWrite = transport.write.bind(transport);
transport.write = async (data) => {
  if (typeof data === "string") writes.push(data);
  else writes.push(`[bytes:${data.length}]`);
  return origWrite(data);
};

await transport.open({ path: "MOCK://grbl-demo" });
const streamer = createGcodeStreamer(transport, { rxBufferSize: 128 });
const lines = ["G90", "G0 X1", "G0 X2", "G0 X3", "G0 X4"];

const runPromise = streamer.start(lines);
await new Promise((r) => setTimeout(r, 30));
assert(streamer.getProgress().phase === "running", "streamer running");

const beforeHold = writes.length;
streamer.syncFromExternalHold();
assert(streamer.getProgress().phase === "paused", "synced paused");
assert(writes.length === beforeHold, "sync hold did not send !");

await streamer.syncFromExternalResume();
assert(streamer.getProgress().phase === "running", "synced running");
assert(!writes.slice(beforeHold).includes("~"), "sync resume did not send ~");

const beforeAbort = writes.length;
streamer.syncFromExternalAbort();
assert(streamer.getProgress().phase === "idle", "synced idle after abort");
assert(
  !writes.slice(beforeAbort).some((w) => w.includes("bytes")),
  "sync abort did not soft-reset",
);

try {
  await runPromise;
} catch {
  /* start settles on abort/finish */
}

// --- Mock $Ext* buttons -----------------------------------------------------

const mock = createMockTransport();
const client = createGrblClient(mock, {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});
await client.connect({ path: "MOCK://grbl-demo" });
await new Promise((r) => setTimeout(r, 20));

let last = OFFLINE_STATUS;
client.onStatus((s) => {
  last = s;
});

await client.sendLine("G0 X10 Y10");
await new Promise((r) => setTimeout(r, 40));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(last.state === "Run" || last.state === "Idle", `motion state ${last.state}`);

await client.sendLine("$ExtHold");
await new Promise((r) => setTimeout(r, 40));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(last.state === "Hold", `expected Hold after $ExtHold, got ${last.state}`);
assert(last.pins?.feedHold === true, "Pn:H after ExtHold");

await client.sendLine("$ExtResume");
await new Promise((r) => setTimeout(r, 40));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(
  last.state === "Run" || last.state === "Idle",
  `expected Run/Idle after resume, got ${last.state}`,
);

await client.sendLine("$ExtAbort");
await new Promise((r) => setTimeout(r, 60));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(last.state === "Idle" || last.state === "Alarm", `after abort ${last.state}`);

await client.sendLine("$ExtProbe");
await new Promise((r) => setTimeout(r, 40));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(last.pins?.probe === true, "Pn:P after ExtProbe");

streamer.dispose();
await client.disconnect();
await transport.close();

console.log("ok — external Demon Shield controls smoke passed");
