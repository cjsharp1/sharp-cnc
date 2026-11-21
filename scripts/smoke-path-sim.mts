/**
 * Smoke: pre-run path simulation helpers (visualizer-only, no serial).
 * Run: npx --yes tsx scripts/smoke-path-sim.mts
 */
import type { ToolpathSegment } from "../src/grbl/gcode.ts";
import { extractToolpath } from "../src/grbl/gcode.ts";
import {
  advanceSim,
  classifySimActivity,
  createIdleSim,
  formatSimActivityLabel,
  pathLength,
  pauseSim,
  resumeSim,
  samplePathAtDistance,
  startSim,
  stopSim,
} from "../src/grbl/pathSimulation.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const path: ToolpathSegment[] = [
  { from: { x: 0, y: 0, z: 5 }, to: { x: 100, y: 0, z: 5 }, motion: "rapid" },
  { from: { x: 100, y: 0, z: 5 }, to: { x: 100, y: 0, z: -0.5 }, motion: "feed" },
  { from: { x: 100, y: 0, z: -0.5 }, to: { x: 100, y: 50, z: -0.5 }, motion: "feed" },
  { from: { x: 100, y: 50, z: -0.5 }, to: { x: 0, y: 50, z: -0.5 }, motion: "feed" },
  { from: { x: 0, y: 50, z: -0.5 }, to: { x: 0, y: 50, z: 5 }, motion: "rapid" },
];

const expectedLen =
  100 + Math.abs(5 - -0.5) + 50 + 100 + Math.abs(5 - -0.5);
assert(Math.abs(pathLength(path) - expectedLen) < 1e-6, "3D path length");

assert(
  classifySimActivity(path[1]!.from, path[1]!.to, "feed") === "plunge",
  "plunge activity",
);
assert(
  classifySimActivity(path[4]!.from, path[4]!.to, "rapid") === "retract",
  "retract activity",
);
assert(
  classifySimActivity(path[2]!.from, path[2]!.to, "feed") === "cut",
  "cut activity",
);
assert(
  formatSimActivityLabel("cut", -0.5) === "Cut Z=-0.50",
  "cut label",
);

const mid = samplePathAtDistance(path, 100 + 2.75);
assert(Math.abs(mid.position.x - 100) < 0.01, "mid X at 100");
assert(Math.abs(mid.position.y - 0) < 0.01, "mid Y at 0 during plunge");
assert(mid.position.z < 5 && mid.position.z > -0.5, "mid Z mid-plunge");
assert(mid.activity === "plunge", "mid activity plunge");
assert(mid.completedSegments === 1, "mid on plunge segment");

const idle = createIdleSim(path);
assert(idle.phase === "idle", "idle phase");
assert(idle.position.x === 0 && idle.position.y === 0, "idle at start");
assert(idle.position.z === 5, "idle Z at safe");
assert(idle.progress === 0, "idle progress 0");

let sim = startSim(path);
assert(sim.phase === "playing", "start → playing");

// Advance ~1s at rapid along first 100 mm segment (400 mm/s → ~100 mm).
sim = advanceSim(sim, path, 250);
assert(sim.phase === "playing", "still playing after 250ms");
assert(sim.position.x > 50, "moved along rapid");
assert(sim.motion === "rapid" || sim.completedSegments >= 1, "rapid or past it");

// 0.25× should move ~1/4 as far as 1× for the same dt.
const slowBase = startSim(path);
const slow = advanceSim(slowBase, path, 200, { rate: 0.25 });
const full = advanceSim(slowBase, path, 200, { rate: 1 });
assert(slow.distanceMm < full.distanceMm * 0.4, "0.25× slower than 1×");
assert(full.distanceMm > slow.distanceMm * 2, "1× faster than 0.25×");

sim = pauseSim(sim);
assert(sim.phase === "paused", "paused");
const pausedDist = sim.distanceMm;
sim = advanceSim(sim, path, 500);
assert(sim.distanceMm === pausedDist, "paused does not advance");

sim = resumeSim(sim);
assert(sim.phase === "playing", "resumed");

// Run long enough to finish (Z moves use slower SIM_Z_MM_S).
for (let i = 0; i < 200 && sim.phase === "playing"; i++) {
  sim = advanceSim(sim, path, 100, { rate: 4 });
}
assert(sim.phase === "done", "reaches done");
assert(sim.progress >= 0.999, "progress ~1");
assert(Math.abs(sim.position.x - 0) < 0.5, "ends near (0,50) X");
assert(Math.abs(sim.position.y - 50) < 0.5, "ends near (0,50) Y");
assert(Math.abs(sim.position.z - 5) < 0.05, "ends at retract Z");
assert(sim.activity === "retract", "ends on retract");

sim = stopSim(path);
assert(sim.phase === "idle", "stop → idle");
assert(sim.distanceMm === 0, "stop resets distance");

const empty = startSim([]);
assert(empty.phase === "done", "empty path finishes immediately");

// Real G-code extract keeps Z-only plunge / retract segments.
const sample = `%
G21 G90
G0 Z5
G0 X10 Y10
G1 Z-0.5 F300
G1 X50 F800
G0 Z5
M2
%`;
const lines = sample
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && l !== "%" && !l.startsWith("("));
const extracted = extractToolpath(lines);
assert(extracted.path.length >= 4, "extract keeps plunge + cut + retract");
const hasPlunge = extracted.path.some(
  (s) =>
    s.from.x === s.to.x &&
    s.from.y === s.to.y &&
    s.to.z < s.from.z,
);
const hasRetract = extracted.path.some(
  (s) =>
    s.from.x === s.to.x &&
    s.from.y === s.to.y &&
    s.to.z > s.from.z,
);
assert(hasPlunge, "extract includes plunge");
assert(hasRetract, "extract includes retract");

console.log("smoke-path-sim: ok");
