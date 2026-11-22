/**
 * Optional toolhead walk around the stock blank perimeter (work → machine via WCO).
 * Mirrors bed travel: safe Z retract, cancelable `$J=` cruise + approach near corners.
 */
import {
  distanceToSoftEdgeMm,
} from "./bedTravelTest";
import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import {
  MAX_JOG_FEED_MM_MIN,
  checkSoftLimits,
  type JogDelta,
} from "./jog";
import { stockBounds, type StockConfig } from "./stockConfig";
import type { Position3 } from "./types";

export { distanceToSoftEdgeMm };

/** Cruise feed along stock edges (mm/min). */
export const STOCK_PERIMETER_CRUISE_FEED_MM_MIN = 1200;
/** Slow feed within approach distance of a stock corner. */
export const STOCK_PERIMETER_APPROACH_FEED_MM_MIN = 200;
/** Distance from a target corner where feed drops (mm). */
export const STOCK_PERIMETER_APPROACH_MM = 20;
/** When max Z is unknown, lift this many mm before XY travel. */
export const STOCK_PERIMETER_SAFE_Z_LIFT_MM = 15;
/** Leave this much headroom below soft max Z when retracting. */
export const STOCK_PERIMETER_Z_MARGIN_MM = 2;
/** Pulse proximity sound when distance-to-edge crosses below this (mm). */
export const STOCK_PERIMETER_PROXIMITY_MM = 25;

export type StockPerimeterCornerId = "SW" | "SE" | "NE" | "NW";

export type StockPerimeterSegmentPhase = "retract" | "cruise" | "approach";

export interface StockPerimeterGate {
  ok: boolean;
  reason?: string;
}

export interface StockPerimeterSegment {
  id: string;
  label: string;
  /** Corner this segment finishes at (XY), if any. */
  corner: StockPerimeterCornerId | null;
  phase: StockPerimeterSegmentPhase;
  feedMmMin: number;
  delta: JogDelta;
  /** Absolute machine position after this segment. */
  targetMachine: Position3;
  /** Work XY of the target (when XY moves). */
  targetWork: { x: number; y: number } | null;
  /** Min distance to soft X/Y edge at the segment end. */
  distanceToEdgeMm: number;
  /**
   * True when this segment crosses into the proximity band
   * (for a single beep — not continuous spam).
   */
  proximityPulse: boolean;
  /** GRBL jog command (`$J=` incremental). */
  command: string;
}

export interface StockPerimeterPlan {
  ok: boolean;
  blocked?: string;
  warnings: string[];
  segments: StockPerimeterSegment[];
  corners: StockPerimeterCornerId[];
  /** Work-space rectangle used for the path. */
  workBounds: { x0: number; y0: number; x1: number; y1: number } | null;
}

export interface PlanStockPerimeterOptions {
  machine: Position3;
  softTravel: SoftTravelLimits;
  /** GRBL `$20` soft limits enabled. */
  softLimitsOn: boolean;
  stock: StockConfig;
  /** Work coordinate offset (machine = work + WCO). */
  wco: Position3;
  cruiseFeedMmMin?: number;
  approachFeedMmMin?: number;
  approachMm?: number;
  safeZLiftMm?: number;
  proximityMm?: number;
}

const CORNER_ORDER: StockPerimeterCornerId[] = ["SW", "SE", "NE", "NW", "SW"];

function fmt(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

function clampFeed(feed: number): number {
  return Math.min(Math.max(1, Math.round(feed)), MAX_JOG_FEED_MM_MIN);
}

function buildIncJog(delta: JogDelta, feedMmMin: number): string {
  const feed = clampFeed(feedMmMin);
  const parts: string[] = ["$J=G91", "G21"];
  if (delta.x !== undefined && delta.x !== 0) parts.push(`X${fmt(delta.x)}`);
  if (delta.y !== undefined && delta.y !== 0) parts.push(`Y${fmt(delta.y)}`);
  if (delta.z !== undefined && delta.z !== 0) parts.push(`Z${fmt(delta.z)}`);
  parts.push(`F${feed}`);
  return parts.join(" ");
}

/** Work-space corner of the stock blank (Y up). */
export function stockCornerWork(
  stock: StockConfig,
  corner: StockPerimeterCornerId,
): { x: number; y: number } {
  const b = stockBounds(stock);
  switch (corner) {
    case "SW":
      return { x: b.x0, y: b.y0 };
    case "SE":
      return { x: b.x1, y: b.y0 };
    case "NE":
      return { x: b.x1, y: b.y1 };
    case "NW":
      return { x: b.x0, y: b.y1 };
  }
}

/** Machine XY for a stock corner via WCO. */
export function stockCornerMachine(
  stock: StockConfig,
  corner: StockPerimeterCornerId,
  wco: Position3,
  z: number,
): Position3 {
  const work = stockCornerWork(stock, corner);
  return {
    x: work.x + wco.x,
    y: work.y + wco.y,
    z,
  };
}

/**
 * Refuse when soft travel, stock size, or WCO is not ready.
 */
export function canStartStockPerimeterTest(
  softTravel: SoftTravelLimits,
  softLimitsOn: boolean,
  stock: StockConfig,
  wco: Position3 | null | undefined,
): StockPerimeterGate {
  if (!softLimitsOn) {
    return {
      ok: false,
      reason:
        "Soft limits are off ($20=0). Enable them in Calibration → Soft travel before tracing the stock perimeter.",
    };
  }
  if (softTravel.maxX === null || softTravel.maxX <= 0) {
    return {
      ok: false,
      reason: "Max X travel ($130) is not set. Finish soft travel calibration first.",
    };
  }
  if (softTravel.maxY === null || softTravel.maxY <= 0) {
    return {
      ok: false,
      reason: "Max Y travel ($131) is not set. Finish soft travel calibration first.",
    };
  }
  if (
    !Number.isFinite(stock.widthMm) ||
    stock.widthMm <= 0 ||
    !Number.isFinite(stock.lengthMm) ||
    stock.lengthMm <= 0
  ) {
    return {
      ok: false,
      reason: "Set stock width and length first (Material & tool or Prepare → Stock).",
    };
  }
  if (
    !wco ||
    !Number.isFinite(wco.x) ||
    !Number.isFinite(wco.y) ||
    !Number.isFinite(wco.z)
  ) {
    return {
      ok: false,
      reason:
        "Work coordinates unavailable. Connect and set XY zero (Prepare → XY) so SharpCNC knows where the blank sits.",
    };
  }
  return { ok: true };
}

function xyLength(a: Position3, b: Position3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

function lerpXY(a: Position3, b: Position3, t: number, z: number): Position3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z,
  };
}

/**
 * Plan a stock-blank perimeter check: safe Z retract, then circuit the rectangle
 * corners in work space (machine via WCO) with cruise + slow approach near corners.
 * XY only at safe Z — does not cut.
 */
export function planStockPerimeterTest(
  options: PlanStockPerimeterOptions,
): StockPerimeterPlan {
  const warnings: string[] = [];
  const emptyBounds = null;
  const gate = canStartStockPerimeterTest(
    options.softTravel,
    options.softLimitsOn,
    options.stock,
    options.wco,
  );
  if (!gate.ok) {
    return {
      ok: false,
      blocked: gate.reason,
      warnings,
      segments: [],
      corners: [],
      workBounds: emptyBounds,
    };
  }

  const limits = options.softTravel;
  const stock = options.stock;
  const wco = options.wco;
  const bounds = stockBounds(stock);
  // Cap approach so small blanks still get a sensible cruise/approach split.
  const maxApproach = Math.max(
    2,
    Math.min(stock.widthMm, stock.lengthMm) * 0.35,
  );
  const approachMm = Math.min(
    options.approachMm ?? STOCK_PERIMETER_APPROACH_MM,
    maxApproach,
  );
  const cruiseFeed =
    options.cruiseFeedMmMin ?? STOCK_PERIMETER_CRUISE_FEED_MM_MIN;
  const approachFeed =
    options.approachFeedMmMin ?? STOCK_PERIMETER_APPROACH_FEED_MM_MIN;
  const proximityMm = options.proximityMm ?? STOCK_PERIMETER_PROXIMITY_MM;
  const safeZLift = options.safeZLiftMm ?? STOCK_PERIMETER_SAFE_Z_LIFT_MM;

  if (!stock.originCorner) {
    warnings.push(
      "Stock origin corner not anchored — path uses current offset + size. Set XY zero + stock corner if the blank looks wrong.",
    );
  }

  let cursor: Position3 = { ...options.machine };
  const segments: StockPerimeterSegment[] = [];
  let segIndex = 0;
  let prevDist = distanceToSoftEdgeMm(cursor, limits);

  const pushSegment = (
    target: Position3,
    feedMmMin: number,
    phase: StockPerimeterSegmentPhase,
    label: string,
    corner: StockPerimeterCornerId | null,
    targetWork: { x: number; y: number } | null,
  ): string | null => {
    const delta: JogDelta = {
      x: target.x - cursor.x,
      y: target.y - cursor.y,
      z: target.z - cursor.z,
    };
    if (
      Math.abs(delta.x ?? 0) < 1e-6 &&
      Math.abs(delta.y ?? 0) < 1e-6 &&
      Math.abs(delta.z ?? 0) < 1e-6
    ) {
      return null;
    }
    const check = checkSoftLimits(cursor, delta, limits);
    if (!check.ok) {
      return check.reason ?? "Soft-limit check failed";
    }
    const dist = distanceToSoftEdgeMm(target, limits);
    const proximityPulse =
      prevDist > proximityMm + 1e-6 && dist <= proximityMm + 1e-6;
    segments.push({
      id: `seg-${segIndex++}`,
      label,
      corner,
      phase,
      feedMmMin: clampFeed(feedMmMin),
      delta,
      targetMachine: { ...target },
      targetWork,
      distanceToEdgeMm: dist,
      proximityPulse,
      command: buildIncJog(delta, feedMmMin),
    });
    cursor = { ...target };
    prevDist = dist;
    return null;
  };

  // --- Safe Z retract (prefer raising toward soft max Z) -------------------
  const minZ = minForAxis(limits, "Z");
  const maxZ = maxForAxis(limits, "Z");
  let safeZ = cursor.z;
  if (maxZ !== null && maxZ > minZ) {
    safeZ = Math.max(cursor.z, maxZ - STOCK_PERIMETER_Z_MARGIN_MM);
    if (safeZ <= cursor.z + 1e-6) {
      warnings.push("Already near max Z — skipping retract.");
    }
  } else {
    safeZ = cursor.z + safeZLift;
    warnings.push(
      `Max Z travel ($132) unset — lifting ${safeZLift} mm before XY travel.`,
    );
  }

  if (safeZ > cursor.z + 1e-6) {
    const blocked = pushSegment(
      { x: cursor.x, y: cursor.y, z: safeZ },
      Math.min(cruiseFeed, 800),
      "retract",
      "Retract Z clear of stock",
      null,
      null,
    );
    if (blocked) {
      return {
        ok: false,
        blocked,
        warnings,
        segments: [],
        corners: [],
        workBounds: bounds,
      };
    }
  }

  const travelZ = cursor.z;
  const corners = CORNER_ORDER.slice();

  // Circuit SW→SE→NE→NW→SW around the blank
  for (let i = 0; i < CORNER_ORDER.length; i++) {
    const corner = CORNER_ORDER[i]!;
    const work = stockCornerWork(stock, corner);
    const dest = stockCornerMachine(stock, corner, wco, travelZ);
    const len = xyLength(cursor, dest);
    if (len < 1e-6) {
      continue;
    }

    if (len > approachMm * 1.5) {
      const cruiseT = (len - approachMm) / len;
      const cruiseTarget = lerpXY(cursor, dest, cruiseT, travelZ);
      const cruiseBlocked = pushSegment(
        cruiseTarget,
        cruiseFeed,
        "cruise",
        `Cruise toward stock ${corner}`,
        null,
        null,
      );
      if (cruiseBlocked) {
        return {
          ok: false,
          blocked: cruiseBlocked.includes("soft")
            ? `${cruiseBlocked} — stock corner ${corner} may be outside soft travel.`
            : cruiseBlocked,
          warnings,
          segments: [],
          corners: [],
          workBounds: bounds,
        };
      }
    }

    const approachBlocked = pushSegment(
      dest,
      approachFeed,
      "approach",
      `Approach stock ${corner}`,
      corner,
      work,
    );
    if (approachBlocked) {
      return {
        ok: false,
        blocked: approachBlocked.includes("soft")
          ? `${approachBlocked} — stock corner ${corner} may be outside soft travel.`
          : approachBlocked,
        warnings,
        segments: [],
        corners: [],
        workBounds: bounds,
      };
    }
  }

  if (segments.length === 0) {
    return {
      ok: false,
      blocked: "Nothing to move — toolhead already covers the stock perimeter.",
      warnings,
      segments: [],
      corners: [],
      workBounds: bounds,
    };
  }

  return { ok: true, warnings, segments, corners, workBounds: bounds };
}

/** Human label for progress UI. */
export function describeStockPerimeterProgress(
  segmentIndex: number,
  plan: StockPerimeterPlan,
): { current: string; next: string; percent: number } {
  const total = plan.segments.length;
  if (total === 0) {
    return { current: "—", next: "—", percent: 0 };
  }
  const idx = Math.min(Math.max(0, segmentIndex), total);
  const current = idx < total ? plan.segments[idx]!.label : "Complete";
  let nextCorner: StockPerimeterCornerId | null = null;
  for (let i = idx; i < total; i++) {
    const c = plan.segments[i]!.corner;
    if (c) {
      nextCorner = c;
      break;
    }
  }
  const next =
    idx >= total ? "Done" : nextCorner ? `Corner ${nextCorner}` : current;
  const percent = Math.round((Math.min(idx, total) / total) * 100);
  return { current, next, percent };
}
