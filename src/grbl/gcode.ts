import { ESTOP_LATCHED_REASON, type Position3 } from "./types";

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
  bounds: JobBounds | null;
  /**
   * Z range the job visits in work mm (includes rapids/retracts).
   * Null when the file has no Z words.
   */
  zRange?: { minZ: number; maxZ: number } | null;
  /** Count of machine-coordinate (G53/G28/G30) moves left out of path/bounds. */
  machineCoordMoves?: number;
}

export interface JobBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
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
 * Sample points along a G2/G3 arc in the XY plane (I/J centre offsets or R).
 * Used for bounds so an arc that bulges past its chord is still checked.
 */
function arcPoints(
  from: Position3,
  to: Position3,
  clockwise: boolean,
  i: number | undefined,
  j: number | undefined,
  r: number | undefined,
): Array<{ x: number; y: number }> {
  let cx: number;
  let cy: number;
  if (i !== undefined || j !== undefined) {
    cx = from.x + (i ?? 0);
    cy = from.y + (j ?? 0);
  } else if (r !== undefined && r !== 0) {
    // Centre from radius form: pick the side GRBL uses (R<0 = >180° arc).
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d === 0 || Math.abs(r) < d / 2) return [];
    const h = Math.sqrt(r * r - (d / 2) * (d / 2));
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    let sign = clockwise ? 1 : -1;
    if (r < 0) sign = -sign;
    cx = mx - (sign * h * dy) / d;
    cy = my + (sign * h * dx) / d;
  } else {
    return [];
  }
  const radius = Math.hypot(from.x - cx, from.y - cy);
  if (radius === 0) return [];
  const a0 = Math.atan2(from.y - cy, from.x - cx);
  let a1 = Math.atan2(to.y - cy, to.x - cx);
  const full = from.x === to.x && from.y === to.y;
  if (clockwise) {
    if (full || a1 >= a0) a1 -= 2 * Math.PI;
  } else if (full || a1 <= a0) {
    a1 += 2 * Math.PI;
  }
  const steps = Math.max(8, Math.ceil((Math.abs(a1 - a0) / (2 * Math.PI)) * 72));
  const pts: Array<{ x: number; y: number }> = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    pts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
  }
  return pts;
}

/**
 * Approximate XYZ path from G-code for overlay + simulation.
 * Tracks G90/G91 and G20/G21. Arcs (G2/G3) are drawn as a straight chord but
 * their true extent is sampled into the bounds. Pure Z moves (plunge /
 * retract) are kept so sim can show lift and depth. G53/G28/G30 moves are in
 * machine coordinates, so they are left out of the work-coordinate path.
 */
export function extractToolpath(lines: string[]): {
  path: ToolpathSegment[];
  bounds: LoadedJob["bounds"];
  zRange: { minZ: number; maxZ: number } | null;
  machineCoordMoves: number;
} {
  let absolute = true;
  let inch = false;
  let modalMotion: PathMotion | null = null;
  let modalArc: "cw" | "ccw" | null = null;
  let pos: Position3 = { x: 0, y: 0, z: 0 };
  const path: ToolpathSegment[] = [];
  let machineCoordMoves = 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let sawZ = false;

  const toMm = (v: number) => (inch ? v * 25.4 : v);

  const note = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const noteZ = (z: number) => {
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  };

  for (const line of lines) {
    if (/\bG90\b/i.test(line)) absolute = true;
    if (/\bG91\b/i.test(line)) absolute = false;
    if (/\bG20\b/i.test(line)) inch = true;
    if (/\bG21\b/i.test(line)) inch = false;

    const motion = hasMotion(line);
    if (motion) modalMotion = motion;
    if (/\bG0*2\b/i.test(line)) modalArc = "cw";
    else if (/\bG0*3\b/i.test(line)) modalArc = "ccw";
    else if (/\bG0*[01]\b/i.test(line) || /\bG0(?!\d)/i.test(line)) modalArc = null;

    const xWord = parseWordValue(line, "X");
    const yWord = parseWordValue(line, "Y");
    const zWord = parseWordValue(line, "Z");

    if (xWord === undefined && yWord === undefined && zWord === undefined) {
      continue;
    }

    // Machine-coordinate moves: not part of the work-coordinate toolpath.
    if (/\bG53\b/i.test(line) || /\bG2[89](?:\.\d)?\b/i.test(line) || /\bG30(?:\.\d)?\b/i.test(line)) {
      machineCoordMoves += 1;
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
      sawZ = true;
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
        if (modalArc) {
          const iWord = parseWordValue(line, "I");
          const jWord = parseWordValue(line, "J");
          const rWord = parseWordValue(line, "R");
          for (const pt of arcPoints(
            pos,
            next,
            modalArc === "cw",
            iWord !== undefined ? toMm(iWord) : undefined,
            jWord !== undefined ? toMm(jWord) : undefined,
            rWord !== undefined ? toMm(rWord) : undefined,
          )) {
            note(pt.x, pt.y);
          }
        }
      }
      noteZ(pos.z);
      noteZ(next.z);
    }

    pos = next;
  }

  const bounds =
    path.length === 0 || !Number.isFinite(minX)
      ? null
      : { minX, minY, maxX, maxY };
  const zRange =
    sawZ && Number.isFinite(minZ) ? { minZ, maxZ } : null;

  return { path, bounds, zRange, machineCoordMoves };
}

/** Build a {@link LoadedJob} from file name + text. */
export function loadJobFromText(name: string, text: string): LoadedJob {
  const lines = parseGcodeLines(text);
  const { path, bounds, zRange, machineCoordMoves } = extractToolpath(lines);
  return { name, text, lines, path, bounds, zRange, machineCoordMoves };
}

/** Can this machine state accept a new job start? */
export function canStartJob(state: string, connected: boolean): {
  ok: boolean;
  reason?: string;
} {
  if (!connected) return { ok: false, reason: "Connect to the machine first." };
  if (state === "EStopLatched") return { ok: false, reason: ESTOP_LATCHED_REASON };
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
