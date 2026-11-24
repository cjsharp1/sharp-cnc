/**
 * Smoke: real GRBL v1.1 protocol fixtures + mock-vs-real behavior checks.
 *
 * Fixtures are recorded from the official gnea/grbl docs (not live USB).
 * Default Virtual CNC assertions document intentional deltas; strict mode
 * must match real 1.1h for every row in docs/mock-vs-real-grbl.md (T2).
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

// App guide follows the official polarity.
const guide4 = guideFromAlarmLine("ALARM:4");
assert(guide4.kind === "probe-fail", "guide ALARM:4 probe");
pass("alarm guide accepts ALARM:4");

// --- 2. Mock behavior: default Virtual CNC + strict GRBL (T2) ----------------

type MockMode = "default" | "strict";

async function runMockBehaviorChecks(mode: MockMode): Promise<void> {
  const strict = mode === "strict";
  console.log(`smoke-real-grbl: mock vs real (${mode})`);

  const transport = createMockTransport(strict ? { strict: true } : {});
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
  pass(`[${mode}] welcome banner`);

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
  pass(`[${mode}] status report (?)`);

  // Invalid g-code: default human string; strict error:20
  rxBuffer.length = 0;
  await client.sendLine("G38.2"); // probe with no axis → error
  await new Promise((r) => setTimeout(r, 60));
  const badProbeErr = rxBuffer.find((l) => /^error:/i.test(l));
  assert(badProbeErr, "invalid probe emits error");
  if (strict) {
    assert(
      badProbeErr === "error:20",
      `strict invalid gcode → error:20, got ${badProbeErr}`,
    );
  } else {
    assert(
      badProbeErr === "error:Invalid gcode",
      `MOCK DIFF: human error string (${badProbeErr}); real would be error:20/33`,
    );
    assert(
      !REAL_ERROR_LINES.includes(badProbeErr),
      "mock error string is not a real numeric code",
    );
  }
  pass(`[${mode}] error response form`);

  // Alarm lock: default `error:Alarm lock`; strict `error:9`
  rxBuffer.length = 0;
  await client.sendLine("$Alarm");
  await new Promise((r) => setTimeout(r, 60));
  assert(rxBuffer.some((l) => /^ALARM:1$/i.test(l)), "mock $Alarm → ALARM:1");
  assert(
    MOCK_ONLY_COMMANDS.includes("$Alarm"),
    "$Alarm is mock-only (never send to Demon Shield)",
  );
  assert(
    MOCK_ONLY_COMMANDS.includes("$ExtLimitX") &&
      MOCK_ONLY_COMMANDS.includes("$ExtLimitY") &&
      MOCK_ONLY_COMMANDS.includes("$ExtLimitZ"),
    "$ExtLimit* are mock-only (never send to Demon Shield)",
  );

  rxBuffer.length = 0;
  await client.sendLine("G0 X1");
  await new Promise((r) => setTimeout(r, 50));
  const lockErr = rxBuffer.find((l) => /^error:/i.test(l));
  assert(lockErr, "alarm lock refuses G0");
  if (strict) {
    assert(
      lockErr === REAL_BEHAVIOR_NOTES.alarmLockError,
      `strict alarm lock → ${REAL_BEHAVIOR_NOTES.alarmLockError}, got ${lockErr}`,
    );
  } else {
    assert(
      /error:\s*Alarm lock/i.test(lockErr),
      `MOCK DIFF: ${lockErr}; real = ${REAL_BEHAVIOR_NOTES.alarmLockError}`,
    );
    assert(lockErr !== "error:9", "mock does not emit numeric error:9");
  }
  pass(`[${mode}] alarm lock error`);

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
  pass(`[${mode}] unlock ($X)`);

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
  pass(`[${mode}] soft limits on G-code (ALARM:2 ≈ real)`);

  // Soft limits: jog — default ALARM:2; strict error:15 + Idle
  rxBuffer.length = 0;
  await client.sendLine("$J=G91 X-5 F500");
  await new Promise((r) => setTimeout(r, 120));
  if (strict) {
    assert(
      rxBuffer.some((l) => l === "error:15"),
      "strict soft-limit jog → error:15",
    );
    assert(
      !rxBuffer.some((l) => /^ALARM:/i.test(l)),
      "strict soft-limit jog does not raise Alarm",
    );
    await client.requestStatus();
    await new Promise((r) => setTimeout(r, 60));
    assert(
      latest?.state === "Idle",
      `strict soft-limit jog stays Idle, got ${latest?.state}`,
    );
  } else {
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
  }
  pass(`[${mode}] soft limits on jog`);

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
  pass(`[${mode}] feed hold (!) during Run`);

  // Soft-reset (0x18) while Idle — default zeros; strict retains MPos
  rxBuffer.length = 0;
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

  const xBefore = beforeReset.machine.x;
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
  if (strict) {
    assert(
      Math.abs(latest!.machine.x - xBefore) < 0.05,
      `strict Idle soft-reset retains MPos (before=${xBefore}, after=${latest!.machine.x})`,
    );
  } else {
    assert(
      Math.abs(latest!.machine.x) < 0.05 &&
        Math.abs(latest!.machine.y) < 0.05 &&
        Math.abs(latest!.machine.z) < 0.05,
      "MOCK DIFF: soft-reset zeros MPos; real Idle reset retains position",
    );
  }
  pass(`[${mode}] soft-reset (0x18) Idle path`);

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
  pass(`[${mode}] soft-reset from Alarm`);

  // Feed hold during Jog: default Hold; strict (and holdDuringJogCancels) → Idle
  await client.sendLine("$J=G91 X200 F500");
  let sawJog = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 30));
    await client.requestStatus().catch(() => undefined);
    if (latest?.state === "Jog") {
      sawJog = true;
      break;
    }
  }
  assert(sawJog, `expected Jog before hold, got ${latest?.state}`);
  await client.feedHold();
  await new Promise((r) => setTimeout(r, 60));
  await client.requestStatus().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 40));
  if (strict) {
    assert(
      latest?.state === "Idle",
      `strict hold during jog → Idle, got ${latest?.state}`,
    );
  } else {
    assert(
      latest?.state === "Hold",
      `default hold during jog → Hold, got ${latest?.state}`,
    );
    await client.softReset();
    await new Promise((r) => setTimeout(r, 60));
  }
  pass(`[${mode}] feed hold during Jog`);

  // Feed hold while Idle: default ignored; strict → Hold
  await client.requestStatus().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 40));
  assert(latest?.state === "Idle", `need Idle before Idle-hold, got ${latest?.state}`);
  await client.feedHold();
  await new Promise((r) => setTimeout(r, 60));
  await client.requestStatus().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 40));
  if (strict) {
    assert(
      latest?.state === "Hold",
      `strict hold while Idle → Hold, got ${latest?.state}`,
    );
    await client.cycleStart();
    await new Promise((r) => setTimeout(r, 40));
    await client.requestStatus().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 40));
    assert(
      latest?.state === "Idle",
      `strict resume from Idle-hold → Idle, got ${latest?.state}`,
    );
  } else {
    assert(
      latest?.state === "Idle",
      `default hold while Idle ignored, got ${latest?.state}`,
    );
  }
  pass(`[${mode}] feed hold while Idle`);

  // Probe alarm polarity on mock now matches official GRBL 1.1:
  // ALARM:4 = probe not in expected initial state (wrong-way / already touching).
  rxBuffer.length = 0;
  await client.sendLine("G91");
  await client.sendLine("G38.2 Z0 F50"); // zero-length seek → probe already "at" contact → initial-state fault
  await new Promise((r) => setTimeout(r, 200));
  const earlyAlarm = rxBuffer.find((l) => /^ALARM:\d+/i.test(l));
  assert(earlyAlarm === "ALARM:4", `wrong-state probe should be ALARM:4, got ${earlyAlarm}`);
  await client.sendLine(UNLOCK_COMMAND);
  await new Promise((r) => setTimeout(r, 50));
  pass(`[${mode}] probe alarm codes match official 4/5 polarity`);

  unsubStatus();
  unsubRx();
  await client.disconnect();
}

await runMockBehaviorChecks("default");
await runMockBehaviorChecks("strict");

console.log("smoke-real-grbl: ok");
