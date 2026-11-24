import type { LoadedJob, PathMotion, ToolpathSegment } from "./gcode";

/** Default feed assumptions for time estimate when F words are sparse (mm/min). */
export const ESTIMATE_FEED_MM_MIN = 800;
export const ESTIMATE_RAPID_MM_MIN = 3000;

export interface JobTimeEstimate {
  /** Total estimated seconds. */
  totalSeconds: number;
  feedSeconds: number;
  rapidSeconds: number;
  /** Human label e.g. "~4m 20s". */
  label: string;
}

export interface DryRunOptions {
  /** Replace M3/M4 with M5 and strip lone S words that would spin up. */
  spindleOff: boolean;
  /**
   * Add this many mm to every absolute (G90) Z word so the whole path runs
   * above the stock ("air cut"). 0/undefined keeps the original Z.
   * Relative (G91) Z and machine-coordinate (G53) lines are left alone.
   */
  liftZMm?: number;
}

/** Margin kept between the deepest dry-run point and material Z0 (mm). */
export const DRY_RUN_CLEARANCE_MM = 5;

/**
 * Lift needed so the deepest point of the job stays {@link DRY_RUN_CLEARANCE_MM}
 * above material Z0 during a dry run.
 */
export function dryRunLiftMm(
  zRange: { minZ: number; maxZ: number } | null | undefined,
): number {
  if (!zRange) return DRY_RUN_CLEARANCE_MM;
  return Math.max(0, -zRange.minZ) + DRY_RUN_CLEARANCE_MM;
}

/** Shift absolute Z words up by `liftMm` (respecting G20/G21 and G90/G91). */
export function liftAbsoluteZ(lines: string[], liftMm: number): string[] {
  if (!liftMm) return [...lines];
  let absolute = true;
  let inch = false;
  return lines.map((line) => {
    if (/\bG90\b/i.test(line)) absolute = true;
    if (/\bG91\b/i.test(line)) absolute = false;
    if (/\bG20\b/i.test(line)) inch = true;
    if (/\bG21\b/i.test(line)) inch = false;
    if (!absolute || /\bG53\b/i.test(line) || /\bG10\b/i.test(line)) return line;
    return line.replace(/\bZ\s*(-?\d+(?:\.\d+)?|-?\.\d+)/i, (_m, v: string) => {
      const lift = inch ? liftMm / 25.4 : liftMm;
      const next = Number(v) + lift;
      return `Z${Number(next.toFixed(4))}`;
    });
  });
}

/**
 * Build a spindle-off dry-run variant of job lines.
 * Keeps motion; forces M5 and drops spindle-on / speed words that would cut air with a spinning bit.
 */
export function buildDryRunLines(
  lines: string[],
  options: DryRunOptions = { spindleOff: true },
): string[] {
  const source = options.liftZMm ? liftAbsoluteZ(lines, options.liftZMm) : lines;
  if (!options.spindleOff) return [...source];
  const out: string[] = ["M5"];
  for (const line of source) {
    let next = line;
    // M3/M4 → M5 (keep rest of line if any).
    next = next.replace(/\bM0*3\b/gi, "M5").replace(/\bM0*4\b/gi, "M5");
    // Drop standalone S words (and S on otherwise-empty remains).
    next = next.replace(/\bS-?\d+(?:\.\d+)?\b/gi, "").replace(/\s+/g, " ").trim();
    if (!next || /^M5$/i.test(next)) continue;
    out.push(next);
  }
  // Ensure we still end spindle-off.
  if (!out.some((l) => /^M5\b/i.test(l))) out.push("M5");
  return out;
}

/** Skip-to-line: return lines from 0-based startIndex inclusive. */
export function sliceJobFromLine(
  lines: string[],
  startIndex: number,
): { lines: string[]; startIndex: number } {
  const idx = Math.max(0, Math.min(lines.length, Math.floor(startIndex)));
  return { lines: lines.slice(idx), startIndex: idx };
}

/** Clamp scrubber index into [0, total]. */
export function clampScrubIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total, Math.floor(index)));
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `~${h}h ${m}m`;
  if (m > 0) return `~${m}m ${sec.toString().padStart(2, "0")}s`;
  return `~${sec}s`;
}

/**
 * Rough time estimate from planar path + modal feed assumptions.
 * Uses segment length / assumed rates (not GRBL acceleration).
 */
export function estimateJobTime(
  path: ToolpathSegment[],
  options?: {
    feedMmMin?: number;
    rapidMmMin?: number;
  },
): JobTimeEstimate {
  const feedMmMin = options?.feedMmMin ?? ESTIMATE_FEED_MM_MIN;
  const rapidMmMin = options?.rapidMmMin ?? ESTIMATE_RAPID_MM_MIN;
  let feedMm = 0;
  let rapidMm = 0;
  for (const seg of path) {
    const len = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y);
    if (seg.motion === "rapid") rapidMm += len;
    else feedMm += len;
  }
  const feedSeconds = feedMmMin > 0 ? (feedMm / feedMmMin) * 60 : 0;
  const rapidSeconds = rapidMmMin > 0 ? (rapidMm / rapidMmMin) * 60 : 0;
  const totalSeconds = feedSeconds + rapidSeconds;
  return {
    totalSeconds,
    feedSeconds,
    rapidSeconds,
    label: formatDuration(totalSeconds),
  };
}

export function estimateJobTimeFromJob(job: LoadedJob): JobTimeEstimate {
  return estimateJobTime(job.path);
}

/** Detect tool-change pause lines (M6 / M06). */
export function isToolChangeLine(line: string): boolean {
  return /\bM0*6\b/i.test(line);
}

/** Find next M6 at or after index. */
export function findNextToolChange(
  lines: string[],
  fromIndex = 0,
): number | null {
  for (let i = Math.max(0, fromIndex); i < lines.length; i++) {
    if (isToolChangeLine(lines[i]!)) return i;
  }
  return null;
}

export type { PathMotion };

/**
 * Lines to back up from the last acknowledged line when saving a recovery
 * checkpoint. An `ok` from GRBL means "parsed into the planner", not
 * "executed", and the planner holds ~15 moves, so the true stop point is
 * earlier. Re-cutting a little air beats skipping material.
 */
export const RESUME_BACKOFF_LINES = 20;

/** Modal state at a line, reconstructed by scanning everything before it. */
export interface ResumeState {
  inch: boolean;
  absolute: boolean;
  wcs: string | null;
  plane: string | null;
  feed: number | null;
  spindle: "M3" | "M4" | "M5" | null;
  spindleSpeed: number | null;
  coolant: string[];
  /** Work-coordinate position (mm) before the resume line. */
  position: { x: number; y: number; z: number };
}

function word(line: string, letter: string): number | undefined {
  const m = new RegExp(`\\b${letter}\\s*(-?\\d+(?:\\.\\d+)?|-?\\.\\d+)`, "i").exec(line);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

/** Scan lines [0, startIndex) and return the modal state the job would be in. */
export function scanResumeState(lines: string[], startIndex: number): ResumeState {
  const st: ResumeState = {
    inch: false,
    absolute: true,
    wcs: null,
    plane: null,
    feed: null,
    spindle: null,
    spindleSpeed: null,
    coolant: [],
    position: { x: 0, y: 0, z: 0 },
  };
  const end = Math.max(0, Math.min(lines.length, startIndex));
  for (let i = 0; i < end; i++) {
    const line = lines[i]!;
    if (/\bG20\b/i.test(line)) st.inch = true;
    if (/\bG21\b/i.test(line)) st.inch = false;
    if (/\bG90\b/i.test(line)) st.absolute = true;
    if (/\bG91\b/i.test(line)) st.absolute = false;
    const wcs = /\bG5[4-9]\b/i.exec(line);
    if (wcs) st.wcs = wcs[0].toUpperCase();
    const plane = /\bG1[7-9]\b/i.exec(line);
    if (plane) st.plane = plane[0].toUpperCase();
    if (/\bM0*3\b/i.test(line)) st.spindle = "M3";
    if (/\bM0*4\b/i.test(line)) st.spindle = "M4";
    if (/\bM0*5\b/i.test(line)) st.spindle = "M5";
    if (/\bM0*[7]\b/i.test(line) && !st.coolant.includes("M7")) st.coolant.push("M7");
    if (/\bM0*[8]\b/i.test(line) && !st.coolant.includes("M8")) st.coolant.push("M8");
    if (/\bM0*9\b/i.test(line)) st.coolant = [];
    const f = word(line, "F");
    if (f !== undefined) st.feed = st.inch ? f * 25.4 : f;
    const s = word(line, "S");
    if (s !== undefined) st.spindleSpeed = s;
    if (/\bG53\b|\bG2[89]\b|\bG30\b/i.test(line)) continue;
    const toMm = (v: number) => (st.inch ? v * 25.4 : v);
    for (const axis of ["x", "y", "z"] as const) {
      const v = word(line, axis.toUpperCase());
      if (v === undefined) continue;
      st.position[axis] = st.absolute ? toMm(v) : st.position[axis] + toMm(v);
    }
  }
  return st;
}

export interface ResumePreambleOptions {
  /** Safe Z (work mm) to travel at before moving to the resume point. */
  clearanceZMm: number;
  /** Seconds to let the spindle reach speed before plunging. Default 3. */
  spindleDwellSec?: number;
  /** Plunge feed (mm/min) when no F was set before the resume line. */
  defaultPlungeFeed?: number;
}

/**
 * Commands to run before streaming from line `startIndex` > 0 so the machine
 * is in the same state the program would have left it in: units, distance
 * mode, work offset, plane, spindle, coolant, feed — then a safe entry:
 * retract, move over the resume point, spin up, plunge to the resume Z.
 * Returns [] when starting from the top.
 */
export function buildResumePreamble(
  lines: string[],
  startIndex: number,
  options: ResumePreambleOptions,
): string[] {
  if (startIndex <= 0) return [];
  const st = scanResumeState(lines, startIndex);
  const fmt = (n: number) => String(Number(n.toFixed(4)));
  const out: string[] = [];
  out.push("G21 G90"); // preamble moves are absolute mm; restored below
  if (st.wcs) out.push(st.wcs);
  if (st.plane) out.push(st.plane);
  const clearZ = Math.max(options.clearanceZMm, st.position.z);
  out.push(`G0 Z${fmt(clearZ)}`);
  out.push(`G0 X${fmt(st.position.x)} Y${fmt(st.position.y)}`);
  if (st.spindle === "M3" || st.spindle === "M4") {
    out.push(`${st.spindle}${st.spindleSpeed !== null ? ` S${fmt(st.spindleSpeed)}` : ""}`);
    out.push(`G4 P${fmt(options.spindleDwellSec ?? 3)}`);
  } else {
    out.push("M5");
  }
  for (const c of st.coolant) out.push(c);
  // Plunge no faster than the program's feed and never faster than the default.
  const plungeCap = options.defaultPlungeFeed ?? 300;
  const plunge = Math.min(st.feed ?? plungeCap, plungeCap);
  out.push(`G1 Z${fmt(st.position.z)} F${fmt(plunge)}`);
  // Restore the program's own modes for the lines that follow.
  if (st.inch) out.push("G20");
  if (!st.absolute) out.push("G91");
  if (st.feed !== null) out.push(`F${fmt(st.inch ? st.feed / 25.4 : st.feed)}`);
  return out;
}

/**
 * Dry-run transform that keeps one output line per input line (so job line
 * numbers, checkpoints, and error messages still match the file): spindle-on
 * becomes M5, S words are dropped, and absolute Z is lifted by `liftZMm`.
 */
export function dryRunJobLines(lines: string[], liftZMm: number): string[] {
  const lifted = liftZMm ? liftAbsoluteZ(lines, liftZMm) : lines;
  return lifted.map((line) => {
    const next = line
      .replace(/\bM0*3\b/gi, "M5")
      .replace(/\bM0*4\b/gi, "M5")
      .replace(/\bS-?\d+(?:\.\d+)?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return next || "M5";
  });
}
