/**
 * Recent job library entries (local). Stores metadata + optional text so
 * operators can reopen without hunting the folder.
 */

import type { ToolpathSegment } from "./gcode";

export interface RecentJobEntry {
  id: string;
  name: string;
  /** File text snapshot (truncated for large jobs). */
  text: string;
  kind: "gcode" | "svg";
  lineCount: number;
  /** Compact path for thumbnail (work mm). */
  path: Array<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    motion: "rapid" | "feed";
  }>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  openedAt: number;
}

const STORAGE_KEY = "sharpcnc.recentJobs.v1";
const MAX_RECENT = 8;
const MAX_TEXT_CHARS = 250_000;
const MAX_PATH_SEGS = 400;

function newId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function compactPath(path: ToolpathSegment[]): RecentJobEntry["path"] {
  const step = Math.max(1, Math.ceil(path.length / MAX_PATH_SEGS));
  const out: RecentJobEntry["path"] = [];
  for (let i = 0; i < path.length; i += step) {
    const seg = path[i];
    out.push({
      x0: seg.from.x,
      y0: seg.from.y,
      x1: seg.to.x,
      y1: seg.to.y,
      motion: seg.motion,
    });
  }
  return out;
}

/** Load recent jobs newest-first. */
export function loadRecentJobs(): RecentJobEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: RecentJobEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const e = item as Partial<RecentJobEntry>;
      if (
        typeof e.id !== "string" ||
        typeof e.name !== "string" ||
        typeof e.text !== "string" ||
        (e.kind !== "gcode" && e.kind !== "svg") ||
        typeof e.lineCount !== "number" ||
        typeof e.openedAt !== "number" ||
        !Array.isArray(e.path)
      ) {
        continue;
      }
      out.push({
        id: e.id,
        name: e.name,
        text: e.text,
        kind: e.kind,
        lineCount: e.lineCount,
        path: e.path as RecentJobEntry["path"],
        bounds:
          e.bounds &&
          typeof e.bounds === "object" &&
          typeof e.bounds.minX === "number"
            ? e.bounds
            : null,
        openedAt: e.openedAt,
      });
      if (out.length >= MAX_RECENT) break;
    }
    return out.sort((a, b) => b.openedAt - a.openedAt);
  } catch {
    return [];
  }
}

function persist(list: RecentJobEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* quota / private — ignore */
  }
}

/** Remember a loaded job (dedupe by name, newest first). */
export function rememberRecentJob(input: {
  name: string;
  text: string;
  kind: "gcode" | "svg";
  lineCount: number;
  path: ToolpathSegment[];
  bounds: RecentJobEntry["bounds"];
}): RecentJobEntry[] {
  const list = loadRecentJobs().filter(
    (e) => e.name.toLowerCase() !== input.name.toLowerCase(),
  );
  list.unshift({
    id: newId(),
    name: input.name,
    text: input.text.slice(0, MAX_TEXT_CHARS),
    kind: input.kind,
    lineCount: input.lineCount,
    path: compactPath(input.path),
    bounds: input.bounds,
    openedAt: Date.now(),
  });
  persist(list);
  return loadRecentJobs();
}

/** Remove one recent entry. */
export function removeRecentJob(id: string): RecentJobEntry[] {
  const next = loadRecentJobs().filter((e) => e.id !== id);
  persist(next);
  return next;
}

/** Build a tiny SVG thumbnail from compacted path. */
export function recentJobThumbnailSvg(
  entry: RecentJobEntry,
  size = 64,
): string {
  const pad = 4;
  const bounds = entry.bounds ?? {
    minX: 0,
    minY: 0,
    maxX: 100,
    maxY: 100,
  };
  const w = Math.max(1e-3, bounds.maxX - bounds.minX);
  const h = Math.max(1e-3, bounds.maxY - bounds.minY);
  const scale = (size - pad * 2) / Math.max(w, h);
  const ox = pad + ((size - pad * 2) - w * scale) / 2;
  const oy = pad + ((size - pad * 2) - h * scale) / 2;
  const mapX = (x: number) => ox + (x - bounds.minX) * scale;
  // SVG Y grows down; CNC Y grows up.
  const mapY = (y: number) => oy + (bounds.maxY - y) * scale;
  const parts: string[] = [];
  for (const seg of entry.path) {
    const stroke = seg.motion === "rapid" ? "#6b7280" : "#d4a84b";
    const width = seg.motion === "rapid" ? 0.8 : 1.4;
    parts.push(
      `<line x1="${mapX(seg.x0).toFixed(2)}" y1="${mapY(seg.y0).toFixed(2)}" x2="${mapX(seg.x1).toFixed(2)}" y2="${mapY(seg.y1).toFixed(2)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Preview of ${entry.name}"><rect width="100%" height="100%" fill="#12151a"/>${parts.join("")}</svg>`;
}
