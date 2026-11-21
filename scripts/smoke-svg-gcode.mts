/**
 * Smoke: SVG path parse, import normalize, G-code generate + job handoff.
 * Run: npx --yes tsx scripts/smoke-svg-gcode.mts
 */
import { extractToolpath, loadJobFromText } from "../src/grbl/gcode.ts";
import {
  extractSvgPolylines,
  importSvg,
  isSvgFileName,
  lengthToMm,
} from "../src/grbl/svgImport.ts";
import {
  boundsOfPolylines,
  normalizePolylinesForCnc,
  parsePathData,
} from "../src/grbl/svgPath.ts";
import {
  DEFAULT_SVG_TOOLPATH,
  buildJobFromSvg,
  formatMm,
  generateSvgGcode,
} from "../src/grbl/svgToolpath.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(isSvgFileName("logo.SVG"), "svg ext");
assert(!isSvgFileName("logo.nc"), "not svg");
assert(lengthToMm("25.4mm", 0) === 25.4, "mm unit");
assert(Math.abs(lengthToMm("1in", 0) - 25.4) < 1e-9, "inch unit");
assert(formatMm(1.5) === "1.5", "formatMm");
assert(formatMm(1.500) === "1.5", "formatMm trim");

const square = parsePathData("M 0 0 H 10 V 10 H 0 Z");
assert(square.length === 1 && square[0].closed, "square closed");
assert(square[0].points.length >= 4, "square points");

const cubic = parsePathData("M 0 0 C 0 10 10 10 10 0");
assert(cubic.length === 1 && cubic[0].points.length > 2, "cubic flattened");

const arc = parsePathData("M 10 0 A 10 10 0 0 1 -10 0");
assert(arc[0].points.length > 2, "arc flattened");

const yFlip = normalizePolylinesForCnc(
  [{ points: [{ x: 0, y: 0 }, { x: 10, y: 20 }], closed: false }],
  { flipY: true, pinOrigin: true },
);
assert(yFlip[0].points[0].y === 20, "Y flip: SVG top → higher CNC Y after pin");
assert(yFlip[0].points[1].y === 0, "Y flip: SVG bottom → 0");

const sampleSvg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="80mm" height="50mm" viewBox="0 0 80 50">
  <rect x="5" y="5" width="70" height="40" fill="none"/>
  <path d="M 15 35 L 40 15 L 65 35" fill="none"/>
  <circle cx="40" cy="28" r="6" fill="none"/>
</svg>`;

const extracted = extractSvgPolylines(sampleSvg);
assert(extracted.polylines.length === 3, `expected 3 shapes, got ${extracted.polylines.length}`);
assert(extracted.unitScale === 1, "80mm / viewBox 80 → scale 1");

const imported = importSvg("sample-badge.svg", sampleSvg);
assert(imported.polylines.length === 3, "import polylines");
assert(imported.bounds !== null, "import bounds");
assert(imported.preview.length > 0, "preview segments");
assert(
  imported.bounds!.minX === 0 && imported.bounds!.minY === 0,
  "pinned origin",
);

const engraveText = generateSvgGcode(imported.polylines, {
  ...DEFAULT_SVG_TOOLPATH,
  mode: "engrave",
  depthMm: 0.5,
  feedMmMin: 600,
});
assert(engraveText.includes("G21"), "G21");
assert(engraveText.includes("G90"), "G90");
assert(engraveText.includes("G1 Z-0.5"), "plunge to depth");
assert(engraveText.includes("M2"), "program end");
assert(/G0 X[\d.]+ Y[\d.]+/.test(engraveText), "rapid XY");

const outlineJob = buildJobFromSvg("sample-badge.svg", imported.polylines, {
  ...DEFAULT_SVG_TOOLPATH,
  mode: "outline",
});
assert(outlineJob.name === "sample-badge-outline.nc", "job name");
assert(outlineJob.lines.length > 10, "job lines");
assert(outlineJob.path.length > 0, "job path overlay");

const reloaded = loadJobFromText(outlineJob.name, outlineJob.text);
const { path } = extractToolpath(reloaded.lines);
assert(path.length === outlineJob.path.length, "path extract matches job");

const b = boundsOfPolylines(imported.polylines);
assert(b && b.maxX > 50 && b.maxY > 30, "sample size ~70×40");

console.log("smoke-svg-gcode: ok");
