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

// Fine-tune drag: full stock stays inside [0,bed]×[0,bed] (no off-bed).
const dragged = moveStockBy(anchored, 50, 0, bedW, bedD);
assert(dragged.offsetXMm === 0, "drag snaps SE-anchored stock onto bed");
assert(dragged.offsetYMm === 0, "Y stays on bed");
assert(dragged.originCorner === undefined, "drag clears origin anchor");
const offBed = moveStockBy(
  { ...stock, offsetXMm: 10, offsetYMm: 20 },
  -100,
  -100,
  bedW,
  bedD,
);
assert(offBed.offsetXMm === 0 && offBed.offsetYMm === 0, "refuse drag off bed");
const pastMax = moveStockBy(
  { ...stock, offsetXMm: 500, offsetYMm: 600 },
  9999,
  9999,
  bedW,
  bedD,
);
assert(
  pastMax.offsetXMm === bedW - stock.widthMm &&
    pastMax.offsetYMm === bedD - stock.lengthMm,
  "refuse drag past max soft travel",
);
const clamped = clampStockToBed(
  { ...stock, offsetXMm: -9999, offsetYMm: -50, widthMm: 400, lengthMm: 250 },
  bedW,
  bedD,
);
assert(
  clamped.offsetXMm === 0 && clamped.offsetYMm === 0,
  "clamp pulls SW onto bed origin",
);
const oversized = clampStockToBed(
  { ...stock, widthMm: 2000, lengthMm: 1500, offsetXMm: 10, offsetYMm: 10 },
  bedW,
  bedD,
);
assert(
  oversized.widthMm === bedW &&
    oversized.lengthMm === bedD &&
    oversized.offsetXMm === 0 &&
    oversized.offsetYMm === 0,
  "clamp shrinks stock that exceeds soft bed",
);

const resized = resizeStockFromHandle(
  { ...DEFAULT_STOCK, offsetXMm: 100, offsetYMm: 50 },
  "e",
  { x: 450, y: 150 },
  bedW,
  bedD,
);
assert(resized.widthMm === 350, `resize width ${resized.widthMm}`);
assert(resized.offsetXMm === 100, "west edge fixed");

const resizeOffWest = resizeStockFromHandle(
  { ...DEFAULT_STOCK, offsetXMm: 100, offsetYMm: 50 },
  "w",
  { x: -80, y: 100 },
  bedW,
  bedD,
);
assert(resizeOffWest.offsetXMm === 0, "west resize stops at bed 0");
assert(
  Math.abs(resizeOffWest.widthMm - 400) < 0.05,
  `west resize keeps east edge (${resizeOffWest.widthMm})`,
);

const resizePastEast = resizeStockFromHandle(
  { ...DEFAULT_STOCK, offsetXMm: 800, offsetYMm: 50, widthMm: 100 },
  "e",
  { x: 1500, y: 100 },
  bedW,
  bedD,
);
assert(resizePastEast.offsetXMm === 800, "east resize keeps west edge");
assert(
  resizePastEast.offsetXMm + resizePastEast.widthMm === bedW,
  "east resize stops at soft max X",
);

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
