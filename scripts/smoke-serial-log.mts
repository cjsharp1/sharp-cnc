/**
 * Smoke: always-on serial TX/RX timestamp logging (real path + Virtual CNC).
 * Run: npx --yes tsx scripts/smoke-serial-log.mts
 */
import {
  createActivityLog,
  formatSerialTranscriptLine,
  formatTimestampIso,
  formatTimestampLocal,
} from "../src/grbl/activityLog.ts";
import { createGrblClient } from "../src/grbl/client.ts";
import { instrumentTransport } from "../src/grbl/instrumentTransport.ts";
import {
  VIRTUAL_CNC_PATH,
  createMockTransport,
} from "../src/grbl/mockSerial.ts";
import { createRoutingTransport } from "../src/grbl/routingTransport.ts";
import type { SerialTransport } from "../src/grbl/transport.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- Pure timestamp / transcript helpers ------------------------------------

const sampleAt = Date.parse("2026-11-23T12:34:56.789Z");
assert(
  formatTimestampIso(sampleAt) === "2026-11-23T12:34:56.789Z",
  "ISO timestamp",
);
assert(/^\d{2}:\d{2}:\d{2}\.\d{3}$/.test(formatTimestampLocal(sampleAt)), "local ts");

const log = createActivityLog({ capacity: 50 });
const before = Date.now();
log.append("tx", "G0 X1");
log.append("rx", "ok");
log.append("event", "hello", { category: "jog" });
log.append("alarm", "ALARM:1");
const after = Date.now();

const entries = log.getEntries();
assert(entries.length === 4, "four entries");
assert(entries[0]!.at >= before && entries[0]!.at <= after, "tx stamped");
assert(entries[1]!.at >= before && entries[1]!.at <= after, "rx stamped");

const text = log.exportText("raw");
assert(text.includes("G0 X1") && text.includes("2026-"), "exportText has ISO year");
assert(text.includes("TX") && text.includes("RX"), "exportText kinds");

const json = JSON.parse(log.exportJson("raw")) as {
  schemaVersion: number;
  entries: Array<{ kind: string; atIso: string; text: string }>;
};
assert(json.schemaVersion === 2, "json schema v2");
assert(
  json.entries.some((e) => e.kind === "tx" && e.atIso.endsWith("Z")),
  "json atIso",
);

const serial = log.exportSerialTranscript();
assert(serial.includes("G0 X1") && serial.includes("ok"), "serial transcript body");
assert(serial.includes("ALARM:1"), "serial includes alarms");
assert(!serial.includes("hello"), "serial omits non-serial events");
assert(
  formatSerialTranscriptLine(entries[0]!).startsWith(
    formatTimestampIso(entries[0]!.at),
  ),
  "transcript line ISO prefix",
);

// --- Virtual CNC (routed like desktop) instruments TX/RX --------------------

function createStubDesktop(): SerialTransport {
  return {
    kind: "desktop",
    get isOpen() {
      return false;
    },
    async open() {
      throw new Error("desktop stub must not open for Virtual CNC");
    },
    async close() {},
    async write() {
      throw new Error("desktop stub write");
    },
    onLine() {
      return () => undefined;
    },
    onEvent() {
      return () => undefined;
    },
  };
}

const sessionLog = createActivityLog({ capacity: 200 });
const routed = createRoutingTransport(createStubDesktop(), createMockTransport());
const client = createGrblClient(instrumentTransport(routed, sessionLog), {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});

await client.connect({ path: VIRTUAL_CNC_PATH });
await new Promise((r) => setTimeout(r, 40));

await client.sendLine("G21");
await new Promise((r) => setTimeout(r, 50));
await client.sendLine("G0 X0 Y0");
await new Promise((r) => setTimeout(r, 50));

const logged = sessionLog.getEntries();
const txs = logged.filter((e) => e.kind === "tx" && !e.chatter);
const rxs = logged.filter((e) => e.kind === "rx" && !e.chatter);

assert(
  txs.some((e) => e.text.includes("G21")),
  "Virtual CNC TX G21 logged",
);
assert(
  txs.some((e) => /G0 X0 Y0/.test(e.text)),
  "Virtual CNC TX jog/move logged",
);
assert(
  rxs.some((e) => e.text === "ok" || e.text.startsWith("ok")),
  "Virtual CNC RX ok logged",
);
assert(
  logged.every((e) => typeof e.at === "number" && e.at > 0),
  "every entry has timestamp",
);

const transcript = sessionLog.exportSerialTranscript();
assert(transcript.includes("G21"), "transcript has G21");
assert(/^\d{4}-\d{2}-\d{2}T/.test(transcript.trim()), "transcript starts ISO");

await client.disconnect();

console.log("smoke-serial-log: ok");
