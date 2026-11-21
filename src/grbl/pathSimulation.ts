import type { PathMotion, ToolpathSegment } from "./gcode";

/** Pre-run preview phases — visualizer only; never touches serial. */
export type SimPhase = "idle" | "playing" | "paused" | "done";

export interface PathSimSnapshot {
  phase: SimPhase;
  /** Distance along path from start (mm). */
  distanceMm: number;
  /** Total path length (mm). */
  totalMm: number;
  /** Progress 0..1 along the path. */
  progress: number;
  /** Current XY in work coordinates (mm). */
  position: { x: number; y: number };
  /** Motion kind for the segment under the toolhead. */
  motion: PathMotion | null;
  /** Fully completed segment count (0..path.length). */
  completedSegments: number;
}

/** Visual preview speeds (mm/s) — faster than typical cuts for a quick look. */
export const SIM_FEED_MM_S = 120;
export const SIM_RAPID_MM_S = 400;

export function segmentLength(seg: ToolpathSegment): number {
  return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
}

export function pathLength(path: ToolpathSegment[]): number {
  let total = 0;
  for (const seg of path) total += segmentLength(seg);
  return total;
}

/** Idle snapshot at the start of the path (or origin if empty). */
export function createIdleSim(path: ToolpathSegment[]): PathSimSnapshot {
  const totalMm = pathLength(path);
  const start = path[0]?.from ?? { x: 0, y: 0 };
  return {
    phase: "idle",
    distanceMm: 0,
    totalMm,
    progress: 0,
    position: { x: start.x, y: start.y },
    motion: path[0]?.motion ?? null,
    completedSegments: 0,
  };
}

/**
 * Sample the polyline at a cumulative distance from the start.
 * Distances past the end clamp to the final point.
 */
export function samplePathAtDistance(
  path: ToolpathSegment[],
  distanceMm: number,
): {
  position: { x: number; y: number };
  motion: PathMotion | null;
  completedSegments: number;
} {
  if (path.length === 0) {
    return { position: { x: 0, y: 0 }, motion: null, completedSegments: 0 };
  }

  let remaining = Math.max(0, distanceMm);
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]!;
    const len = segmentLength(seg);
    if (len < 1e-9) {
      if (i === path.length - 1) {
        return {
          position: { x: seg.to.x, y: seg.to.y },
          motion: seg.motion,
          completedSegments: path.length,
        };
      }
      continue;
    }
    if (remaining <= len) {
      const t = remaining / len;
      return {
        position: {
          x: seg.from.x + (seg.to.x - seg.from.x) * t,
          y: seg.from.y + (seg.to.y - seg.from.y) * t,
        },
        motion: seg.motion,
        completedSegments: i,
      };
    }
    remaining -= len;
  }

  const last = path[path.length - 1]!;
  return {
    position: { x: last.to.x, y: last.to.y },
    motion: last.motion,
    completedSegments: path.length,
  };
}

export interface SimSpeeds {
  feedMmS?: number;
  rapidMmS?: number;
}

/** Advance a playing simulation by `dtMs`. No-op unless phase is `playing`. */
export function advanceSim(
  current: PathSimSnapshot,
  path: ToolpathSegment[],
  dtMs: number,
  speeds: SimSpeeds = {},
): PathSimSnapshot {
  if (current.phase !== "playing" || path.length === 0 || dtMs <= 0) {
    return current;
  }

  const totalMm = pathLength(path);
  if (totalMm < 1e-9) {
    const end = samplePathAtDistance(path, 0);
    return {
      phase: "done",
      distanceMm: 0,
      totalMm: 0,
      progress: 1,
      position: end.position,
      motion: end.motion,
      completedSegments: end.completedSegments,
    };
  }

  const at = samplePathAtDistance(path, current.distanceMm);
  const feed = speeds.feedMmS ?? SIM_FEED_MM_S;
  const rapid = speeds.rapidMmS ?? SIM_RAPID_MM_S;
  const speed = at.motion === "rapid" ? rapid : feed;
  const nextDist = Math.min(totalMm, current.distanceMm + speed * (dtMs / 1000));
  const next = samplePathAtDistance(path, nextDist);
  const done = nextDist >= totalMm - 1e-6;

  return {
    phase: done ? "done" : "playing",
    distanceMm: nextDist,
    totalMm,
    progress: nextDist / totalMm,
    position: next.position,
    motion: next.motion,
    completedSegments: next.completedSegments,
  };
}

export function startSim(path: ToolpathSegment[]): PathSimSnapshot {
  const base = createIdleSim(path);
  if (path.length === 0 || base.totalMm < 1e-9) {
    return { ...base, phase: "done", progress: 1 };
  }
  return { ...base, phase: "playing" };
}

export function pauseSim(current: PathSimSnapshot): PathSimSnapshot {
  if (current.phase !== "playing") return current;
  return { ...current, phase: "paused" };
}

export function resumeSim(current: PathSimSnapshot): PathSimSnapshot {
  if (current.phase !== "paused") return current;
  return { ...current, phase: "playing" };
}

/** Reset to the path start (idle). */
export function stopSim(path: ToolpathSegment[]): PathSimSnapshot {
  return createIdleSim(path);
}
