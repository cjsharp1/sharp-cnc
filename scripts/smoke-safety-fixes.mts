/**
 * Smoke: safety fixes from docs/specs/app-review-2026-11.md
 * - Z soft envelope (home at top, negative travel) and no reversed jogs
 * - Streamer settles on ALARM / error and holds motion on error
 * - Probe timeout covers the full seek
 * - Job pre-flight checks Z and arc extents; G53 skipped
 * - Resume preamble restores spindle / units / offsets
 * - Dry run keeps line count and lifts Z above the stock
 * Run: npx --yes tsx scripts/smoke-safety-fixes.mts
 */
import { checkSoftLimits, clampJogDelta } from "../src/grbl/jog.ts";
import { DEFAULT_SOFT_TRAVEL, maxForAxis, minForAxis } from "../src/grbl/machineConfig.ts";
import { probeTimeoutMs, DEFAULT_PROBE_CONFIG } from "../src/grbl/probe.ts";
import { createGcodeStreamer } from "../src/grbl/streamer.ts";
import { extractToolpath } from "../src/grbl/gcode.ts";
import { checkJobSoftLimits } from "../src/grbl/safety.ts";
import {
  buildResumePreamble,
  dryRunJobLines,
  dryRunLiftMm,
  scanResumeState,
} from "../src/grbl/jobControls.ts";
import type { SerialTransport } from "../src/grbl/transport.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const pass = (m: string) => console.log(`  ✓ ${m}`);

// --- Z soft envelope ---------------------------------------------------------
const limits = { ...DEFAULT_SOFT_TRAVEL, maxZ: 80, min: { x: 0, y: 0, z: 0 } };
assert(maxForAxis(limits, "Z") === 0, "Z top is home (0)");
assert(minForAxis(limits, "Z") === -80, "Z bottom is -$132");
assert(
  minForAxis({ ...limits, maxZ: null }, "Z") === -Infinity,
  "unknown Z travel leaves the bottom open",
);
pass("Z range is [-$132, 0]");

let c = clampJogDelta({ x: 100, y: 100, z: 0 }, { z: -5 }, limits);
assert(c.delta.z === -5 && !c.clamped, `homed Z can jog down: ${JSON.stringify(c)}`);
c = clampJogDelta({ x: 100, y: 100, z: -10 }, { z: -5 }, limits);
assert(c.delta.z === -5, `Z -10 jog down stays down: ${JSON.stringify(c)}`);
c = clampJogDelta({ x: 100, y: 100, z: -2 }, { z: 5 }, limits);
assert(c.delta.z === 2 && c.clamped, `jog up clamps at home: ${JSON.stringify(c)}`);
c = clampJogDelta({ x: 100, y: 100, z: -78 }, { z: -5 }, limits);
assert(Math.abs((c.delta.z ?? 0) + 2) < 1e-9, `jog down clamps at bottom: ${JSON.stringify(c)}`);
assert(checkSoftLimits({ x: 100, y: 100, z: -10 }, { z: 5 }, limits).ok, "Z +5 from -10 allowed");
assert(!checkSoftLimits({ x: 100, y: 100, z: -2 }, { z: 5 }, limits).ok, "Z +5 from -2 refused");
pass("Z jogs move the way they were asked and clamp at home/bottom");

// Never reverse: start outside range on every axis, jog further out.
for (const [axis, start, d] of [
  ["x", { x: -5, y: 10, z: -10 }, -1],
  ["y", { x: 10, y: 1200, z: -10 }, 1],
  ["z", { x: 10, y: 10, z: 3 }, 1],
  ["z", { x: 10, y: 10, z: -90 }, -1],
] as const) {
  const r = clampJogDelta(start, { [axis]: d }, limits);
  const out = r.delta[axis] ?? 0;
  assert(out === 0 || Math.sign(out) === Math.sign(d), `${axis} not reversed: ${JSON.stringify(r)}`);
}
pass("clamp never reverses a jog");

// --- Streamer settles on ALARM / error --------------------------------------
function fakeTransport() {
  const handlers = new Set<(line: string) => void>();
  const written: string[] = [];
  const t = {
    isOpen: true,
    async write(data: string | Uint8Array) {
      written.push(typeof data === "string" ? data : `<0x${data[0]!.toString(16)}>`);
    },
    onLine(h: (line: string) => void) {
      handlers.add(h);
      return () => handlers.delete(h);
    },
    onEvent() {
      return () => undefined;
    },
    async open() {},
    async close() {},
  } as unknown as SerialTransport;
  return { t, written, emit: (l: string) => handlers.forEach((h) => h(l)) };
}

{
  const f = fakeTransport();
  let last = "";
  const s = createGcodeStreamer(f.t, { onProgress: (p) => (last = p.lastError ?? last) });
  const started = s.start(["G0 X1", "G0 X2", "G0 X3"]);
  await new Promise((r) => setTimeout(r, 10));
  f.emit("ok");
  f.emit("ALARM:2");
  f.emit("<Alarm|MPos:1.000,0.000,0.000|FS:0,0>");
  const outcome = await Promise.race([
    started.then(() => "resolved", (e: Error) => `rejected:${e.message}`),
    new Promise((r) => setTimeout(() => r("hung"), 500)),
  ]);
  assert(outcome === "rejected:ALARM:2", `alarm rejects start(): ${outcome}`);
  assert(last === "ALARM:2", `keeps first alarm, not status text: ${last}`);
  pass("ALARM mid-job rejects the job and keeps the alarm code");
}

{
  const f = fakeTransport();
  const s = createGcodeStreamer(f.t);
  const started = s.start(["G0 X1", "G1 X2 F100", "G0 X3"], {
    startIndex: 1,
    preamble: ["G21 G90", "M3 S10000"],
  });
  await new Promise((r) => setTimeout(r, 10));
  f.emit("ok"); // G21 G90
  f.emit("ok"); // M3
  f.emit("error:20"); // job line 2 (index 1)
  const outcome = await started.then(() => "resolved", (e: Error) => e.message);
  assert(/^error:20 on line 2: G1 X2 F100$/.test(outcome), `error names job line: ${outcome}`);
  assert(f.written.includes("!"), "feed hold sent on G-code error");
  pass("G-code error rejects the job, names the real line, and holds motion");
}

// --- Probe timeout -----------------------------------------------------------
{
  const d = DEFAULT_PROBE_CONFIG;
  const seekMs = (d.seekMm / d.feedMmMin) * 60_000;
  assert(probeTimeoutMs(d.seekMm, d.feedMmMin) > seekMs, "timeout longer than full seek");
  pass(`probe timeout ${probeTimeoutMs(d.seekMm, d.feedMmMin)} ms > seek ${seekMs} ms`);
}

// --- Pre-flight: Z range, arcs, G53 -----------------------------------------
{
  const tp = extractToolpath([
    "G21 G90",
    "G0 Z15",
    "G0 X0 Y0",
    "G1 Z-3 F200",
    "G2 X20 Y0 I10 J0 F500", // clockwise half circle over the top, to Y=+10
    "G53 G0 Z0", // machine coords: ignored
  ]);
  assert(tp.zRange && tp.zRange.maxZ === 15 && tp.zRange.minZ === -3, `zRange ${JSON.stringify(tp.zRange)}`);
  assert(tp.bounds && tp.bounds.maxY >= 9.9, `arc extent in bounds ${JSON.stringify(tp.bounds)}`);
  assert(tp.machineCoordMoves === 1, "G53 move counted and skipped");
  pass("toolpath tracks Z range, arc extents, and skips G53");

  // Material Z0 at machine Z -10: a +15 retract lands 5 mm above home.
  const wco = { x: 100, y: 100, z: -10 };
  const high = checkJobSoftLimits(tp.bounds, wco, limits, tp.zRange);
  assert(!high.ok && /above Z home/.test(high.reason ?? ""), `retract above home caught: ${high.reason}`);
  const ok = checkJobSoftLimits(tp.bounds, { x: 100, y: 100, z: -40 }, limits, tp.zRange);
  assert(ok.ok, `fits when Z0 is lower: ${ok.reason}`);
  const deep = checkJobSoftLimits(tp.bounds, { x: 100, y: 100, z: -78 }, limits, tp.zRange);
  assert(!deep.ok && /below the bottom/.test(deep.reason ?? ""), `too deep caught: ${deep.reason}`);
  // Chord ends at Y=0 but the arc reaches Y=+10: with Y0 at 995 it passes 1000.
  const arc = checkJobSoftLimits(tp.bounds, { x: 100, y: 995, z: -40 }, limits, tp.zRange);
  assert(!arc.ok && /Job Y/.test(arc.reason ?? ""), `arc past Y far end caught: ${arc.reason}`);
  pass("pre-flight catches retract above home, too-deep cuts, and arcs past travel");
}

// --- Resume preamble ---------------------------------------------------------
{
  const job = [
    "G21 G90 G54",
    "M3 S12000",
    "G0 Z5",
    "G0 X10 Y10",
    "G1 Z-2 F300",
    "G1 X40 F1200",
    "G1 Y40",
    "G1 X10",
  ];
  const st = scanResumeState(job, 6);
  assert(st.spindle === "M3" && st.spindleSpeed === 12000, "spindle state recovered");
  assert(st.position.x === 40 && st.position.y === 10 && st.position.z === -2, `position ${JSON.stringify(st.position)}`);
  const pre = buildResumePreamble(job, 6, { clearanceZMm: 5 });
  assert(pre.includes("M3 S12000"), `preamble spins up: ${pre.join(" | ")}`);
  assert(pre.indexOf("G0 Z5") < pre.indexOf("G0 X40 Y10"), "retract before XY move");
  assert(pre.indexOf("M3 S12000") < pre.findIndex((l) => l.startsWith("G1 Z-2")), "spin up before plunge");
  assert(pre.includes("G54"), "work offset restored");
  assert(buildResumePreamble(job, 0, { clearanceZMm: 5 }).length === 0, "no preamble from the top");
  const inch = buildResumePreamble(["G20 G91", "G1 X1 F10"], 2, { clearanceZMm: 5 });
  assert(inch.at(-3) === "G20" && inch.at(-2) === "G91", `inch + relative restored: ${inch.join(" | ")}`);
  pass("resume preamble restores state and enters safely");
}

// --- Dry run -----------------------------------------------------------------
{
  const job = ["G21 G90", "M3 S12000", "G0 Z5", "G1 Z-3 F200", "S8000", "G1 X10"];
  const lift = dryRunLiftMm({ minZ: -3, maxZ: 5 });
  assert(lift === 8, `lift keeps deepest point 5 mm above Z0: ${lift}`);
  const dry = dryRunJobLines(job, lift);
  assert(dry.length === job.length, "dry run keeps line count");
  assert(!dry.some((l) => /\bM0*[34]\b|\bS\d/i.test(l)), `no spindle-on: ${dry.join(" | ")}`);
  assert(dry[3] === "G1 Z5 F200", `Z lifted: ${dry[3]}`);
  const inchDry = dryRunJobLines(["G20 G90", "G1 Z-0.1"], 25.4);
  assert(inchDry[1] === "G1 Z0.9", `inch lift converts units: ${inchDry[1]}`);
  pass("dry run lifts Z, stays spindle-off, keeps line numbers");
}

console.log("smoke-safety-fixes: ok");
