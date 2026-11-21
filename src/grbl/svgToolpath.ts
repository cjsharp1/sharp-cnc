/**
 * Simple 2D SVG → GRBL G-code (engrave / outline follow-path).
 * Not full CAM — one job, planar path follow with plunge/retract.
 */

import { loadJobFromText, type LoadedJob } from "./gcode";
import type { Polyline2 } from "./svgPath";

export type SvgCutMode = "engrave" | "outline";

export interface SvgToolpathParams {
  mode: SvgCutMode;
  /** XY feed mm/min. */
  feedMmMin: number;
  /** Plunge feed mm/min. */
  plungeMmMin: number;
  /** Cut depth below work Z0 (positive number → negative Z). */
  depthMm: number;
  /** Safe / retract Z above work (positive). */
  safeZMm: number;
  /** Bit diameter mm (header + comments; follow-path uses centerline). */
  toolDiameterMm: number;
}

export const DEFAULT_SVG_TOOLPATH: SvgToolpathParams = {
  mode: "engrave",
  feedMmMin: 600,
  plungeMmMin: 200,
  depthMm: 0.5,
  safeZMm: 5,
  /** 1/8" default endmill. */
  toolDiameterMm: 3.175,
};

/** Format a mm number for G-code words (trim trailing zeros). */
export function formatMm(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  return String(Number(rounded.toFixed(3)));
}

function ensureClosedPoints(poly: Polyline2): { x: number; y: number }[] {
  const pts = poly.points.map((p) => ({ x: p.x, y: p.y }));
  if (pts.length === 0) return pts;
  if (poly.closed) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a.x !== b.x || a.y !== b.y) pts.push({ ...a });
  }
  return pts;
}

/**
 * Build GRBL-ready G-code text from CNC polylines.
 *
 * - Engrave: follow each polyline as a stroke (open or closed).
 * - Outline: same follow; closed loops are explicitly closed (contour).
 * Tool diameter is recorded in the header for the operator / later CAM.
 */
export function generateSvgGcode(
  polys: Polyline2[],
  params: SvgToolpathParams,
  meta?: { sourceName?: string },
): string {
  const feed = Math.max(1, params.feedMmMin);
  const plunge = Math.max(1, params.plungeMmMin);
  const depth = Math.abs(params.depthMm);
  const safeZ = Math.max(0, params.safeZMm);
  const cutZ = -depth;
  const tool = Math.max(0.01, params.toolDiameterMm);
  const mode = params.mode;

  const lines: string[] = [];
  lines.push(`; SharpCNC SVG → G-code (${mode})`);
  if (meta?.sourceName) lines.push(`; Source: ${meta.sourceName}`);
  lines.push(
    `; Tool Ø ${formatMm(tool)} mm · depth ${formatMm(depth)} · feed ${formatMm(feed)} · plunge ${formatMm(plunge)}`,
  );
  lines.push(`; Safe Z ${formatMm(safeZ)} · follow-path (not full CAM)`);
  lines.push("G21"); // mm
  lines.push("G90"); // absolute
  lines.push("G94"); // feed per minute
  lines.push("G17"); // XY plane
  lines.push(`G0 Z${formatMm(safeZ)}`);

  let pathIndex = 0;
  for (const poly of polys) {
    const pts = ensureClosedPoints(poly);
    if (pts.length < 2) continue;
    pathIndex += 1;

    const label =
      mode === "outline" && poly.closed
        ? `outline contour ${pathIndex}`
        : `engrave path ${pathIndex}`;
    lines.push(`; --- ${label} ---`);

    const start = pts[0];
    lines.push(`G0 X${formatMm(start.x)} Y${formatMm(start.y)}`);
    lines.push(`G0 Z${formatMm(safeZ)}`);
    lines.push(`G1 Z${formatMm(cutZ)} F${formatMm(plunge)}`);

    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      lines.push(`G1 X${formatMm(p.x)} Y${formatMm(p.y)} F${formatMm(feed)}`);
    }

    lines.push(`G0 Z${formatMm(safeZ)}`);
  }

  lines.push(`G0 Z${formatMm(safeZ)}`);
  lines.push("M2");
  return `${lines.join("\n")}\n`;
}

/** Generate G-code and wrap as a {@link LoadedJob} for the existing runner. */
export function buildJobFromSvg(
  name: string,
  polys: Polyline2[],
  params: SvgToolpathParams,
): LoadedJob {
  const base = name.toLowerCase().endsWith(".svg")
    ? name.slice(0, -4)
    : name;
  const jobName = `${base}-${params.mode}.nc`;
  const text = generateSvgGcode(polys, params, { sourceName: name });
  return loadJobFromText(jobName, text);
}
