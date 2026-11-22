/**
 * Smoke: stock placement + tool profile persistence helpers + SVG diameter handoff.
 * Run: npx --yes tsx scripts/smoke-stock-tool.mts
 */
import {
  DEFAULT_STOCK,
  applyStockSizeKeepingOrigin,
  clampStockToBed,
  hitTestStock,
  moveStockBy,
  resizeStockFromHandle,
  stockOffsetForCorner,
  stockOffsetForWorkOriginCorner,
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
assert(DEFAULT_STOCK.originCorner === "sw", "default origin corner");

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

// Primary flow: stock corner at work (0,0) after toolhead XY zero.
const originSw = stockOffsetForWorkOriginCorner(stock, "sw");
assert(originSw.offsetXMm === 0 && originSw.offsetYMm === 0, "work-origin SW");
const originSe = stockOffsetForWorkOriginCorner(stock, "se");
assert(
  originSe.offsetXMm === -400 && originSe.offsetYMm === 0,
  "work-origin SE",
);
const originNw = stockOffsetForWorkOriginCorner(stock, "nw");
assert(
  originNw.offsetXMm === 0 && originNw.offsetYMm === -250,
  "work-origin NW",
);
const originNe = stockOffsetForWorkOriginCorner(stock, "ne");
assert(
  originNe.offsetXMm === -400 && originNe.offsetYMm === -250,
  "work-origin NE",
);

const anchored: StockConfig = {
  ...stock,
  ...originSe,
  originCorner: "se",
};
const grown = applyStockSizeKeepingOrigin(anchored, { widthMm: 500 });
assert(grown.widthMm === 500, "keep-origin width");
assert(grown.offsetXMm === -500 && grown.offsetYMm === 0, "SE stays at 0,0");
assert(grown.originCorner === "se", "origin corner kept");

// Fine-tune drag: allow negative offsets, refuse fully off bed.
const dragged = moveStockBy(anchored, 50, 0, bedW, bedD);
assert(dragged.offsetXMm === -350, "drag onto bed from SE origin");
assert(dragged.originCorner === undefined, "drag clears origin anchor");
const offBed = moveStockBy(anchored, -50, 0, bedW, bedD);
assert(offBed.offsetXMm === -400, "refuse drag fully off bed");
const clamped = clampStockToBed(
  { ...stock, offsetXMm: -9999, offsetYMm: 0, widthMm: 400, lengthMm: 250 },
  bedW,
  bedD,
);
assert(clamped.offsetXMm === -400, "clamp keeps edge touch at 0");

const resized = resizeStockFromHandle(
  { ...DEFAULT_STOCK, offsetXMm: 100, offsetYMm: 50 },
  "e",
  { x: 450, y: 150 },
  bedW,
  bedD,
);
assert(resized.widthMm === 350, `resize width ${resized.widthMm}`);
assert(resized.offsetXMm === 100, "west edge fixed");

assert(
  hitTestStock(DEFAULT_STOCK, 10, 10, 2, false) === "body",
  "hit body",
);
assert(
  hitTestStock(DEFAULT_STOCK, 0, 100, 5, true) === "w",
  "hit west handle",
);
assert(hitTestStock(DEFAULT_STOCK, 900, 900, 2, false) === null, "miss");

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
