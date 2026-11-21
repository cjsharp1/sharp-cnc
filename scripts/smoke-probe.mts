/**
 * Smoke: Z probe parse helpers + mock G38.2 cycle.
 * Run: npx --yes tsx scripts/smoke-probe.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  buildProbeWorkZZeroCommand,
  buildZProbeSeekCommand,
  canProbe,
  parseProbeResult,
  runZProbeCycle,
} from "../src/grbl/probe.ts";

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
  alarmed = /ALARM:4/i.test(err instanceof Error ? err.message : String(err));
}
assert(alarmed, "short seek should ALARM:4");

await client.disconnect();
console.log("smoke-probe: ok");
