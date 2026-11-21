import type { Position3 } from "./types";

/** Accepted job file extensions (case-insensitive). */
export const GCODE_EXTENSIONS = [".nc", ".gcode", ".ngc", ".tap"] as const;

export type PathMotion = "rapid" | "feed";

/** One toolpath segment for overlay + sim (work coordinates, mm). Includes Z. */
export interface ToolpathSegment {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  motion: PathMotion;
}

export interface LoadedJob {
  name: string;
  /** Original file text. */
  text: string;
  /** Non-empty lines ready to send (comments stripped; blank lines dropped). */
  lines: string[];
  /** Approximate XY toolpath in work mm for overlay. */
  path: ToolpathSegment[];
  /** Bounding box of path (work mm); null if no XY moves. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
}

export function isGcodeFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return GCODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Strip `;` and `()` comments; trim. Empty string if nothing left. */
export function stripGcodeComments(rawLine: string): string {
  let line = rawLine;
  // Remove parenthetical comments first (may contain ';').
  line = line.replace(/\([^)]*\)/g, "");
  const semi = line.indexOf(";");
  if (semi >= 0) line = line.slice(0, semi);
  return line.trim();
}

/**
 * Split file text into sendable GRBL lines.
 * Keeps program words; drops blank / comment-only lines.
 */
export function parseGcodeLines(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = stripGcodeComments(raw);
    if (!line) continue;
    // Skip pure percent program markers common in some posts.
    if (line === "%") continue;
    out.push(line);
  }
  return out;
}

function parseWordValue(line: string, letter: string): number | undefined {
  const re = new RegExp(`\\b${letter}\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
  const m = re.exec(line);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function hasMotion(line: string): "rapid" | "feed" | null {
  // Word-boundary match so G0 does not steal G01 / G02 / G03.
  if (/\bG0+0\b/i.test(line) || /\bG0(?!\d)/i.test(line)) return "rapid";
  if (/\bG0*1\b/i.test(line)) return "feed";
  if (/\bG0*[23]\b/i.test(line)) return "feed";
  return null;
}

/**
 * Approximate XYZ path from G-code for overlay + simulation.
 * Tracks G90/G91 and G20/G21; arcs (G2/G3) become a straight chord.
 * Pure Z moves (plunge / retract) are kept so sim can show lift and depth.
 */
export function extractToolpath(lines: string[]): {
  path: ToolpathSegment[];
  bounds: LoadedJob["bounds"];
} {
  let absolute = true;
  let inch = false;
  let modalMotion: PathMotion | null = null;
  let pos: Position3 = { x: 0, y: 0, z: 0 };
  const path: ToolpathSegment[] = [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const toMm = (v: number) => (inch ? v * 25.4 : v);

  const note = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  for (const line of lines) {
    if (/\bG90\b/i.test(line)) absolute = true;
    if (/\bG91\b/i.test(line)) absolute = false;
    if (/\bG20\b/i.test(line)) inch = true;
    if (/\bG21\b/i.test(line)) inch = false;

    const motion = hasMotion(line);
    if (motion) modalMotion = motion;

    const xWord = parseWordValue(line, "X");
    const yWord = parseWordValue(line, "Y");
    const zWord = parseWordValue(line, "Z");

    if (xWord === undefined && yWord === undefined && zWord === undefined) {
      continue;
    }

    const next = { ...pos };
    if (xWord !== undefined) {
      next.x = absolute ? toMm(xWord) : pos.x + toMm(xWord);
    }
    if (yWord !== undefined) {
      next.y = absolute ? toMm(yWord) : pos.y + toMm(yWord);
    }
    if (zWord !== undefined) {
      next.z = absolute ? toMm(zWord) : pos.z + toMm(zWord);
    }

    const xyChanged = next.x !== pos.x || next.y !== pos.y;
    const zChanged = next.z !== pos.z;
    if ((xyChanged || zChanged) && (motion || modalMotion)) {
      const kind = motion ?? modalMotion ?? "feed";
      path.push({
        from: { x: pos.x, y: pos.y, z: pos.z },
        to: { x: next.x, y: next.y, z: next.z },
        motion: kind,
      });
      if (xyChanged) {
        note(pos.x, pos.y);
        note(next.x, next.y);
      }
    }

    pos = next;
  }

  const bounds =
    path.length === 0
      ? null
      : { minX, minY, maxX, maxY };

  return { path, bounds };
}

/** Build a {@link LoadedJob} from file name + text. */
export function loadJobFromText(name: string, text: string): LoadedJob {
  const lines = parseGcodeLines(text);
  const { path, bounds } = extractToolpath(lines);
  return { name, text, lines, path, bounds };
}

/** Can this machine state accept a new job start? */
export function canStartJob(state: string, connected: boolean): {
  ok: boolean;
  reason?: string;
} {
  if (!connected) return { ok: false, reason: "Connect to the machine first." };
  if (state === "Alarm") {
    return { ok: false, reason: "Clear alarm (soft reset / unlock) before starting." };
  }
  if (state === "Offline") {
    return { ok: false, reason: "Machine is offline." };
  }
  if (state === "Hold") {
    return { ok: false, reason: "Machine is in feed hold — resume or stop first." };
  }
  if (state === "Run" || state === "Jog" || state === "Home") {
    return { ok: false, reason: `Busy (${state}). Wait or stop before starting.` };
  }
  return { ok: true };
}
