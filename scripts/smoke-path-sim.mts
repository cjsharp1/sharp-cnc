/**
 * Smoke: pre-run path simulation helpers (visualizer-only, no serial).
 * Run: npx --yes tsx scripts/smoke-path-sim.mts
 */
import type { ToolpathSegment } from "../src/grbl/gcode.ts";
import {
  advanceSim,
  createIdleSim,
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
  { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, motion: "rapid" },
  { from: { x: 100, y: 0 }, to: { x: 100, y: 50 }, motion: "feed" },
  { from: { x: 100, y: 50 }, to: { x: 0, y: 50 }, motion: "feed" },
];

assert(Math.abs(pathLength(path) - 250) < 1e-6, "path length 250 mm");

const mid = samplePathAtDistance(path, 125);
assert(Math.abs(mid.position.x - 100) < 0.01, "mid X at 100");
assert(Math.abs(mid.position.y - 25) < 0.01, "mid Y at 25");
assert(mid.motion === "feed", "mid motion is feed");
assert(mid.completedSegments === 1, "mid on second segment");

const idle = createIdleSim(path);
assert(idle.phase === "idle", "idle phase");
assert(idle.position.x === 0 && idle.position.y === 0, "idle at start");
assert(idle.progress === 0, "idle progress 0");

let sim = startSim(path);
assert(sim.phase === "playing", "start → playing");

// Advance ~1s at rapid along first 100 mm segment (400 mm/s → ~100 mm).
sim = advanceSim(sim, path, 250);
assert(sim.phase === "playing", "still playing after 250ms");
assert(sim.position.x > 50, "moved along rapid");
assert(sim.motion === "rapid" || sim.completedSegments >= 1, "rapid or past it");

sim = pauseSim(sim);
assert(sim.phase === "paused", "paused");
const pausedDist = sim.distanceMm;
sim = advanceSim(sim, path, 500);
assert(sim.distanceMm === pausedDist, "paused does not advance");

sim = resumeSim(sim);
assert(sim.phase === "playing", "resumed");

// Run long enough to finish (250 mm; feed 120 mm/s + rapid 400).
for (let i = 0; i < 80 && sim.phase === "playing"; i++) {
  sim = advanceSim(sim, path, 100);
}
assert(sim.phase === "done", "reaches done");
assert(sim.progress >= 0.999, "progress ~1");
assert(Math.abs(sim.position.x - 0) < 0.5, "ends near (0,50) X");
assert(Math.abs(sim.position.y - 50) < 0.5, "ends near (0,50) Y");

sim = stopSim(path);
assert(sim.phase === "idle", "stop → idle");
assert(sim.distanceMm === 0, "stop resets distance");

const empty = startSim([]);
assert(empty.phase === "done", "empty path finishes immediately");

console.log("smoke-path-sim: ok");
