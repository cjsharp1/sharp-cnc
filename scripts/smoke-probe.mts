/**
 * Smoke: Z probe parse helpers + Prepare continuity gate + mock G38.2 cycle.
 * Run: npx --yes tsx scripts/smoke-probe.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { MOCK_ONLY_COMMANDS } from "../src/grbl/grblProtocolFixtures.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import { parseStatusReport } from "../src/grbl/parseStatus.ts";
import {
  PROBE_CONTINUITY_HINT,
  buildProbeWorkZZeroCommand,
  buildZProbeSeekCommand,
  canProbe,
  canRunPrepareZProbe,
  parseProbeResult,
  runZProbeCycle,
} from "../src/grbl/probe.ts";
import type { GrblStatus } from "../src/grbl/types.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const prb = parseProbeResult("[PRB:10.000,20.500,-1.250:1]");
assert(prb?.success === true, "parse success");
assert(prb?.machine.x === 10 && prb?.machine.y === 20.5, "parse xy");
assert(Math.abs((prb?.machine.z ?? 0) + 1.25) < 1e-9, "parse z");
assert(parseProbeResult("[PRB:0,0,0:0]")?.success === false, "fail flag");
assert(parseProbeResult("ok") === null, "not a probe line");

assert(
  buildZProbeSeekCommand(30, 80) === "G38.2 Z-30 F80",
  `seek cmd got ${buildZProbeSeekCommand(30, 80)}`,
);
assert(
  buildProbeWorkZZeroCommand(1.5) === "G10 L20 P1 Z1.5",
  `work z got ${buildProbeWorkZZeroCommand(1.5)}`,
);

assert(canProbe("Idle", true, false).ok === true, "idle can probe");
assert(canProbe("Alarm", true, false).ok === false, "alarm blocks");
assert(canProbe("Idle", true, true).ok === false, "stream blocks");
assert(
  canProbe("Idle", true, false, { probePinActive: true }).ok === false,
  "active pin blocks",
);

// Prepare continuity gate (R4 follow-up): Probe stays locked until pin lit once.
const idleGate = canProbe("Idle", true, false);
const blocked = canRunPrepareZProbe(false, idleGate, false);
assert(blocked.ok === false, "continuity required");
assert(
  blocked.reason === PROBE_CONTINUITY_HINT,
  `continuity hint got ${blocked.reason}`,
);
const stillTouching = canRunPrepareZProbe(true, idleGate, true);
assert(stillTouching.ok === false, "pin still active blocks seek");
assert(
  /separate clip/i.test(stillTouching.reason ?? ""),
  `clear-contact reason got ${stillTouching.reason}`,
);
assert(
  canRunPrepareZProbe(true, idleGate, false).ok === true,
  "confirmed + pin clear unlocks",
);
assert(
  canRunPrepareZProbe(true, canProbe("Alarm", true, false), false).ok === false,
  "machine gate still applies after continuity",
);

// Parsed Pn:P feeds the same pin flag the UI uses for the light.
const withProbe = parseStatusReport(
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0|Pn:P>",
);
assert(withProbe?.pins?.probe === true, "Pn:P → pins.probe");
assert(withProbe?.pins?.raw.includes("P"), "Pn:P raw");
const noPins = parseStatusReport("<Idle|MPos:0.000,0.000,0.000|FS:0,0>");
assert(noPins?.pins === undefined, "omitted Pn clears pins");

assert(
  (MOCK_ONLY_COMMANDS as readonly string[]).includes("$ExtProbe"),
  "$ExtProbe listed as mock-only",
);

const transport = createMockTransport();
const client = createGrblClient(transport, {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});
await client.connect({ path: "MOCK://grbl-demo" });

const outcome = await runZProbeCycle(client, {
  plateThicknessMm: 1.5,
  seekMm: 30,
  feedMmMin: 100,
  timeoutMs: 8000,
});
assert(outcome.probe.success, "mock probe success");
assert(
  outcome.workZeroCommand === "G10 L20 P1 Z1.5",
  `expected G10 plate offset, got ${outcome.workZeroCommand}`,
);

// Short seek should alarm (mock plate ~2 mm below tip; seek 1 mm fails).
let alarmed = false;
try {
  await runZProbeCycle(client, {
    plateThicknessMm: 1.5,
    seekMm: 1,
    feedMmMin: 100,
    timeoutMs: 5000,
  });
} catch (err) {
  alarmed = /ALARM:5/i.test(err instanceof Error ? err.message : String(err));
}
assert(alarmed, "short seek should ALARM:5 (no contact)");

// Virtual CNC $ExtProbe pulses Pn:P (continuity practice — never on USB).
let last: GrblStatus | null = null;
client.onStatus((s) => {
  last = s;
});
await client.sendLine("$ExtProbe");
await new Promise((r) => setTimeout(r, 40));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(last?.pins?.probe === true, "$ExtProbe should light Pn:P");
await new Promise((r) => setTimeout(r, 950));
await client.requestStatus();
await new Promise((r) => setTimeout(r, 40));
assert(
  last?.pins?.probe !== true,
  "$ExtProbe pulse should clear so seek can unlock",
);

await client.disconnect();
console.log("smoke-probe: ok");
