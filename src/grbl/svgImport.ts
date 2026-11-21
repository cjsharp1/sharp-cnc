/**
 * Import SVG markup → CNC-ready polylines (mm, Y-up, origin at content min).
 * Supports path / line / polyline / polygon / rect / circle / ellipse.
 * Basic transform="translate|scale|matrix" on those elements.
 */

import {
  boundsOfPolylines,
  normalizePolylinesForCnc,
  parsePathData,
  type Point2,
  type Polyline2,
} from "./svgPath";
import type { ToolpathSegment } from "./gcode";

export interface SvgImportResult {
  name: string;
  /** Source SVG text. */
  text: string;
  /** Geometry in work mm (Y-up, pinned to 0,0). */
  polylines: Polyline2[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  /** Approximate path overlay for machine view. */
  preview: ToolpathSegment[];
  warnings: string[];
}

export function isSvgFileName(name: string): boolean {
  return name.toLowerCase().endsWith(".svg");
}

function parsePointsAttr(raw: string): Point2[] {
  const nums = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const pts: Point2[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  return pts;
}

type Mat2D = [number, number, number, number, number, number];

const IDENTITY: Mat2D = [1, 0, 0, 1, 0, 0];

function mul(a: Mat2D, b: Mat2D): Mat2D {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function applyMat(m: Mat2D, p: Point2): Point2 {
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5],
  };
}

function parseTransform(raw: string | null | undefined): Mat2D {
  if (!raw || !raw.trim()) return IDENTITY;
  let m: Mat2D = IDENTITY;
  const re =
    /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const kind = match[1].toLowerCase();
    const args = match[2]
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    let next: Mat2D = IDENTITY;
    if (kind === "matrix" && args.length >= 6) {
      next = [args[0], args[1], args[2], args[3], args[4], args[5]];
    } else if (kind === "translate") {
      next = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    } else if (kind === "scale") {
      const sx = args[0] ?? 1;
      const sy = args[1] ?? sx;
      next = [sx, 0, 0, sy, 0, 0];
    } else if (kind === "rotate") {
      const ang = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const cx = args[1] ?? 0;
      const cy = args[2] ?? 0;
      // translate(cx,cy) rotate scale translate(-cx,-cy)
      next = mul(
        [1, 0, 0, 1, cx, cy],
        mul([cos, sin, -sin, cos, 0, 0], [1, 0, 0, 1, -cx, -cy]),
      );
    }
    m = mul(m, next);
  }
  return m;
}

function transformPolys(polys: Polyline2[], mat: Mat2D): Polyline2[] {
  if (mat === IDENTITY || (mat[0] === 1 && mat[1] === 0 && mat[2] === 0 && mat[3] === 1 && mat[4] === 0 && mat[5] === 0)) {
    return polys;
  }
  return polys.map((poly) => ({
    closed: poly.closed,
    points: poly.points.map((p) => applyMat(mat, p)),
  }));
}

function attr(
  tag: string,
  name: string,
): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return re.exec(tag)?.[1];
}

function numAttr(tag: string, name: string, fallback = 0): number {
  const v = attr(tag, name);
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse a length like "100", "100mm", "2in", "96px" → mm (CSS px = 96dpi). */
export function lengthToMm(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(mm|cm|in|px|pt)?\s*$/i.exec(
    raw,
  );
  if (!m) return fallback;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return fallback;
  const unit = (m[2] ?? "").toLowerCase();
  switch (unit) {
    case "cm":
      return n * 10;
    case "in":
      return n * 25.4;
    case "px":
      return (n / 96) * 25.4;
    case "pt":
      return (n / 72) * 25.4;
    case "mm":
    case "":
    default:
      return n;
  }
}

function circlePath(cx: number, cy: number, r: number): string {
  // Approximate with cubic-free polyline via A commands (two half-circles).
  return `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} Z`;
}

function ellipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): string {
  return `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} Z`;
}

function rectPath(
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
}

function extractShapePolys(openTag: string, warnings: string[]): Polyline2[] {
  const tagName = /^<\s*([a-zA-Z]+)/.exec(openTag)?.[1]?.toLowerCase();
  if (!tagName) return [];

  const mat = parseTransform(attr(openTag, "transform"));
  let polys: Polyline2[] = [];

  if (tagName === "path") {
    const d = attr(openTag, "d");
    if (!d) {
      warnings.push("Skipped <path> without d");
      return [];
    }
    try {
      polys = parsePathData(d);
    } catch (err) {
      warnings.push(
        `Bad path data: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  } else if (tagName === "line") {
    const x1 = numAttr(openTag, "x1");
    const y1 = numAttr(openTag, "y1");
    const x2 = numAttr(openTag, "x2");
    const y2 = numAttr(openTag, "y2");
    polys = [{ points: [{ x: x1, y: y1 }, { x: x2, y: y2 }], closed: false }];
  } else if (tagName === "polyline" || tagName === "polygon") {
    const pts = parsePointsAttr(attr(openTag, "points") ?? "");
    if (pts.length < 2) {
      warnings.push(`Skipped <${tagName}> with too few points`);
      return [];
    }
    polys = [{ points: pts, closed: tagName === "polygon" }];
  } else if (tagName === "rect") {
    const x = numAttr(openTag, "x");
    const y = numAttr(openTag, "y");
    const w = numAttr(openTag, "width");
    const h = numAttr(openTag, "height");
    if (w <= 0 || h <= 0) return [];
    polys = parsePathData(rectPath(x, y, w, h));
  } else if (tagName === "circle") {
    const cx = numAttr(openTag, "cx");
    const cy = numAttr(openTag, "cy");
    const r = numAttr(openTag, "r");
    if (r <= 0) return [];
    polys = parsePathData(circlePath(cx, cy, r));
  } else if (tagName === "ellipse") {
    const cx = numAttr(openTag, "cx");
    const cy = numAttr(openTag, "cy");
    const rx = numAttr(openTag, "rx");
    const ry = numAttr(openTag, "ry");
    if (rx <= 0 || ry <= 0) return [];
    polys = parsePathData(ellipsePath(cx, cy, rx, ry));
  } else {
    return [];
  }

  return transformPolys(polys, mat);
}

/**
 * Pull drawable geometry from SVG markup without a DOM.
 * Ignores groups beyond applying each element's own transform.
 */
export function extractSvgPolylines(svgText: string): {
  polylines: Polyline2[];
  warnings: string[];
  unitScale: number;
} {
  const warnings: string[] = [];
  const polylines: Polyline2[] = [];

  // Root <svg ...>
  const rootMatch = /<svg\b([^>]*)>/i.exec(svgText);
  const rootAttrs = rootMatch?.[1] ?? "";
  const viewBox = attr(`<svg ${rootAttrs}>`, "viewBox");
  const widthAttr = attr(`<svg ${rootAttrs}>`, "width");
  const heightAttr = attr(`<svg ${rootAttrs}>`, "height");

  let unitScale = 1;
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0) {
      const vbW = parts[2];
      const widthMm = lengthToMm(widthAttr, NaN);
      if (Number.isFinite(widthMm) && widthMm > 0) {
        unitScale = widthMm / vbW;
      }
      // else: treat viewBox units as mm
    }
  } else if (widthAttr) {
    // No viewBox — if width has explicit units other than bare number, still 1:1 user units.
    const bare = lengthToMm(widthAttr, NaN);
    if (Number.isFinite(bare) && /mm|cm|in|px|pt/i.test(widthAttr)) {
      // Shapes likely use the same user units as width number — scale if needed later.
      void heightAttr;
    }
  }

  // Self-closing or open tags for supported shapes (ignore nested content for groups).
  const shapeRe =
    /<(path|line|polyline|polygon|rect|circle|ellipse)\b([^>]*?)(\/>|>)/gi;
  let m: RegExpExecArray | null;
  while ((m = shapeRe.exec(svgText)) !== null) {
    const openTag = `<${m[1]}${m[2]}>`;
    const extracted = extractShapePolys(openTag, warnings);
    for (const poly of extracted) polylines.push(poly);
  }

  if (polylines.length === 0) {
    warnings.push("No drawable paths found in SVG.");
  }

  const scaled =
    unitScale === 1
      ? polylines
      : polylines.map((poly) => ({
          closed: poly.closed,
          points: poly.points.map((p) => ({
            x: p.x * unitScale,
            y: p.y * unitScale,
          })),
        }));

  return { polylines: scaled, warnings, unitScale };
}

/** Convert polylines to machine-view segments (all feed — preview geometry). */
export function polylinesToPreview(polys: Polyline2[]): ToolpathSegment[] {
  const segs: ToolpathSegment[] = [];
  for (const poly of polys) {
    const pts = poly.points;
    for (let i = 1; i < pts.length; i++) {
      segs.push({
        from: { x: pts[i - 1].x, y: pts[i - 1].y, z: 0 },
        to: { x: pts[i].x, y: pts[i].y, z: 0 },
        motion: "feed",
      });
    }
    if (poly.closed && pts.length >= 2) {
      const a = pts[pts.length - 1];
      const b = pts[0];
      if (a.x !== b.x || a.y !== b.y) {
        segs.push({
          from: { x: a.x, y: a.y, z: 0 },
          to: { x: b.x, y: b.y, z: 0 },
          motion: "feed",
        });
      }
    }
  }
  return segs;
}

/** Import SVG file text into CNC-ready geometry + preview. */
export function importSvg(name: string, text: string): SvgImportResult {
  const { polylines: raw, warnings } = extractSvgPolylines(text);
  const polylines = normalizePolylinesForCnc(raw, {
    flipY: true,
    pinOrigin: true,
  });
  const bounds = boundsOfPolylines(polylines);
  const preview = polylinesToPreview(polylines);
  return { name, text, polylines, bounds, preview, warnings };
}
