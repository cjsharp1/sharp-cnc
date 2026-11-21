import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import {
  MAX_JOG_FEED_MM_MIN,
  checkSoftLimits,
  type JogDelta,
} from "./jog";
import type { Position3 } from "./types";

/** Cruise feed across open bed (mm/min). */
export const BED_TRAVEL_CRUISE_FEED_MM_MIN = 1500;
/** Slow feed within approach distance of an edge/corner. */
export const BED_TRAVEL_APPROACH_FEED_MM_MIN = 200;
/** Distance from a target corner/edge where feed drops (mm). */
export const BED_TRAVEL_APPROACH_MM = 25;
/** When max Z is unknown, lift this many mm before XY travel. */
export const BED_TRAVEL_SAFE_Z_LIFT_MM = 15;
/** Leave this much headroom below soft max Z when retracting. */
export const BED_TRAVEL_Z_MARGIN_MM = 2;
/** Pulse proximity sound when distance-to-edge crosses below this (mm). */
export const BED_TRAVEL_PROXIMITY_MM = 30;

export type BedTravelCornerId = "SW" | "SE" | "NE" | "NW";

export type BedTravelSegmentPhase = "retract" | "cruise" | "approach";

export interface BedTravelGate {
  ok: boolean;
  reason?: string;
}

export interface BedTravelSegment {
  id: string;
  label: string;
  /** Corner this segment finishes at (XY), if any. */
  corner: BedTravelCornerId | null;
  phase: BedTravelSegmentPhase;
  feedMmMin: number;
  delta: JogDelta;
  /** Absolute machine position after this segment. */
  targetMachine: Position3;
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

export interface BedTravelPlan {
  ok: boolean;
  blocked?: string;
  warnings: string[];
  segments: BedTravelSegment[];
  corners: BedTravelCornerId[];
}

export interface PlanBedTravelOptions {
  machine: Position3;
  softTravel: SoftTravelLimits;
  /** GRBL `$20` soft limits enabled. */
  softLimitsOn: boolean;
  cruiseFeedMmMin?: number;
  approachFeedMmMin?: number;
  approachMm?: number;
  safeZLiftMm?: number;
  proximityMm?: number;
}

const CORNER_ORDER: BedTravelCornerId[] = ["SW", "SE", "NE", "NW", "SW"];

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

function cornerMachine(
  limits: SoftTravelLimits,
  corner: BedTravelCornerId,
  z: number,
): Position3 {
  const minX = minForAxis(limits, "X");
  const minY = minForAxis(limits, "Y");
  const maxX = maxForAxis(limits, "X")!;
  const maxY = maxForAxis(limits, "Y")!;
  switch (corner) {
    case "SW":
      return { x: minX, y: minY, z };
    case "SE":
      return { x: maxX, y: minY, z };
    case "NE":
      return { x: maxX, y: maxY, z };
    case "NW":
      return { x: minX, y: maxY, z };
  }
}

/** Minimum distance from a machine XY point to soft X/Y edges. */
export function distanceToSoftEdgeMm(
  machine: Position3,
  limits: SoftTravelLimits,
): number {
  const minX = minForAxis(limits, "X");
  const minY = minForAxis(limits, "Y");
  const maxX = maxForAxis(limits, "X");
  const maxY = maxForAxis(limits, "Y");
  const candidates: number[] = [
    machine.x - minX,
    machine.y - minY,
  ];
  if (maxX !== null) candidates.push(maxX - machine.x);
  if (maxY !== null) candidates.push(maxY - machine.y);
  return Math.max(0, Math.min(...candidates));
}

/**
 * Refuse the test when soft travel or `$20` is not ready.
 * Soft limits must be on; max X and Y travel must be set.
 */
export function canStartBedTravelTest(
  softTravel: SoftTravelLimits,
  softLimitsOn: boolean,
): BedTravelGate {
  if (!softLimitsOn) {
    return {
      ok: false,
      reason:
        "Soft limits are off ($20=0). Enable them in Calibration → Soft travel before running the bed travel test.",
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
 * Plan a full work-bed travel test: safe Z retract, then visit all XY corners
 * with cruise + slow approach near each edge/corner.
 */
export function planBedTravelTest(options: PlanBedTravelOptions): BedTravelPlan {
  const warnings: string[] = [];
  const gate = canStartBedTravelTest(options.softTravel, options.softLimitsOn);
  if (!gate.ok) {
    return { ok: false, blocked: gate.reason, warnings, segments: [], corners: [] };
  }

  const limits = options.softTravel;
  const approachMm = options.approachMm ?? BED_TRAVEL_APPROACH_MM;
  const cruiseFeed = options.cruiseFeedMmMin ?? BED_TRAVEL_CRUISE_FEED_MM_MIN;
  const approachFeed =
    options.approachFeedMmMin ?? BED_TRAVEL_APPROACH_FEED_MM_MIN;
  const proximityMm = options.proximityMm ?? BED_TRAVEL_PROXIMITY_MM;
  const safeZLift = options.safeZLiftMm ?? BED_TRAVEL_SAFE_Z_LIFT_MM;

  let cursor: Position3 = { ...options.machine };
  const segments: BedTravelSegment[] = [];
  let segIndex = 0;
  let prevDist = distanceToSoftEdgeMm(cursor, limits);

  const pushSegment = (
    target: Position3,
    feedMmMin: number,
    phase: BedTravelSegmentPhase,
    label: string,
    corner: BedTravelCornerId | null,
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
    safeZ = Math.max(cursor.z, maxZ - BED_TRAVEL_Z_MARGIN_MM);
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
    );
    if (blocked) {
      return { ok: false, blocked, warnings, segments: [], corners: [] };
    }
  }

  const travelZ = cursor.z;
  const corners = CORNER_ORDER.slice();

  // Start at first corner, then circuit SW→SE→NE→NW→SW
  for (let i = 0; i < CORNER_ORDER.length; i++) {
    const corner = CORNER_ORDER[i]!;
    const dest = cornerMachine(limits, corner, travelZ);
    const len = xyLength(cursor, dest);
    if (len < 1e-6) {
      // Already there (e.g. started at SW) — skip, still count as visited.
      continue;
    }

    if (len > approachMm * 1.5) {
      const cruiseT = (len - approachMm) / len;
      const cruiseTarget = lerpXY(cursor, dest, cruiseT, travelZ);
      const cruiseBlocked = pushSegment(
        cruiseTarget,
        cruiseFeed,
        "cruise",
        `Cruise toward ${corner}`,
        null,
      );
      if (cruiseBlocked) {
        return {
          ok: false,
          blocked: cruiseBlocked,
          warnings,
          segments: [],
          corners: [],
        };
      }
    }

    const approachBlocked = pushSegment(
      dest,
      approachFeed,
      "approach",
      `Approach ${corner}`,
      corner,
    );
    if (approachBlocked) {
      return {
        ok: false,
        blocked: approachBlocked,
        warnings,
        segments: [],
        corners: [],
      };
    }
  }

  if (segments.length === 0) {
    return {
      ok: false,
      blocked: "Nothing to move — machine already covers the planned path.",
      warnings,
      segments: [],
      corners: [],
    };
  }

  return { ok: true, warnings, segments, corners };
}

/** Human label for progress UI. */
export function describeBedTravelProgress(
  segmentIndex: number,
  plan: BedTravelPlan,
): { current: string; next: string; percent: number } {
  const total = plan.segments.length;
  if (total === 0) {
    return { current: "—", next: "—", percent: 0 };
  }
  const idx = Math.min(Math.max(0, segmentIndex), total);
  const current =
    idx < total ? plan.segments[idx]!.label : "Complete";
  let nextCorner: BedTravelCornerId | null = null;
  for (let i = idx; i < total; i++) {
    const c = plan.segments[i]!.corner;
    if (c) {
      nextCorner = c;
      break;
    }
  }
  const next = idx >= total ? "Done" : nextCorner ? `Corner ${nextCorner}` : current;
  const percent = Math.round((Math.min(idx, total) / total) * 100);
  return { current, next, percent };
}
