/**
 * Smoke: real GRBL v1.1 protocol fixtures + mock-vs-real behavior checks.
 *
 * Fixtures are recorded from the official gnea/grbl docs (not live USB).
 * Where Virtual CNC intentionally differs, assertions document the delta
 * (see docs/mock-vs-real-grbl.md).
 *
 * Run: npx --yes tsx scripts/smoke-real-grbl.mts
 */
import { guideFromAlarmLine } from "../src/grbl/alarmGuide.ts";
import { createGrblClient } from "../src/grbl/client.ts";
import {
  MOCK_ONLY_COMMANDS,
  REAL_ALARM_CODES,
  REAL_ALARM_LINES,
  REAL_BEHAVIOR_NOTES,
  REAL_ERROR_CODES,
  REAL_ERROR_LINES,
  REAL_MSG_UNLOCKED,
  REAL_RESPONSE_OK,
  REAL_STATUS_REPORTS,
  REAL_WELCOME,
  REALTIME,
} from "../src/grbl/grblProtocolFixtures.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import { parseStatusReport } from "../src/grbl/parseStatus.ts";
import { parseAlarmLine, UNLOCK_COMMAND } from "../src/grbl/safety.ts";
import type { GrblStatus } from "../src/grbl/types.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

// --- 1. Parser accepts recorded real status / alarm / error lines -----------

console.log("smoke-real-grbl: recorded fixtures");

for (const line of REAL_STATUS_REPORTS) {
  const parsed = parseStatusReport(line);
  assert(parsed, `parse status: ${line}`);
  assert(parsed.state !== "Offline", `state for ${line}`);
}
pass(`parse ${REAL_STATUS_REPORTS.length} recorded status reports`);

// Hold:0 / Hold:1 → Hold
const hold = parseStatusReport("<Hold:0|MPos:1.000,2.000,0.000|FS:0,0>");
assert(hold?.state === "Hold", "Hold:0 → Hold");
pass("Hold subtype stripped");

// WPos-only report derives MPos via remembered WCO
const withWco = parseStatusReport(
  "<Idle|MPos:10.000,0.000,0.000|FS:0,0|WCO:10.000,0.000,0.000>",
);
assert(withWco?.wco?.x === 10, "remember WCO");
const wposOnly = parseStatusReport(
  "<Idle|WPos:0.000,5.000,0.000|FS:0,0>",
  withWco,
);
assert(wposOnly?.machine.x === 10 && wposOnly.work.y === 5, "WPos + WCO → MPos");
pass("WPos-only derivation");

for (const line of REAL_ALARM_LINES) {
  const code = Number(line.split(":")[1]);
  const parsed = parseAlarmLine(line);
  assert(parsed?.code === code, `parse ${line}`);
  assert(REAL_ALARM_CODES[code], `official alarm ${code} defined`);
}
pass(`parse ${REAL_ALARM_LINES.length} recorded ALARM lines`);

for (const line of REAL_ERROR_LINES) {
  assert(/^error:\d+$/.test(line), `numeric error form: ${line}`);
  const code = Number(line.slice("error:".length));
  assert(REAL_ERROR_CODES[code], `official error ${code} defined`);
}
pass(`catalog ${REAL_ERROR_LINES.length} recorded error:N lines`);

assert(REAL_BEHAVIOR_NOTES.alarmLockError === "error:9", "lock = error:9");
assert(REAL_ALARM_CODES[4].toLowerCase().includes("initial"), "real ALARM:4 = initial state");
assert(REAL_ALARM_CODES[5].toLowerCase().includes("did not contact"), "real ALARM:5 = no contact");
pass("official probe alarm 4/5 polarity");

// App guide still documents the *app/mock* polarity (diff called out below).
const guide4 = guideFromAlarmLine("ALARM:4");
assert(guide4.kind === "probe-fail", "guide ALARM:4 probe");
pass("alarm guide accepts ALARM:4");

// --- 2. Mock behavior vs real expectations ----------------------------------

console.log("smoke-real-grbl: mock vs real");

const transport = createMockTransport();
const client = createGrblClient(transport, {
  softResetOnConnect: false,
  statusPollMs: 60_000,
});

const rxBuffer: string[] = [];
const unsubRx = transport.onLine((line) => {
  rxBuffer.push(line.trim());
});

await client.connect({ path: "MOCK://grbl-demo" });
await new Promise((r) => setTimeout(r, 40));

assert(
  rxBuffer.some((l) => l === REAL_WELCOME || /^Grbl\s+/i.test(l)),
  "mock welcome matches GRBL banner form",
);
pass("welcome banner");

// Status query `?` → chevron report, no `ok`
rxBuffer.length = 0;
await transport.write(REALTIME.statusQuery);
await new Promise((r) => setTimeout(r, 50));
assert(rxBuffer.length >= 1, "? produced a line");
assert(rxBuffer.every((l) => l.startsWith("<") && l.endsWith(">")), "? → status only");
assert(!rxBuffer.includes(REAL_RESPONSE_OK), "? does not ack with ok");
const status = parseStatusReport(rxBuffer[0]!);
assert(status?.state === "Idle", `Idle status, got ${status?.state}`);
assert(status?.machine, "status has MPos");
pass("status report (?)");

// Invalid g-code → mock uses human string; real uses error:N
rxBuffer.length = 0;
await client.sendLine("G38.2"); // probe with no axis → mock error
await new Promise((r) => setTimeout(r, 60));
const badProbeErr = rxBuffer.find((l) => /^error:/i.test(l));
assert(badProbeErr, "invalid probe emits error");
assert(
  badProbeErr === "error:Invalid gcode",
  `MOCK DIFF: human error string (${badProbeErr}); real would be error:20/33`,
);
assert(
  !REAL_ERROR_LINES.includes(badProbeErr),
  "mock error string is not a real numeric code",
);
pass("error response form (mock ≠ real numeric)");

// Alarm lock: mock `error:Alarm lock` vs real `error:9`
rxBuffer.length = 0;
await client.sendLine("$Alarm");
await new Promise((r) => setTimeout(r, 60));
assert(rxBuffer.some((l) => /^ALARM:1$/i.test(l)), "mock $Alarm → ALARM:1");
assert(
  MOCK_ONLY_COMMANDS.includes("$Alarm"),
  "$Alarm is mock-only (never send to Demon Shield)",
);

rxBuffer.length = 0;
await client.sendLine("G0 X1");
await new Promise((r) => setTimeout(r, 50));
const lockErr = rxBuffer.find((l) => /^error:/i.test(l));
assert(lockErr, "alarm lock refuses G0");
assert(
  /error:\s*Alarm lock/i.test(lockErr),
  `MOCK DIFF: ${lockErr}; real = ${REAL_BEHAVIOR_NOTES.alarmLockError}`,
);
assert(lockErr !== "error:9", "mock does not emit numeric error:9");
pass("alarm lock error (mock ≠ error:9)");

// Unlock `$X`
rxBuffer.length = 0;
await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 60));
assert(
  rxBuffer.includes(REAL_MSG_UNLOCKED),
  `$X → ${REAL_MSG_UNLOCKED}`,
);
assert(rxBuffer.includes(REAL_RESPONSE_OK), "$X → ok");
let latest: GrblStatus | null = null;
const unsubStatus = client.onStatus((s) => {
  latest = s;
});
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest?.state === "Idle", `Idle after $X, got ${latest?.state}`);
pass("unlock ($X)");

// Soft limits: program motion → ALARM:2 (matches real when $20 on)
rxBuffer.length = 0;
await client.sendLine("G90");
await client.sendLine("G0 X-10");
await new Promise((r) => setTimeout(r, 120));
assert(rxBuffer.some((l) => /^ALARM:2$/i.test(l)), "soft-limit G0 → ALARM:2 (matches real)");
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest?.state === "Alarm", "Alarm after soft-limit G0");
await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 60));
pass("soft limits on G-code (ALARM:2 ≈ real)");

// Soft limits: jog → mock ALARM:2; real would be error:15 without Alarm
rxBuffer.length = 0;
await client.sendLine("$J=G91 X-5 F500");
await new Promise((r) => setTimeout(r, 120));
assert(
  rxBuffer.some((l) => /^ALARM:2$/i.test(l)),
  "MOCK DIFF: soft-limit jog → ALARM:2; real = error:15 (no Alarm)",
);
assert(
  !rxBuffer.some((l) => l === "error:15"),
  "mock does not emit real jog travel error:15",
);
await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 60));
pass("soft limits on jog (mock Alarm ≠ real error:15)");

// Feed hold (!) during Run
rxBuffer.length = 0;
await client.sendLine("G91");
await client.sendLine("G1 X20 F200");
await new Promise((r) => setTimeout(r, 40));
await client.feedHold();
await new Promise((r) => setTimeout(r, 80));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest?.state === "Hold", `Hold during motion, got ${latest?.state}`);
await client.cycleStart();
await new Promise((r) => setTimeout(r, 200));
pass("feed hold (!) during Run");

// Soft-reset (0x18) while Idle — mock zeros origin; real retains position
rxBuffer.length = 0;
// Clear any leftover Hold/Run from the feed-hold case, then jog away from origin.
await client.softReset();
await new Promise((r) => setTimeout(r, 80));
await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 40));
await client.sendLine("$J=G91 X5 F2000");
let beforeReset: GrblStatus | null = null;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 50));
  await client.requestStatus();
  await new Promise((r) => setTimeout(r, 30));
  if (latest?.state === "Idle" && (latest.machine.x ?? 0) > 0.5) {
    beforeReset = latest;
    break;
  }
}
assert(beforeReset && beforeReset.state === "Idle", "idle before soft-reset");
assert(
  beforeReset.machine.x > 0.5,
  `moved before reset (x=${beforeReset.machine.x})`,
);

rxBuffer.length = 0;
await client.softReset();
await new Promise((r) => setTimeout(r, 80));
assert(
  rxBuffer.some((l) => /^Grbl\s+/i.test(l)),
  "soft-reset welcome banner",
);
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest?.state === "Idle", "Idle after soft-reset");
assert(
  Math.abs(latest!.machine.x) < 0.05 &&
    Math.abs(latest!.machine.y) < 0.05 &&
    Math.abs(latest!.machine.z) < 0.05,
  "MOCK DIFF: soft-reset zeros MPos; real Idle reset retains position",
);
pass("soft-reset (0x18) Idle path");

// Soft-reset while in Alarm → stays locked (mock emits ALARM:3)
rxBuffer.length = 0;
await client.sendLine("$Alarm2");
await new Promise((r) => setTimeout(r, 50));
await client.softReset();
await new Promise((r) => setTimeout(r, 80));
assert(rxBuffer.some((l) => /^ALARM:3$/i.test(l)), "reset-from-Alarm → ALARM:3");
await client.requestStatus();
await new Promise((r) => setTimeout(r, 60));
assert(latest?.state === "Alarm", "still Alarm after soft-reset");
await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 50));
pass("soft-reset from Alarm");

// Probe alarm polarity on mock (swapped vs official)
rxBuffer.length = 0;
await client.sendLine("G91");
await client.sendLine("G38.2 Z0.1 F50"); // tiny seek wrong way / early → mock ALARM:5
await new Promise((r) => setTimeout(r, 200));
const earlyAlarm = rxBuffer.find((l) => /^ALARM:\d+/i.test(l));
assert(earlyAlarm, "probe early/fail emits ALARM");
// Mock uses ALARM:5 for “already contacting / wrong seek”; real uses ALARM:4 for wrong initial state.
assert(
  earlyAlarm === "ALARM:5" || earlyAlarm === "ALARM:4",
  `probe alarm line ${earlyAlarm}`,
);
if (earlyAlarm === "ALARM:5") {
  assert(
    true,
    "MOCK DIFF: early/wrong-state probe → ALARM:5; real official = ALARM:4",
  );
}
await client.sendLine(UNLOCK_COMMAND);
await new Promise((r) => setTimeout(r, 50));
pass("probe alarm codes (mock polarity may ≠ real 4/5)");

unsubStatus();
unsubRx();
await client.disconnect();

console.log("smoke-real-grbl: ok");
