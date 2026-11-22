/** Camera / grid helpers for the scale-accurate machine bed visualizer. */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 64;
export const ZOOM_STEP = 1.35;
/** Extra margin around the bed at fit-all (1.2 ≈ 20% for axis gutters). */
export const FIT_PADDING = 1.2;

export interface BedSizeMm {
  width: number;
  depth: number;
}

export interface ViewportPx {
  width: number;
  height: number;
}

/** View center in work mm (origin = SW / front-left of bed, Y up). */
export interface ViewCamera {
  cx: number;
  cy: number;
  /** 1 = fit-all; larger = zoomed in. */
  zoom: number;
}

export interface VisibleWindowMm {
  /** Visible width/height in mm (aspect matches the SVG viewport). */
  width: number;
  height: number;
  /** Screen pixels per millimeter at the current zoom. */
  pxPerMm: number;
}

export interface GridSpacingMm {
  major: number;
  minor: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Fit-all camera: full bed centered with padding. */
export function fitCamera(bed: BedSizeMm): ViewCamera {
  return {
    cx: bed.width / 2,
    cy: bed.depth / 2,
    zoom: MIN_ZOOM,
  };
}

/**
 * Visible window in mm for a camera + CSS pixel viewport.
 * Uniform scale: 1 mm X looks the same as 1 mm Y (true aspect).
 */
export function visibleWindow(
  bed: BedSizeMm,
  viewport: ViewportPx,
  zoom: number,
): VisibleWindowMm {
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const z = clampZoom(zoom);
  const fitPxPerMm =
    Math.min(vw / (bed.width * FIT_PADDING), vh / (bed.depth * FIT_PADDING)) ||
    1;
  const pxPerMm = fitPxPerMm * z;
  return {
    width: vw / pxPerMm,
    height: vh / pxPerMm,
    pxPerMm,
  };
}

/**
 * SVG viewBox in mapped bed space (Y down from the back of the bed):
 * mappedY = bed.depth - workY.
 */
export function viewBoxForCamera(
  bed: BedSizeMm,
  viewport: ViewportPx,
  camera: ViewCamera,
): { x: number; y: number; w: number; h: number } {
  const vis = visibleWindow(bed, viewport, camera.zoom);
  return {
    x: camera.cx - vis.width / 2,
    y: bed.depth - camera.cy - vis.height / 2,
    w: vis.width,
    h: vis.height,
  };
}

/** Clamp pan so the view can still reach every bed corner when zoomed. */
export function clampCamera(
  bed: BedSizeMm,
  viewport: ViewportPx,
  camera: ViewCamera,
): ViewCamera {
  const zoom = clampZoom(camera.zoom);
  const vis = visibleWindow(bed, viewport, zoom);
  // Allow centering anywhere on the bed; when zoomed out past fit, keep centered.
  const minCx = Math.min(bed.width / 2, 0);
  const maxCx = Math.max(bed.width / 2, bed.width);
  const minCy = Math.min(bed.depth / 2, 0);
  const maxCy = Math.max(bed.depth / 2, bed.depth);
  // When the visible window is larger than the bed, lock to center.
  const cx =
    vis.width >= bed.width * FIT_PADDING
      ? bed.width / 2
      : Math.min(maxCx, Math.max(minCx, camera.cx));
  const cy =
    vis.height >= bed.depth * FIT_PADDING
      ? bed.depth / 2
      : Math.min(maxCy, Math.max(minCy, camera.cy));
  return { cx, cy, zoom };
}

/** Zoom while keeping a work-mm anchor fixed on screen. */
export function zoomAtPoint(
  bed: BedSizeMm,
  viewport: ViewportPx,
  camera: ViewCamera,
  factor: number,
  anchorX: number,
  anchorY: number,
): ViewCamera {
  const nextZoom = clampZoom(camera.zoom * factor);
  if (nextZoom === camera.zoom) {
    return clampCamera(bed, viewport, camera);
  }
  const t = camera.zoom / nextZoom;
  return clampCamera(bed, viewport, {
    zoom: nextZoom,
    cx: anchorX - (anchorX - camera.cx) * t,
    cy: anchorY - (anchorY - camera.cy) * t,
  });
}

/** Pan by a delta in work mm (Y up). */
export function panByMm(
  bed: BedSizeMm,
  viewport: ViewportPx,
  camera: ViewCamera,
  dxMm: number,
  dyMm: number,
): ViewCamera {
  return clampCamera(bed, viewport, {
    ...camera,
    cx: camera.cx - dxMm,
    cy: camera.cy - dyMm,
  });
}

/**
 * Choose major/minor grid spacing from pixels-per-mm.
 * Base major is 100 mm; finer minors appear as you zoom in.
 */
export function gridSpacing(pxPerMm: number): GridSpacingMm {
  const ppm = Number.isFinite(pxPerMm) && pxPerMm > 0 ? pxPerMm : 1;
  // Prefer minor lines roughly 16–48 px apart.
  // Coarse → fine: keep the smallest spacing that still paints ≥ ~16 px apart.
  const candidates = [100, 50, 20, 10, 5, 2, 1] as const;
  let minor: number = 100;
  for (const c of candidates) {
    if (c * ppm >= 16) minor = c;
    else break;
  }
  // Major stays a clear multiple of minor (prefer 100 mm when coarse).
  let major: number;
  if (minor >= 50) major = 100;
  else if (minor >= 10) major = 50;
  else if (minor >= 5) major = 25;
  else if (minor >= 2) major = 10;
  else major = 5;
  // Ensure major is a multiple of minor.
  if (major % minor !== 0) {
    major = minor * 5;
  }
  return { major, minor };
}

/** Inclusive tick marks from min..max at step (mm). */
export function gridTicks(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min)) return [];
  const start = Math.ceil(min / step - 1e-9) * step;
  const out: number[] = [];
  const last = max + step * 0.5;
  for (let v = start; v <= last; v += step) {
    const snapped = Math.round(v / step) * step;
    if (snapped >= min - 1e-6 && snapped <= max + 1e-6) {
      out.push(Number(snapped.toFixed(6)));
    }
    if (out.length > 4000) break;
  }
  return out;
}

/** Map work mm → SVG mapped mm (Y down from bed back). */
export function mapWorkToSvg(
  x: number,
  y: number,
  bed: BedSizeMm,
): { x: number; y: number } {
  return { x, y: bed.depth - y };
}

/** Map CSS pixel offset inside the SVG → work mm. */
export function clientToWorkMm(
  bed: BedSizeMm,
  viewport: ViewportPx,
  camera: ViewCamera,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const vb = viewBoxForCamera(bed, viewport, camera);
  const mappedX = vb.x + (localX / Math.max(1, viewport.width)) * vb.w;
  const mappedY = vb.y + (localY / Math.max(1, viewport.height)) * vb.h;
  return { x: mappedX, y: bed.depth - mappedY };
}
