/**
 * SVG path `d` → polylines (pure TS, no DOM).
 * Curves are flattened to line segments for simple 2D toolpaths.
 */

export interface Point2 {
  x: number;
  y: number;
}

/** One continuous stroke (open or closed). */
export interface Polyline2 {
  points: Point2[];
  closed: boolean;
}

const DEFAULT_CURVE_SEGMENTS = 16;
const DEFAULT_ARC_SEGMENTS = 24;

function dist(a: Point2, b: Point2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function near(a: Point2, b: Point2, eps = 1e-6): boolean {
  return dist(a, b) <= eps;
}

/** Tokenize SVG path data into command letters and numbers. */
export function tokenizePathData(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const re =
    /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1]) tokens.push(m[1]);
    else if (m[2]) tokens.push(Number(m[2]));
  }
  return tokens;
}

function cubicPoint(
  p0: Point2,
  p1: Point2,
  p2: Point2,
  p3: Point2,
  t: number,
): Point2 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

function quadPoint(p0: Point2, p1: Point2, p2: Point2, t: number): Point2 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/**
 * Approximate an SVG elliptical arc (endpoint param) as line segments.
 * Spec: https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 */
function arcToPoints(
  from: Point2,
  rx: number,
  ry: number,
  xAxisRotDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point2,
  segments: number,
): Point2[] {
  if (near(from, to) || rx === 0 || ry === 0) {
    return [to];
  }

  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  const phi = (xAxisRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  let lam = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rxAbs *= s;
    ryAbs *= s;
    lam = 1;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const num =
    rxAbs * rxAbs * ryAbs * ryAbs -
    rxAbs * rxAbs * y1p * y1p -
    ryAbs * ryAbs * x1p * x1p;
  const den = rxAbs * rxAbs * y1p * y1p + ryAbs * ryAbs * x1p * x1p;
  const cFactor = den === 0 ? 0 : sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (cFactor * (rxAbs * y1p)) / ryAbs;
  const cyp = (cFactor * (-ryAbs * x1p)) / rxAbs;

  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;

  const angle = (u: Point2, v: Point2) => {
    const n = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    if (n === 0) return 0;
    const cos = Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / n));
    const ang = Math.acos(cos);
    return u.x * v.y - u.y * v.x < 0 ? -ang : ang;
  };

  const v1 = { x: (x1p - cxp) / rxAbs, y: (y1p - cyp) / ryAbs };
  const v2 = { x: (-x1p - cxp) / rxAbs, y: (-y1p - cyp) / ryAbs };
  let theta1 = angle({ x: 1, y: 0 }, v1);
  let dTheta = angle(v1, v2);

  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const n = Math.max(2, Math.ceil((Math.abs(dTheta) / (2 * Math.PI)) * segments));
  const out: Point2[] = [];
  for (let i = 1; i <= n; i++) {
    const t = theta1 + (dTheta * i) / n;
    const x = rxAbs * Math.cos(t);
    const y = ryAbs * Math.sin(t);
    out.push({
      x: cosPhi * x - sinPhi * y + cx,
      y: sinPhi * x + cosPhi * y + cy,
    });
  }
  return out;
}

/**
 * Parse an SVG path `d` string into polylines.
 * Supports M/L/H/V/C/S/Q/T/A/Z (absolute + relative).
 */
export function parsePathData(
  d: string,
  options?: { curveSegments?: number; arcSegments?: number },
): Polyline2[] {
  const curveSegs = options?.curveSegments ?? DEFAULT_CURVE_SEGMENTS;
  const arcSegs = options?.arcSegments ?? DEFAULT_ARC_SEGMENTS;
  const tokens = tokenizePathData(d);
  const polys: Polyline2[] = [];

  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastCtrl: Point2 | null = null;
  let lastWasCubic = false;
  let lastWasQuad = false;
  let current: Point2[] = [];

  const flush = (closed: boolean) => {
    if (current.length >= 2) {
      polys.push({ points: current, closed });
    } else if (current.length === 1 && closed) {
      // Degenerate — skip.
    }
    current = [];
  };

  const push = (p: Point2) => {
    if (current.length === 0 || !near(current[current.length - 1], p)) {
      current.push(p);
    }
  };

  const readNum = (): number => {
    const v = tokens[i++];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error("Expected number in SVG path data");
    }
    return v;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === "string") {
      cmd = t;
      i++;
      if (cmd === "Z" || cmd === "z") {
        if (current.length > 0) {
          push({ x: startX, y: startY });
          flush(true);
          cx = startX;
          cy = startY;
        }
        lastCtrl = null;
        lastWasCubic = false;
        lastWasQuad = false;
        continue;
      }
    } else if (!cmd) {
      throw new Error("SVG path data missing initial command");
    }

    const abs = cmd === cmd.toUpperCase();
    const c = cmd.toUpperCase();

    if (c === "M") {
      const x = readNum();
      const y = readNum();
      const nx = abs ? x : cx + x;
      const ny = abs ? y : cy + y;
      flush(false);
      cx = nx;
      cy = ny;
      startX = nx;
      startY = ny;
      current = [{ x: nx, y: ny }];
      lastCtrl = null;
      lastWasCubic = false;
      lastWasQuad = false;
      // Implicit L for extra pairs.
      cmd = abs ? "L" : "l";
      continue;
    }

    if (c === "L") {
      const x = readNum();
      const y = readNum();
      cx = abs ? x : cx + x;
      cy = abs ? y : cy + y;
      push({ x: cx, y: cy });
      lastWasCubic = false;
      lastWasQuad = false;
      continue;
    }

    if (c === "H") {
      const x = readNum();
      cx = abs ? x : cx + x;
      push({ x: cx, y: cy });
      lastWasCubic = false;
      lastWasQuad = false;
      continue;
    }

    if (c === "V") {
      const y = readNum();
      cy = abs ? y : cy + y;
      push({ x: cx, y: cy });
      lastWasCubic = false;
      lastWasQuad = false;
      continue;
    }

    if (c === "C") {
      const x1 = readNum();
      const y1 = readNum();
      const x2 = readNum();
      const y2 = readNum();
      const x = readNum();
      const y = readNum();
      const p0 = { x: cx, y: cy };
      const p1 = abs ? { x: x1, y: y1 } : { x: cx + x1, y: cy + y1 };
      const p2 = abs ? { x: x2, y: y2 } : { x: cx + x2, y: cy + y2 };
      const p3 = abs ? { x, y } : { x: cx + x, y: cy + y };
      for (let s = 1; s <= curveSegs; s++) {
        push(cubicPoint(p0, p1, p2, p3, s / curveSegs));
      }
      lastCtrl = p2;
      lastWasCubic = true;
      lastWasQuad = false;
      cx = p3.x;
      cy = p3.y;
      continue;
    }

    if (c === "S") {
      const x2 = readNum();
      const y2 = readNum();
      const x = readNum();
      const y = readNum();
      const p0: Point2 = { x: cx, y: cy };
      const p1: Point2 =
        lastWasCubic && lastCtrl
          ? { x: 2 * cx - lastCtrl.x, y: 2 * cy - lastCtrl.y }
          : { x: cx, y: cy };
      const p2: Point2 = abs ? { x: x2, y: y2 } : { x: cx + x2, y: cy + y2 };
      const p3: Point2 = abs ? { x, y } : { x: cx + x, y: cy + y };
      for (let s = 1; s <= curveSegs; s++) {
        push(cubicPoint(p0, p1, p2, p3, s / curveSegs));
      }
      lastCtrl = p2;
      lastWasCubic = true;
      lastWasQuad = false;
      cx = p3.x;
      cy = p3.y;
      continue;
    }

    if (c === "Q") {
      const x1 = readNum();
      const y1 = readNum();
      const x = readNum();
      const y = readNum();
      const p0: Point2 = { x: cx, y: cy };
      const p1: Point2 = abs ? { x: x1, y: y1 } : { x: cx + x1, y: cy + y1 };
      const p2: Point2 = abs ? { x, y } : { x: cx + x, y: cy + y };
      for (let s = 1; s <= curveSegs; s++) {
        push(quadPoint(p0, p1, p2, s / curveSegs));
      }
      lastCtrl = p1;
      lastWasCubic = false;
      lastWasQuad = true;
      cx = p2.x;
      cy = p2.y;
      continue;
    }

    if (c === "T") {
      const x = readNum();
      const y = readNum();
      const p0: Point2 = { x: cx, y: cy };
      const p1: Point2 =
        lastWasQuad && lastCtrl
          ? { x: 2 * cx - lastCtrl.x, y: 2 * cy - lastCtrl.y }
          : { x: cx, y: cy };
      const p2: Point2 = abs ? { x, y } : { x: cx + x, y: cy + y };
      for (let s = 1; s <= curveSegs; s++) {
        push(quadPoint(p0, p1, p2, s / curveSegs));
      }
      lastCtrl = p1;
      lastWasCubic = false;
      lastWasQuad = true;
      cx = p2.x;
      cy = p2.y;
      continue;
    }

    if (c === "A") {
      const rx = readNum();
      const ry = readNum();
      const rot = readNum();
      const large = readNum() !== 0;
      const sweep = readNum() !== 0;
      const x = readNum();
      const y = readNum();
      const to = abs ? { x, y } : { x: cx + x, y: cy + y };
      const pts = arcToPoints(
        { x: cx, y: cy },
        rx,
        ry,
        rot,
        large,
        sweep,
        to,
        arcSegs,
      );
      for (const p of pts) push(p);
      cx = to.x;
      cy = to.y;
      lastWasCubic = false;
      lastWasQuad = false;
      lastCtrl = null;
      continue;
    }

    throw new Error(`Unsupported SVG path command: ${cmd}`);
  }

  flush(false);
  return polys;
}

/** Axis-aligned bounds of polylines. */
export function boundsOfPolylines(
  polys: Polyline2[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const poly of polys) {
    for (const p of poly.points) {
      any = true;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  return any ? { minX, minY, maxX, maxY } : null;
}

/** Map SVG Y-down coords → CNC Y-up and optionally pin bottom-left to origin. */
export function normalizePolylinesForCnc(
  polys: Polyline2[],
  options?: { pinOrigin?: boolean; flipY?: boolean },
): Polyline2[] {
  const pinOrigin = options?.pinOrigin ?? true;
  const flipY = options?.flipY ?? true;

  const flipped = flipY
    ? polys.map((poly) => ({
        closed: poly.closed,
        points: poly.points.map((p) => ({ x: p.x, y: -p.y })),
      }))
    : polys;

  if (!pinOrigin) return flipped;

  const b = boundsOfPolylines(flipped);
  if (!b) return [];

  return flipped.map((poly) => ({
    closed: poly.closed,
    points: poly.points.map((p) => ({
      x: p.x - b.minX,
      y: p.y - b.minY,
    })),
  }));
}
