/**
 * Smoke: R7 M6 tool-change spindle-safe flow
 * - Pause before M6
 * - Side commands (M5 / spindle restore) must not steal job-line oks
 * - Continue helpers: restore M3 S… + dwell from scanResumeState
 * Run: npx --yes tsx scripts/smoke-tool-change.mts
 */
import { createGcodeStreamer } from "../src/grbl/streamer.ts";
import {
  buildToolChangeSpindleRestore,
  buildToolChangeSpindleStop,
  canContinueToolChange,
} from "../src/grbl/toolChange.ts";
import { scanResumeState } from "../src/grbl/jobControls.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import { createGrblClient } from "../src/grbl/client.ts";
import type { GrblStatus } from "../src/grbl/types.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const pass = (m: string) => console.log(`  ✓ ${m}`);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(
  pred: () => boolean,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const started = Date.now();
  while (!pred()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timeout waiting for ${label}`);
    }
    await wait(25);
  }
}

// --- Pure helpers -----------------------------------------------------------
assert(buildToolChangeSpindleStop() === "M5", "spindle stop is M5");
assert(
  !canContinueToolChange({
    spindleStopped: false,
    zReprobed: true,
    sameToolLength: false,
  }),
  "continue blocked until spindle stopped",
);
assert(
  !canContinueToolChange({
    spindleStopped: true,
    zReprobed: false,
    sameToolLength: false,
  }),
  "continue blocked without re-probe or same-length",
);
assert(
  canContinueToolChange({
    spindleStopped: true,
    zReprobed: true,
    sameToolLength: false,
  }),
  "continue ok after re-probe",
);
assert(
  canContinueToolChange({
    spindleStopped: true,
    zReprobed: false,
    sameToolLength: true,
  }),
  "continue ok with same tool length",
);
assert(
  !canContinueToolChange({
    spindleStopped: true,
    zReprobed: true,
    sameToolLength: false,
    busy: true,
  }),
  "continue blocked while busy",
);

const sample = [
  "G21",
  "G90",
  "M3 S12000",
  "G0 X1",
  "G1 X10 F800",
  "M6",
  "G1 X20 F800",
  "M5",
];
const beforeM6 = scanResumeState(sample, 5);
assert(beforeM6.spindle === "M3", "scan finds M3 before M6");
assert(beforeM6.spindleSpeed === 12000, "scan finds S12000");
const restore = buildToolChangeSpindleRestore(beforeM6, 0.1);
assert(restore[0] === "M3 S12000", `restore spindle: ${restore[0]}`);
assert(/^G4 P0\.1$/.test(restore[1]!), `dwell: ${restore[1]}`);
assert(
  buildToolChangeSpindleRestore({ spindle: "M5", spindleSpeed: 1000 }).length ===
    0,
  "no restore when spindle was off",
);
pass("tool-change helpers");

// --- Streamer side-command ack hygiene --------------------------------------
const transport = createMockTransport();
const client = createGrblClient(transport, { softResetOnConnect: true });
let latest: GrblStatus | null = null;
client.onStatus((s) => {
  latest = s;
});
await client.connect();
await wait(200);

const written: string[] = [];
const origWrite = transport.write.bind(transport);
transport.write = async (data: string | Uint8Array) => {
  if (typeof data === "string") written.push(data.trim());
  else written.push(`<0x${data[0]!.toString(16)}>`);
  return origWrite(data);
};

const streamer = createGcodeStreamer(transport, { pauseOnToolChange: true });
const jobPromise = streamer.start(sample);

await waitUntil(
  () => streamer.getProgress().phase === "tool-change",
  5000,
  "tool-change phase",
);
assert(
  streamer.getProgress().toolChangeMessage &&
    /M6/i.test(streamer.getProgress().toolChangeMessage!),
  "tool-change message names M6",
);
pass("pauses before M6");

await waitUntil(
  () => (streamer.getProgress().pendingLines ?? 0) === 0,
  5000,
  "pending drain",
);
{
  const started = Date.now();
  while (latest?.state !== "Idle") {
    if (Date.now() - started > 8000) {
      throw new Error(`timeout waiting for Idle (got ${latest?.state})`);
    }
    await client.requestStatus();
    await wait(50);
  }
}
pass("Idle before spindle stop");

const ackedBeforeM5 = streamer.getProgress().ackedLines;
await streamer.sendDuringToolChange(buildToolChangeSpindleStop());
const ackedAfterM5 = streamer.getProgress().ackedLines;
assert(
  ackedAfterM5 === ackedBeforeM5,
  `M5 ok must not count as job ack (${ackedBeforeM5} → ${ackedAfterM5})`,
);
assert(
  written.some((w) => /^M5$/i.test(w)),
  "sent M5 during tool-change",
);
pass("M5 side command does not steal job acks");

{
  const ackedMid = streamer.getProgress().ackedLines;
  await streamer.sendDuringToolChange("G4 P0");
  assert(
    streamer.getProgress().ackedLines === ackedMid,
    "dwell ok must not count as job ack",
  );
}
pass("extra side oks ignored for job progress");

const restoreLines = buildToolChangeSpindleRestore(beforeM6, 0.05);
for (const line of restoreLines) {
  const before = streamer.getProgress().ackedLines;
  await streamer.sendDuringToolChange(line);
  assert(
    streamer.getProgress().ackedLines === before,
    `restore line ok must not count as job ack: ${line}`,
  );
}
assert(
  written.some((w) => /^M3\s*S12000$/i.test(w)),
  "restored M3 S12000",
);
pass("spindle restore + dwell");

await streamer.resumeAfterToolChange();
await jobPromise;
assert(streamer.getProgress().phase === "completed", "job completed after M6");
assert(
  written.some((w) => /^M6$/i.test(w)),
  "M6 sent only after Continue",
);
pass("resume after tool change completes job");

streamer.dispose();
await client.disconnect();

console.log("smoke-tool-change: ok");
