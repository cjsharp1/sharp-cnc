/**
 * Smoke: stock placement + tool profile persistence helpers + SVG diameter handoff.
 * Run: npx --yes tsx scripts/smoke-stock-tool.mts
 */
import {
  DEFAULT_STOCK,
  stockOffsetForCorner,
  type StockConfig,
} from "../src/grbl/stockConfig.ts";
import {
  DEFAULT_TOOL,
  TOOL_BIT_LABELS,
  type ToolConfig,
} from "../src/grbl/toolConfig.ts";
import {
  DEFAULT_SVG_TOOLPATH,
  generateSvgGcode,
} from "../src/grbl/svgToolpath.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(DEFAULT_STOCK.widthMm === 300, "default stock width");
assert(DEFAULT_STOCK.lengthMm === 200, "default stock length");
assert(DEFAULT_STOCK.thicknessMm > 0, "default thickness");
assert(DEFAULT_STOCK.offsetXMm === 0 && DEFAULT_STOCK.offsetYMm === 0, "origin");

const stock: StockConfig = {
  widthMm: 400,
  lengthMm: 250,
  thicknessMm: 12,
  offsetXMm: 0,
  offsetYMm: 0,
};

const bedW = 1000;
const bedD = 1000;

const sw = stockOffsetForCorner(stock, "sw", bedW, bedD);
assert(sw.offsetXMm === 0 && sw.offsetYMm === 0, "SW corner");

const se = stockOffsetForCorner(stock, "se", bedW, bedD);
assert(se.offsetXMm === 600 && se.offsetYMm === 0, "SE corner");

const nw = stockOffsetForCorner(stock, "nw", bedW, bedD);
assert(nw.offsetXMm === 0 && nw.offsetYMm === 750, "NW corner");

const ne = stockOffsetForCorner(stock, "ne", bedW, bedD);
assert(ne.offsetXMm === 600 && ne.offsetYMm === 750, "NE corner");

assert(DEFAULT_TOOL.type === "endmill", "default tool type");
assert(DEFAULT_TOOL.diameterMm === DEFAULT_SVG_TOOLPATH.toolDiameterMm, "Ø sync");
assert(TOOL_BIT_LABELS.vbit === "V-bit", "vbit label");

const tool: ToolConfig = {
  type: "endmill",
  diameterMm: 6.35,
  tipAngleDeg: 60,
};

const gcode = generateSvgGcode(
  [
    {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      closed: false,
    },
  ],
  { ...DEFAULT_SVG_TOOLPATH, toolDiameterMm: tool.diameterMm },
);
assert(gcode.includes("Tool Ø 6.35 mm"), `tool header: ${gcode.slice(0, 120)}`);

console.log("smoke-stock-tool: ok");
