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
   * Offset of the stock’s SW (min-X, min-Y) corner from bed origin (mm).
   * Bed origin is soft-travel min (usually machine home / work view origin).
   */
  offsetXMm: number;
  offsetYMm: number;
}

export const DEFAULT_STOCK: StockConfig = {
  widthMm: 300,
  lengthMm: 200,
  thicknessMm: 18,
  offsetXMm: 0,
  offsetYMm: 0,
};

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
    return {
      widthMm: parsed.widthMm,
      lengthMm: parsed.lengthMm,
      thicknessMm: parsed.thicknessMm,
      offsetXMm: parsed.offsetXMm,
      offsetYMm: parsed.offsetYMm,
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
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Place stock so a chosen corner sits at bed origin (0,0) or against max travel.
 * `bedWidth` / `bedDepth` are soft-travel extents used for E/N corners.
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
