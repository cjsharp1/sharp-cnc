/**
 * Smoke: activity log + safety helpers + mock Alarm/$X unlock.
 * Run: npx --yes tsx scripts/smoke-activity-safety.mts
 */
import {
  createActivityLog,
  entryMatchesFilter,
  formatTxPayload,
  isStatusChatter,
} from "../src/grbl/activityLog.ts";
import { createGrblClient } from "../src/grbl/client.ts";
import { canStartJob } from "../src/grbl/gcode.ts";
import { instrumentTransport } from "../src/grbl/instrumentTransport.ts";
import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  UNLOCK_COMMAND,
  canJogOrZero,
  checkJobSoftLimits,
  parseAlarmLine,
} from "../src/grbl/safety.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- Pure helpers -----------------------------------------------------------

assert(formatTxPayload("!") === "! (feed hold)", "tx feed hold label");
assert(formatTxPayload(new Uint8Array([0x18])).includes("soft reset"), "tx reset");
assert(isStatusChatter("tx", "?") === true, "? is chatter");
assert(isStatusChatter("rx", "<Idle|MPos:0,0,0>") === true, "status is chatter");

const alarm = parseAlarmLine("ALARM:1");
assert(alarm && alarm.code === 1 && /Hard limit/i.test(alarm.message), "parse ALARM:1");

const lock = parseAlarmLine("error:Alarm lock");
assert(lock && /unlock/i.test(lock.message), "parse alarm lock");

assert(canJogOrZero("Alarm", true, false).ok === false, "no jog in Alarm");
assert(canStartJob("Alarm", true).ok === false, "no start in Alarm");
assert(canJogOrZero("Idle", true, false).ok === true, "jog when Idle");

const soft = checkJobSoftLimits(
  { minX: -10, minY: 0, maxX: 50, maxY: 50 },
  { x: 0, y: 0, z: 0 },
  DEFAULT_SOFT_TRAVEL,
);
assert(soft.ok === false, "job below soft min blocked");

const softOk = checkJobSoftLimits(
  { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  { x: 10, y: 10, z: 0 },
  DEFAULT_SOFT_TRAVEL,
);
assert(softOk.ok === true, "in-bounds job ok");

const log = createActivityLog({ capacity: 20 });
log.append("event", "hello");
log.append("tx", "?", { chatter: true });
log.append("rx", "ok");
log.append("alarm", "ALARM:1");
assert(log.getEntries().length === 4, "log size");
assert(
  log.getEntries().filter((e) => entryMatchesFilter(e, "all")).length === 3,
  "all hides chatter",
);
assert(
  log.getEntries().filter((e) => entryMatchesFilter(e, "alarms")).length === 1,
  "alarms filter",
);
const exported = log.exportText("raw");
assert(exported.includes("ALARM:1") && exported.includes("hello"), "export");
assert(/T\d{2}:\d{2}:\d{2}\.\d{3}Z/.test(exported), "export includes ISO time");
const serialOut = log.exportSerialTranscript();
assert(serialOut.includes("ALARM:1") && !serialOut.includes("hello"), "serial transcript");

// --- Mock Alarm / unlock / instrument ---------------------------------------

const transport = createMockTransport();
const instrumented = instrumentTransport(transport, log);
const client = createGrblClient(instrumented, {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});

await client.connect({ path: "MOCK://grbl-demo" });
await new Promise((r) => setTimeout(r, 40));

await client.sendLine("$Alarm");
await new Promise((r) => setTimeout(r, 60));
assert(client.transport.isOpen, "still open");

let latest = "";
const unsub = client.onStatus((s) => {
  latest = s.state;
});
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest === "Alarm", `expected Alarm, got ${latest}`);

await client.sendLine("G0 X1");
await new Promise((r) => setTimeout(r, 40));
const entries = log.getEntries();
assert(
  entries.some((e) => e.kind === "alarm" && /^ALARM:/i.test(e.text)),
  "ALARM: line logged",
);
assert(
  entries.some((e) => e.kind === "alarm" && /error:\s*Alarm/i.test(e.text)),
  "alarm lock error logged as alarm",
);

await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 60));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest === "Idle", `expected Idle after unlock, got ${latest}`);

unsub();
await client.disconnect();

console.log("smoke-activity-safety: ok");
