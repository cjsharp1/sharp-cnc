/**
 * Smoke: scale-accurate machine view camera / grid math.
 * Run: npx --yes tsx scripts/smoke-machine-view.mts
 */
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampCamera,
  fitCamera,
  gridSpacing,
  gridTicks,
  mapWorkToSvg,
  panByMm,
  visibleWindow,
  viewBoxForCamera,
  zoomAtPoint,
} from "../src/components/machineViewMath.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const bed = { width: 1000, depth: 1000 };
const viewport = { width: 800, height: 500 };

const fit = fitCamera(bed);
assert(fit.zoom === MIN_ZOOM, "fit zoom is 1");
assert(fit.cx === 500 && fit.cy === 500, "fit centers square bed");

const visFit = visibleWindow(bed, viewport, fit.zoom);
assert(visFit.pxPerMm > 0, "px/mm positive");
// Uniform scale: visible aspect must match viewport aspect.
assert(
  Math.abs(visFit.width / visFit.height - viewport.width / viewport.height) <
    1e-9,
  "visible window matches viewport aspect",
);
// Full 1000×1000 bed fits inside the visible window.
assert(visFit.width >= 1000, "fit shows full bed width");
assert(visFit.height >= 1000, "fit shows full bed depth");

const vb = viewBoxForCamera(bed, viewport, fit);
assert(vb.w === visFit.width && vb.h === visFit.height, "viewBox size");

// True aspect: a square bed must map X/Y equally (pxPerMm shared).
const mappedSW = mapWorkToSvg(0, 0, bed);
const mappedNE = mapWorkToSvg(1000, 1000, bed);
assert(mappedSW.x === 0 && mappedSW.y === 1000, "SW maps to bottom-left");
assert(mappedNE.x === 1000 && mappedNE.y === 0, "NE maps to top-right");
assert(
  Math.abs(mappedNE.x - mappedSW.x) === Math.abs(mappedSW.y - mappedNE.y),
  "1000×1000 bed spans equal X/Y in mapped space",
);

// Zoom toward a point keeps that point as the zoom anchor math.
const zoomed = zoomAtPoint(bed, viewport, fit, 4, 200, 300);
assert(zoomed.zoom === 4, "zoom ×4");
assert(zoomed.zoom <= MAX_ZOOM, "under max");
const visZ = visibleWindow(bed, viewport, zoomed.zoom);
assert(visZ.width < visFit.width / 3, "zoomed-in window is smaller");

// Pan can reach a corner when zoomed.
const panned = panByMm(bed, viewport, zoomed, -200, -200);
assert(panned.cx !== zoomed.cx || panned.cy !== zoomed.cy, "pan moves camera");

const clamped = clampCamera(bed, viewport, {
  cx: -9999,
  cy: 9999,
  zoom: 8,
});
assert(clamped.cx >= 0 && clamped.cx <= 1000, "cx clamped to bed");
assert(clamped.cy >= 0 && clamped.cy <= 1000, "cy clamped to bed");

// Grid: coarse when zoomed out, finer when zoomed in.
const coarse = gridSpacing(visFit.pxPerMm);
assert(coarse.major === 100, "fit major grid 100 mm");
assert(coarse.minor >= 50, "fit minor is coarse");

const fine = gridSpacing(visFit.pxPerMm * 20);
assert(fine.minor <= 10, "zoomed minor ≤ 10 mm");
assert(fine.major % fine.minor === 0, "major multiple of minor");

const ticks = gridTicks(0, 1000, 100);
assert(ticks.length === 11, "0..1000 step 100 → 11 ticks");
assert(ticks[0] === 0 && ticks[10] === 1000, "tick ends");

// Non-square bed still gets uniform px/mm (aspect preserved via viewBox).
const wide = { width: 1200, depth: 600 };
const visWide = visibleWindow(wide, viewport, 1);
assert(
  Math.abs(visWide.width / visWide.height - viewport.width / viewport.height) <
    1e-9,
  "non-square bed still matches viewport aspect for true scale",
);

console.log("smoke-machine-view: ok");
