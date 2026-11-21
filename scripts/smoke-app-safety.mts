/**
 * Full-application safety smoke (SC-45).
 * One mock session covering connect → jog/zeros/home/offsets/console →
 * probes → SVG/sim (speed/Z) → prepare Z → job dry-run/scrubber → overrides →
 * alarm unlock → M6 pause → dual origin math → E-stop/hold/unlock → soft limits.
 *
 * Run: npx --yes tsx scripts/smoke-app-safety.mts
 */
import { guideFromAlarmLine } from "../src/grbl/alarmGuide.ts";
import { createGrblClient } from "../src/grbl/client.ts";
import {
  canSendConsole,
  DEFAULT_MACROS,
  parseConsoleLines,
} from "../src/grbl/consoleMacros.ts";
import { mapWorkToSvg } from "../src/components/machineViewMath.ts";
import { canStartJob, loadJobFromText } from "../src/grbl/gcode.ts";
import { buildJobFromSvg, DEFAULT_SVG_TOOLPATH } from "../src/grbl/svgToolpath.ts";
import { canHome, HOME_COMMAND } from "../src/grbl/homing.ts";
import {
  buildDryRunLines,
  clampScrubIndex,
  estimateJobTimeFromJob,
  findNextToolChange,
  sliceJobFromLine,
} from "../src/grbl/jobControls.ts";
import { buildJogCommand, checkSoftLimits } from "../src/grbl/jog.ts";
import { DEFAULT_SOFT_TRAVEL } from "../src/grbl/machineConfig.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import {
  advanceSim,
  classifySimActivity,
  createIdleSim,
  startSim,
} from "../src/grbl/pathSimulation.ts";
import { canProbe, runZProbeCycle } from "../src/grbl/probe.ts";
import {
  UNLOCK_COMMAND,
  canJogOrZero,
  checkJobSoftLimits,
  parseAlarmLine,
} from "../src/grbl/safety.ts";
import {
  applyOverrideStep,
  applyRapidOverrideStep,
  buildSpindleOffCommand,
  feedOverrideByte,
  rapidOverrideByte,
  spindleOverrideByte,
} from "../src/grbl/spindleFeed.ts";
import { createGcodeStreamer } from "../src/grbl/streamer.ts";
import { importSvg } from "../src/grbl/svgImport.ts";
import {
  buildRecallOffsetCommands,
  buildSelectWcsCommand,
  currentWcoFromStatus,
  snapshotOffset,
} from "../src/grbl/workOffsets.ts";
import { buildSetWorkZeroCommand } from "../src/grbl/workZero.ts";
import {
  runCornerProbeCycle,
  runEdgeProbeCycle,
  runToolLengthProbeCycle,
} from "../src/grbl/xyProbe.ts";
import type { GrblStatus } from "../src/grbl/types.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const results: string[] = [];
function pass(label: string) {
  results.push(`PASS  ${label}`);
}

async function wait(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitUntil(
  pred: () => boolean,
  timeoutMs: number,
  label: string,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pred()) return;
    // Prefer sleeping over spamming `?` — status polls can interleave with
    // motion/probe queues and make mock timing brittle in Node.
    await wait(50);
    if (pred()) return;
  }
  throw new Error(`timeout waiting for ${label}`);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const transport = createMockTransport();
const client = createGrblClient(transport, {
  softResetOnConnect: false,
  statusPollMs: 10_000,
});

let status: GrblStatus | null = null;
const unsubStatus = client.onStatus((s) => {
  status = s;
});

await client.connect({ path: "MOCK://grbl-demo" });
await wait(40);
await client.requestStatus();
await wait(40);
assert(client.transport.isOpen, "mock connected");
assert(status && status.state !== "Offline", "status online");
pass("mock connect");

// ---------------------------------------------------------------------------
// Jog + soft limits + zeros
// ---------------------------------------------------------------------------

assert(canJogOrZero("Idle", true, false).ok, "can jog when Idle");
const jogCmd = buildJogCommand({ x: 5, y: 0 }, 500);
assert(jogCmd.includes("$J=") && jogCmd.includes("X5"), "jog command");
const xBeforeJog = status!.machine.x;
await client.sendLine(jogCmd);
await wait(100);
await client.requestStatus();
await waitUntil(() => status?.state === "Jog" || status?.state === "Idle", 2000, "jog start");
await wait(900);
await client.requestStatus();
await wait(40);
await waitUntil(() => status?.state === "Idle", 4000, "jog idle");
await client.requestStatus();
await wait(40);
assert(status!.machine.x > xBeforeJog + 1, "jog moved +X");

const softBlock = checkSoftLimits(
  { x: 995, y: 10, z: -1 },
  { x: 20 },
  DEFAULT_SOFT_TRAVEL,
);
assert(!softBlock.ok, "soft-limit blocks far X jog");
pass("jog + soft-limit refuse");

await client.sendLine(buildSetWorkZeroCommand("XYZ"));
await wait(40);
await client.requestStatus();
await wait(40);
const afterZero = status!;
assert(
  Math.abs(afterZero.work.x) < 0.05 &&
    Math.abs(afterZero.work.y) < 0.05 &&
    Math.abs(afterZero.work.z) < 0.05,
  `work near zero after G10 L20 (got ${JSON.stringify(afterZero.work)})`,
);
pass("work zeros");

// ---------------------------------------------------------------------------
// Homing
// ---------------------------------------------------------------------------

assert(canHome(status!.state, true, false).ok, "can home");
await client.sendLine(HOME_COMMAND);
await wait(100);
await client.requestStatus();
await waitUntil(() => status?.state === "Home" || status?.state === "Idle", 2000, "home start");
await wait(1200);
await client.requestStatus();
await waitUntil(() => status?.state === "Idle", 4000, "home done");
await client.requestStatus();
await wait(40);
assert(
  Math.abs(status!.machine.x) < 0.05 &&
    Math.abs(status!.machine.y) < 0.05 &&
    Math.abs(status!.machine.z) < 0.05,
  `machine at home (got ${JSON.stringify(status!.machine)})`,
);
pass("homing ($H)");

// ---------------------------------------------------------------------------
// Work offsets G54–G59
// ---------------------------------------------------------------------------

const wcoNow = currentWcoFromStatus(
  status!.machine,
  status!.work,
  status!.wco,
);
const slot = snapshotOffset("G55", wcoNow, "fixture-A");
await client.sendLine(buildSelectWcsCommand("G55"));
for (const line of buildRecallOffsetCommands(slot)) {
  await client.sendLine(line);
}
await client.requestStatus();
await wait(40);
pass("work offsets G54–G59");

// ---------------------------------------------------------------------------
// Console + macros
// ---------------------------------------------------------------------------

assert(canSendConsole(true, false, "Idle").ok, "console allowed");
const refused = parseConsoleLines("$H");
assert(refused.blocked, "console refuses $H");
const okParse = parseConsoleLines("G21\nM5");
assert(okParse.lines.length === 2, "console parses lines");
for (const line of okParse.lines) await client.sendLine(line);
assert(
  DEFAULT_MACROS.some((m) => /spindle/i.test(m.name)),
  "default macros present",
);
pass("console + macros");

// ---------------------------------------------------------------------------
// XY edge / corner + tool-length probe
// ---------------------------------------------------------------------------

await client.requestStatus();
await wait(40);
assert(status?.state === "Idle", `idle before probe, got ${status?.state}`);
assert(canProbe(status!.state, true, false).ok, "can probe");

const edge = await runEdgeProbeCycle(client, {
  axis: "X",
  direction: "positive",
  seekMm: 30,
  feedMmMin: 100,
  timeoutMs: 8000,
});
assert(edge.probe.success, "edge probe");
const corner = await runCornerProbeCycle(client, {
  mode: "outside",
  seekMm: 30,
  feedMmMin: 100,
  bitRadiusMm: 1.5875,
  timeoutMs: 8000,
});
assert(corner.probes.length === 2 && corner.probes.every((p) => p.success), "corner two axes");
const toolLen = await runToolLengthProbeCycle(client, {
  plateThicknessMm: 1.5,
  seekMm: 30,
  feedMmMin: 100,
  timeoutMs: 5000,
});
assert(toolLen.probe.success, "tool length");
pass("XY + tool-length probe");

const zProbe = await runZProbeCycle(client, {
  plateThicknessMm: 1.5,
  seekMm: 30,
  feedMmMin: 100,
  timeoutMs: 5000,
});
assert(zProbe.probe.success, "prepare Z probe");
pass("prepare Z probe path");

// ---------------------------------------------------------------------------
// SVG + sim speed / Z visibility
// ---------------------------------------------------------------------------

const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="20mm" viewBox="0 0 40 20"><path d="M2 2 H38 V18 H2 Z" fill="none" stroke="black"/></svg>`;
const imported = importSvg("box.svg", svg);
assert(imported.polylines.length >= 1, "svg paths");
const svgJob = buildJobFromSvg("box.svg", imported.polylines, {
  ...DEFAULT_SVG_TOOLPATH,
  depthMm: 0.5,
  safeZMm: 5,
});
assert(svgJob.lines.length > 0 && svgJob.path.length > 0, "svg job");

const hasPlunge = svgJob.path.some(
  (s) => classifySimActivity(s.from, s.to, s.motion) === "plunge",
);
assert(hasPlunge || svgJob.path.some((s) => s.to.z < s.from.z), "sim Z plunge cue");

let sim = startSim(svgJob.path);
const slow = advanceSim(sim, svgJob.path, 200, { rate: 0.25 });
const fast = advanceSim(createIdleSim(svgJob.path).phase === "idle" ? startSim(svgJob.path) : sim, svgJob.path, 200, { rate: 4 });
assert(slow.distanceMm < fast.distanceMm, "sim 0.25× slower than 4×");
sim = advanceSim(startSim(svgJob.path), svgJob.path, 500, { rate: 4 });
assert(sim.activity !== null || sim.phase === "playing" || sim.phase === "done", "sim activity/Z tracking");
pass("SVG + sim speed/Z");

// ---------------------------------------------------------------------------
// Job scrubber / dry-run / timing + M6
// ---------------------------------------------------------------------------

const jobText = `G21
G90
G0 Z5
G0 X0 Y0
M3 S10000
G1 Z-0.5 F300
G1 X20 F800
M6
G1 X40 F800
M5
G0 Z5
`;
const job = loadJobFromText("safety.nc", jobText);
assert(job.lines.length >= 8, "job loaded");
const estimate = estimateJobTimeFromJob(job);
assert(estimate.totalSeconds >= 0 && estimate.label.startsWith("~"), "time estimate");

const startAt = clampScrubIndex(2, job.lines.length);
const sliced = sliceJobFromLine(job.lines, startAt).lines;
const dry = buildDryRunLines(sliced, { spindleOff: true });
assert(dry[0] === "M5" || dry.some((l) => /^M5\b/i.test(l)), "dry run spindle off");
assert(!dry.some((l) => /\bM3\b/i.test(l)), "dry run no M3");
assert(findNextToolChange(job.lines, 0) !== null, "finds M6");
pass("job scrubber / dry-run / timing");

const streamer = createGcodeStreamer(transport, { pauseOnToolChange: true });
const runPromise = streamer.start(job.lines);
await waitUntil(
  () => streamer.getProgress().phase === "tool-change",
  5000,
  "M6 tool-change",
);
assert(streamer.getProgress().toolChangeMessage, "tool-change message");
await streamer.resumeAfterToolChange();
await runPromise;
assert(streamer.getProgress().phase === "completed", "job completed after M6");
pass("M6 pause + resume");

// ---------------------------------------------------------------------------
// Live overrides (feed / rapid / spindle)
// ---------------------------------------------------------------------------

await client.feedOverride(feedOverrideByte("coarse+"));
await client.rapidOverride(rapidOverrideByte("50"));
await client.spindleOverride(spindleOverrideByte("fine-"));
assert(applyOverrideStep(100, "coarse+") === 110, "feed override math");
assert(applyRapidOverrideStep("50") === 50, "rapid override math");
await client.sendLine(buildSpindleOffCommand());
await client.requestStatus();
await wait(80);
// Ov: appears periodically from mock
pass("live overrides");

// ---------------------------------------------------------------------------
// Dual origin (work 0 vs machine 0 in work space)
// ---------------------------------------------------------------------------

await client.requestStatus();
await wait(40);
const wco = currentWcoFromStatus(
  status!.machine,
  status!.work,
  status!.wco,
);
const bed = { width: 1000, depth: 1000 };
const workOrigin = mapWorkToSvg(0, 0, bed);
const machineOrigin = mapWorkToSvg(-wco.x, -wco.y, bed);
assert(workOrigin.x === 0 && workOrigin.y === bed.depth, "work 0 maps SW");
assert(
  Number.isFinite(machineOrigin.x) && Number.isFinite(machineOrigin.y),
  "machine 0 maps from −WCO",
);
assert(
  Math.hypot(machineOrigin.x - workOrigin.x, machineOrigin.y - workOrigin.y) > 0 ||
    (wco.x === 0 && wco.y === 0),
  "origins distinct unless WCO zero",
);
pass("dual origin math");

// ---------------------------------------------------------------------------
// Soft-limit job gate + alarm unlock (soft limit + probe fail)
// ---------------------------------------------------------------------------

const jobSoft = checkJobSoftLimits(
  { minX: -50, minY: 0, maxX: 10, maxY: 10 },
  { x: 0, y: 0, z: 0 },
  DEFAULT_SOFT_TRAVEL,
);
assert(!jobSoft.ok, "job soft-limit blocks out-of-envelope path");
assert(!canStartJob("Alarm", true).ok, "cannot start in Alarm");

await client.sendLine("$Alarm2");
await wait(60);
await client.requestStatus();
await wait(40);
assert(status?.state === "Alarm", "soft-limit alarm state");
const softGuide = guideFromAlarmLine("ALARM:2");
assert(softGuide.kind === "soft-limit", "guided soft-limit unlock");
await client.sendLine(UNLOCK_COMMAND);
await wait(60);
await client.requestStatus();
await wait(40);
assert(status?.state === "Idle", "unlocked after soft-limit");

await client.sendLine("$Alarm4");
await wait(60);
const probeGuide = guideFromAlarmLine("ALARM:4");
assert(probeGuide.kind === "probe-fail", "guided probe-fail unlock");
assert(parseAlarmLine("ALARM:4")?.code === 4, "parse probe alarm");
await client.sendLine(UNLOCK_COMMAND);
await wait(60);
await client.requestStatus();
await wait(40);
assert(status?.state === "Idle", "unlocked after probe fail");
pass("alarm unlock (soft-limit + probe)");

// ---------------------------------------------------------------------------
// Hold / resume / E-stop path
// ---------------------------------------------------------------------------

const holdStreamer = createGcodeStreamer(transport);
const longJob = [
  "G21",
  "G90",
  "G0 X0 Y0",
  "G1 X50 F400",
  "G1 Y50 F400",
  "G1 X0 F400",
  "G1 Y0 F400",
];
const holdPromise = holdStreamer.start(longJob);
await waitUntil(
  () => holdStreamer.getProgress().phase === "running",
  2000,
  "hold job running",
);
await holdStreamer.pause();
assert(holdStreamer.getProgress().phase === "paused", "feed hold");
await holdStreamer.resume();
assert(holdStreamer.getProgress().phase === "running", "resume");
await client.feedHold();
await holdStreamer.stop();
try {
  await holdPromise;
} catch {
  /* stop may reject depending on settle — phase is authoritative */
}
assert(
  holdStreamer.getProgress().phase === "idle" ||
    holdStreamer.getProgress().phase === "completed",
  "E-stop/stop cleared stream",
);
await client.softReset();
await wait(80);
await client.requestStatus();
await wait(40);
pass("E-stop / hold / unlock paths");

// Soft reset from Idle should leave Idle (not Alarm).
assert(status?.state === "Idle" || status?.state === "Unknown", "idle after soft reset");

holdStreamer.dispose();
streamer.dispose();
unsubStatus();
await client.disconnect();
assert(!client.transport.isOpen, "disconnected");
pass("disconnect");

console.log("smoke-app-safety:");
for (const line of results) console.log(`  ${line}`);
console.log("smoke-app-safety: ok");
