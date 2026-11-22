/**
 * Workpiece / stock size and placement on the bed.
 * Persisted locally so the visualizer remembers the blank between sessions.
 */

export type StockCorner = "sw" | "se" | "nw" | "ne";

export interface StockConfig {
  /** Stock width along X (mm). */
  widthMm: number;
  /** Stock length along Y (mm). */
  lengthMm: number;
  /** Stock thickness along Z (mm) — informational / future depth checks. */
  thicknessMm: number;
  /**
   * Offset of the stock’s SW (min-X, min-Y) corner in work mm.
   * After “set corner from toolhead”, the chosen corner sits at work (0,0).
   */
  offsetXMm: number;
  offsetYMm: number;
  /**
   * Corner that was anchored at work origin (toolhead set).
   * Width/length edits keep this corner fixed when present.
   */
  originCorner?: StockCorner;
}

export const DEFAULT_STOCK: StockConfig = {
  widthMm: 300,
  lengthMm: 200,
  thicknessMm: 18,
  offsetXMm: 0,
  offsetYMm: 0,
  originCorner: "sw",
};

/** Minimum interactive width / length (mm). */
export const MIN_STOCK_XY_MM = 1;

const CORNER_IDS: StockCorner[] = ["sw", "se", "nw", "ne"];

function parseCorner(v: unknown): StockCorner | undefined {
  return typeof v === "string" && (CORNER_IDS as string[]).includes(v)
    ? (v as StockCorner)
    : undefined;
}

const STOCK_STORAGE_KEY = "sharpcnc.stock.v1";

function isPositiveFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Load persisted stock size / placement. */
export function loadStock(): StockConfig {
  try {
    const raw = localStorage.getItem(STOCK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STOCK };
    const parsed = JSON.parse(raw) as Partial<StockConfig>;
    if (
      !isPositiveFinite(parsed.widthMm) ||
      !isPositiveFinite(parsed.lengthMm) ||
      !isPositiveFinite(parsed.thicknessMm) ||
      !isFiniteNum(parsed.offsetXMm) ||
      !isFiniteNum(parsed.offsetYMm)
    ) {
      return { ...DEFAULT_STOCK };
    }
    const originCorner = parseCorner(parsed.originCorner) ?? "sw";
    return {
      widthMm: parsed.widthMm,
      lengthMm: parsed.lengthMm,
      thicknessMm: parsed.thicknessMm,
      offsetXMm: parsed.offsetXMm,
      offsetYMm: parsed.offsetYMm,
      originCorner,
    };
  } catch {
    return { ...DEFAULT_STOCK };
  }
}

/** Persist stock size / placement. */
export function saveStock(stock: StockConfig): void {
  try {
    localStorage.setItem(
      STOCK_STORAGE_KEY,
      JSON.stringify({
        widthMm: stock.widthMm,
        lengthMm: stock.lengthMm,
        thicknessMm: stock.thicknessMm,
        offsetXMm: stock.offsetXMm,
        offsetYMm: stock.offsetYMm,
        originCorner: stock.originCorner ?? "sw",
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Place stock so a chosen corner sits at bed origin (0,0) or against max travel.
 * `bedWidth` / `bedDepth` are soft-travel extents used for E/N corners.
 * Secondary to the toolhead work-origin flow — bed framing only.
 */
export function stockOffsetForCorner(
  stock: Pick<StockConfig, "widthMm" | "lengthMm">,
  corner: StockCorner,
  bedWidth: number,
  bedDepth: number,
): { offsetXMm: number; offsetYMm: number } {
  const w = Math.max(0.01, stock.widthMm);
  const l = Math.max(0.01, stock.lengthMm);
  switch (corner) {
    case "sw":
      return { offsetXMm: 0, offsetYMm: 0 };
    case "se":
      return { offsetXMm: Math.max(0, bedWidth - w), offsetYMm: 0 };
    case "nw":
      return { offsetXMm: 0, offsetYMm: Math.max(0, bedDepth - l) };
    case "ne":
      return {
        offsetXMm: Math.max(0, bedWidth - w),
        offsetYMm: Math.max(0, bedDepth - l),
      };
  }
}

/**
 * Place a chosen stock corner at work (0,0) — used after setting XY zero at the
 * toolhead on that corner. Size grows away from that corner.
 */
export function stockOffsetForWorkOriginCorner(
  stock: Pick<StockConfig, "widthMm" | "lengthMm">,
  corner: StockCorner,
): { offsetXMm: number; offsetYMm: number } {
  const w = Math.max(MIN_STOCK_XY_MM, stock.widthMm);
  const l = Math.max(MIN_STOCK_XY_MM, stock.lengthMm);
  switch (corner) {
    case "sw":
      return { offsetXMm: 0, offsetYMm: 0 };
    case "se":
      return { offsetXMm: -w, offsetYMm: 0 };
    case "nw":
      return { offsetXMm: 0, offsetYMm: -l };
    case "ne":
      return { offsetXMm: -w, offsetYMm: -l };
  }
}

/** Recompute SW offset so `originCorner` stays at work (0,0) after a size edit. */
export function applyStockSizeKeepingOrigin(
  stock: StockConfig,
  size: Partial<Pick<StockConfig, "widthMm" | "lengthMm" | "thicknessMm">>,
): StockConfig {
  const next: StockConfig = {
    ...stock,
    ...size,
    widthMm: Math.max(
      MIN_STOCK_XY_MM,
      size.widthMm ?? stock.widthMm,
    ),
    lengthMm: Math.max(
      MIN_STOCK_XY_MM,
      size.lengthMm ?? stock.lengthMm,
    ),
    thicknessMm: Math.max(
      MIN_STOCK_XY_MM,
      size.thicknessMm ?? stock.thicknessMm,
    ),
  };
  const corner = next.originCorner ?? "sw";
  return {
    ...next,
    originCorner: corner,
    ...stockOffsetForWorkOriginCorner(next, corner),
  };
}

/** Resize / select handle ids (cardinal + corners). */
export type StockHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

export type StockHit = StockHandle | "body";

/** Round mm values for drag/resize so numeric fields stay readable. */
export function roundStockMm(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10) / 10;
}

/**
 * Soft bed clamp for optional drag/resize fine-tune.
 * Keeps the full stock rectangle inside soft-travel [0,bedW]×[0,bedD]
 * (no negative / off-bed placement while dragging or resizing).
 * Work-origin corner placement (`stockOffsetForWorkOriginCorner`) is separate
 * and may still sit a corner at work (0,0) with stock extending into −X/−Y
 * until the blank is fine-tuned.
 */
export function clampStockToBed(
  stock: StockConfig,
  bedWidth: number,
  bedDepth: number,
): StockConfig {
  const bedW = Math.max(MIN_STOCK_XY_MM, bedWidth);
  const bedD = Math.max(MIN_STOCK_XY_MM, bedDepth);
  const widthMm = Math.min(
    bedW,
    Math.max(MIN_STOCK_XY_MM, stock.widthMm),
  );
  const lengthMm = Math.min(
    bedD,
    Math.max(MIN_STOCK_XY_MM, stock.lengthMm),
  );

  const offsetXMm = Math.min(
    bedW - widthMm,
    Math.max(0, stock.offsetXMm),
  );
  const offsetYMm = Math.min(
    bedD - lengthMm,
    Math.max(0, stock.offsetYMm),
  );

  return {
    ...stock,
    widthMm: roundStockMm(widthMm),
    lengthMm: roundStockMm(lengthMm),
    thicknessMm: Math.max(MIN_STOCK_XY_MM, stock.thicknessMm),
    offsetXMm: roundStockMm(offsetXMm),
    offsetYMm: roundStockMm(offsetYMm),
  };
}

/** Optional fine-tune: translate stock; clears work-origin anchor. */
export function moveStockBy(
  stock: StockConfig,
  dxMm: number,
  dyMm: number,
  bedWidth: number,
  bedDepth: number,
): StockConfig {
  const { originCorner: _drop, ...rest } = stock;
  void _drop;
  return clampStockToBed(
    {
      ...rest,
      offsetXMm: stock.offsetXMm + dxMm,
      offsetYMm: stock.offsetYMm + dyMm,
    },
    bedWidth,
    bedDepth,
  );
}

/**
 * Optional fine-tune: resize stock from a handle (work-mm pointer).
 * Edges stay inside soft-travel [0,bed]×[0,bed]; use numeric W/L for accuracy.
 * Cleared originCorner (drag broke the work-origin anchor).
 */
export function resizeStockFromHandle(
  stock: StockConfig,
  handle: StockHandle,
  pointer: { x: number; y: number },
  bedWidth: number,
  bedDepth: number,
): StockConfig {
  const bedW = Math.max(MIN_STOCK_XY_MM, bedWidth);
  const bedD = Math.max(MIN_STOCK_XY_MM, bedDepth);

  let x0 = stock.offsetXMm;
  let y0 = stock.offsetYMm;
  let x1 = stock.offsetXMm + stock.widthMm;
  let y1 = stock.offsetYMm + stock.lengthMm;

  const px = pointer.x;
  const py = pointer.y;

  if (handle === "w" || handle === "nw" || handle === "sw") x0 = px;
  if (handle === "e" || handle === "ne" || handle === "se") x1 = px;
  if (handle === "s" || handle === "sw" || handle === "se") y0 = py;
  if (handle === "n" || handle === "nw" || handle === "ne") y1 = py;

  // Keep moving edges on the soft bed so the opposite edge stays fixed.
  x0 = Math.min(bedW, Math.max(0, x0));
  x1 = Math.min(bedW, Math.max(0, x1));
  y0 = Math.min(bedD, Math.max(0, y0));
  y1 = Math.min(bedD, Math.max(0, y1));

  if (x1 - x0 < MIN_STOCK_XY_MM) {
    if (handle === "w" || handle === "nw" || handle === "sw") {
      x0 = Math.max(0, x1 - MIN_STOCK_XY_MM);
    } else {
      x1 = Math.min(bedW, x0 + MIN_STOCK_XY_MM);
    }
  }
  if (y1 - y0 < MIN_STOCK_XY_MM) {
    if (handle === "s" || handle === "sw" || handle === "se") {
      y0 = Math.max(0, y1 - MIN_STOCK_XY_MM);
    } else {
      y1 = Math.min(bedD, y0 + MIN_STOCK_XY_MM);
    }
  }

  const { originCorner: _drop, ...rest } = stock;
  void _drop;
  return clampStockToBed(
    {
      ...rest,
      offsetXMm: x0,
      offsetYMm: y0,
      widthMm: x1 - x0,
      lengthMm: y1 - y0,
    },
    bedWidth,
    bedDepth,
  );
}

/** Axis-aligned stock bounds in work mm (Y up). */
export function stockBounds(stock: StockConfig): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  return {
    x0: stock.offsetXMm,
    y0: stock.offsetYMm,
    x1: stock.offsetXMm + stock.widthMm,
    y1: stock.offsetYMm + stock.lengthMm,
  };
}

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * Hit-test stock body / resize handles in work mm.
 * `handleHitMm` is half the handle pick size (already converted from screen px).
 */
export function hitTestStock(
  stock: StockConfig,
  workX: number,
  workY: number,
  handleHitMm: number,
  selected: boolean,
): StockHit | null {
  const { x0, y0, x1, y1 } = stockBounds(stock);
  const tol = Math.max(handleHitMm, MIN_STOCK_XY_MM * 0.5);

  if (selected) {
    const onW = near(workX, x0, tol);
    const onE = near(workX, x1, tol);
    const onS = near(workY, y0, tol);
    const onN = near(workY, y1, tol);
    const inX = workX >= x0 - tol && workX <= x1 + tol;
    const inY = workY >= y0 - tol && workY <= y1 + tol;

    if (onN && onW) return "nw";
    if (onN && onE) return "ne";
    if (onS && onW) return "sw";
    if (onS && onE) return "se";
    if (onN && inX) return "n";
    if (onS && inX) return "s";
    if (onW && inY) return "w";
    if (onE && inY) return "e";
  }

  if (workX >= x0 && workX <= x1 && workY >= y0 && workY <= y1) {
    return "body";
  }
  return null;
}

/** CSS resize cursor for a handle (work Y up; screen Y down — N/S still match). */
export function cursorForStockHit(hit: StockHit | null): string | null {
  switch (hit) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "body":
      return "move";
    default:
      return null;
  }
}
