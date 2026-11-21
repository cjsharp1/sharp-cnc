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
}

/**
 * Build a spindle-off dry-run variant of job lines.
 * Keeps motion; forces M5 and drops spindle-on / speed words that would cut air with a spinning bit.
 */
export function buildDryRunLines(
  lines: string[],
  options: DryRunOptions = { spindleOff: true },
): string[] {
  if (!options.spindleOff) return [...lines];
  const out: string[] = ["M5"];
  for (const line of lines) {
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
