import type { PathMotion, ToolpathSegment } from "./gcode";

/** Pre-run preview phases — visualizer only; never touches serial. */
export type SimPhase = "idle" | "playing" | "paused" | "done";

/**
 * What the toolhead is doing on the current segment — for Z / lift cues.
 * Derived from motion kind + ΔZ (not sent to the CNC).
 */
export type SimActivity = "retract" | "plunge" | "cut" | "rapid";

/** Playback rate presets (1× is the default look). */
export const SIM_SPEED_PRESETS = [0.25, 0.5, 1, 2, 4] as const;
export type SimSpeedRate = (typeof SIM_SPEED_PRESETS)[number];
export const DEFAULT_SIM_SPEED: SimSpeedRate = 1;

export interface PathSimSnapshot {
  phase: SimPhase;
  /** Distance along path from start (mm, 3D). */
  distanceMm: number;
  /** Total path length (mm, 3D). */
  totalMm: number;
  /** Progress 0..1 along the path. */
  progress: number;
  /** Current XYZ in work coordinates (mm). */
  position: { x: number; y: number; z: number };
  /** Motion kind for the segment under the toolhead. */
  motion: PathMotion | null;
  /** High-level activity for UI (retract / plunge / cut / rapid). */
  activity: SimActivity | null;
  /** Fully completed segment count (0..path.length). */
  completedSegments: number;
}

/** Visual preview speeds (mm/s) — faster than typical cuts for a quick look. */
export const SIM_FEED_MM_S = 120;
export const SIM_RAPID_MM_S = 400;
/** Vertical moves are slower so plunge / retract stay readable. */
export const SIM_Z_MM_S = 40;

const Z_EPSILON = 1e-4;
const XY_EPSILON = 1e-4;

export function segmentLength(seg: ToolpathSegment): number {
  return Math.hypot(
    seg.to.x - seg.from.x,
    seg.to.y - seg.from.y,
    seg.to.z - seg.from.z,
  );
}

export function pathLength(path: ToolpathSegment[]): number {
  let total = 0;
  for (const seg of path) total += segmentLength(seg);
  return total;
}

/** Classify retract / plunge / cut / rapid from a segment's endpoints. */
export function classifySimActivity(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  motion: PathMotion | null,
): SimActivity | null {
  if (!motion) return null;
  const dz = to.z - from.z;
  const xy = Math.hypot(to.x - from.x, to.y - from.y);
  if (dz > Z_EPSILON && xy < XY_EPSILON) return "retract";
  if (dz < -Z_EPSILON && xy < XY_EPSILON) return "plunge";
  if (dz > Z_EPSILON && motion === "rapid") return "retract";
  if (motion === "rapid") return "rapid";
  return "cut";
}

export function formatSimActivityLabel(
  activity: SimActivity | null,
  z: number,
): string | null {
  if (!activity) return null;
  const zText = `Z=${z.toFixed(2)}`;
  switch (activity) {
    case "retract":
      return `Retract · ${zText}`;
    case "plunge":
      return `Plunge · ${zText}`;
    case "cut":
      return `Cut ${zText}`;
    case "rapid":
      return `Rapid · ${zText}`;
    default:
      return zText;
  }
}

/** Idle snapshot at the start of the path (or origin if empty). */
export function createIdleSim(path: ToolpathSegment[]): PathSimSnapshot {
  const totalMm = pathLength(path);
  const start = path[0]?.from ?? { x: 0, y: 0, z: 0 };
  const motion = path[0]?.motion ?? null;
  const activity = path[0]
    ? classifySimActivity(path[0].from, path[0].to, path[0].motion)
    : null;
  return {
    phase: "idle",
    distanceMm: 0,
    totalMm,
    progress: 0,
    position: { x: start.x, y: start.y, z: start.z },
    motion,
    activity,
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
  position: { x: number; y: number; z: number };
  motion: PathMotion | null;
  activity: SimActivity | null;
  completedSegments: number;
} {
  if (path.length === 0) {
    return {
      position: { x: 0, y: 0, z: 0 },
      motion: null,
      activity: null,
      completedSegments: 0,
    };
  }

  let remaining = Math.max(0, distanceMm);
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]!;
    const len = segmentLength(seg);
    if (len < 1e-9) {
      if (i === path.length - 1) {
        return {
          position: { x: seg.to.x, y: seg.to.y, z: seg.to.z },
          motion: seg.motion,
          activity: classifySimActivity(seg.from, seg.to, seg.motion),
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
          z: seg.from.z + (seg.to.z - seg.from.z) * t,
        },
        motion: seg.motion,
        activity: classifySimActivity(seg.from, seg.to, seg.motion),
        completedSegments: i,
      };
    }
    remaining -= len;
  }

  const last = path[path.length - 1]!;
  return {
    position: { x: last.to.x, y: last.to.y, z: last.to.z },
    motion: last.motion,
    activity: classifySimActivity(last.from, last.to, last.motion),
    completedSegments: path.length,
  };
}

export interface SimSpeeds {
  feedMmS?: number;
  rapidMmS?: number;
  zMmS?: number;
  /** Playback multiplier (0.25 … 4). Default 1. */
  rate?: number;
}

function segmentSpeedMmS(
  seg: ToolpathSegment | null,
  motion: PathMotion | null,
  speeds: Required<Pick<SimSpeeds, "feedMmS" | "rapidMmS" | "zMmS">>,
): number {
  if (!seg || !motion) return speeds.feedMmS;
  const xy = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
  const dz = Math.abs(seg.to.z - seg.from.z);
  if (xy < XY_EPSILON && dz > Z_EPSILON) return speeds.zMmS;
  return motion === "rapid" ? speeds.rapidMmS : speeds.feedMmS;
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
      activity: end.activity,
      completedSegments: end.completedSegments,
    };
  }

  const at = samplePathAtDistance(path, current.distanceMm);
  const resolved = {
    feedMmS: speeds.feedMmS ?? SIM_FEED_MM_S,
    rapidMmS: speeds.rapidMmS ?? SIM_RAPID_MM_S,
    zMmS: speeds.zMmS ?? SIM_Z_MM_S,
  };
  const rate = Math.max(0.05, speeds.rate ?? 1);
  const seg =
    at.completedSegments < path.length ? path[at.completedSegments]! : null;
  const speed = segmentSpeedMmS(seg, at.motion, resolved) * rate;
  const nextDist = Math.min(
    totalMm,
    current.distanceMm + speed * (dtMs / 1000),
  );
  const next = samplePathAtDistance(path, nextDist);
  const done = nextDist >= totalMm - 1e-6;

  return {
    phase: done ? "done" : "playing",
    distanceMm: nextDist,
    totalMm,
    progress: nextDist / totalMm,
    position: next.position,
    motion: next.motion,
    activity: next.activity,
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
