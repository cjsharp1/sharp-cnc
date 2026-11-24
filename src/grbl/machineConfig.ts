import type { Axis, Position3 } from "./types";

/**
 * Soft travel / bed extents known to the app.
 * Homing switches are only on the zero side; max travel is user-configured.
 * Until calibration lands, defaults match the project plan (X/Y 1000 mm; Z unset).
 */
export interface SoftTravelLimits {
  /**
   * Travel length from home (mm), entered as a positive number exactly as in
   * GRBL `$130`–`$132`. Null = unknown — that side of the axis is not blocked.
   *
   * X/Y: home is the low end, so the allowed range is `[min, min + max]`.
   * Z: home is the TOP of travel, so the allowed range is
   *    `[min.z − maxZ, min.z]` — every Z below home is negative.
   */
  maxX: number | null;
  maxY: number | null;
  maxZ: number | null;
  /**
   * Machine coordinate of the home position per axis (usually 0).
   * For X/Y this is the low end of travel; for Z it is the top.
   */
  min: Position3;
}

export const DEFAULT_SOFT_TRAVEL: SoftTravelLimits = {
  maxX: 1000,
  maxY: 1000,
  maxZ: null,
  min: { x: 0, y: 0, z: 0 },
};

const SOFT_TRAVEL_STORAGE_KEY = "sharpcnc.softTravel.v1";

function isFiniteOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

/** Load persisted bed / soft-travel extents (visualizer + UI gates). */
export function loadSoftTravel(): SoftTravelLimits {
  try {
    const raw = localStorage.getItem(SOFT_TRAVEL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOFT_TRAVEL, min: { ...DEFAULT_SOFT_TRAVEL.min } };
    const parsed = JSON.parse(raw) as Partial<SoftTravelLimits>;
    if (
      !isFiniteOrNull(parsed.maxX) ||
      !isFiniteOrNull(parsed.maxY) ||
      !isFiniteOrNull(parsed.maxZ)
    ) {
      return { ...DEFAULT_SOFT_TRAVEL, min: { ...DEFAULT_SOFT_TRAVEL.min } };
    }
    const min = parsed.min;
    return {
      maxX: parsed.maxX,
      maxY: parsed.maxY,
      maxZ: parsed.maxZ,
      min: {
        x:
          min && typeof min.x === "number" && Number.isFinite(min.x)
            ? min.x
            : DEFAULT_SOFT_TRAVEL.min.x,
        y:
          min && typeof min.y === "number" && Number.isFinite(min.y)
            ? min.y
            : DEFAULT_SOFT_TRAVEL.min.y,
        z:
          min && typeof min.z === "number" && Number.isFinite(min.z)
            ? min.z
            : DEFAULT_SOFT_TRAVEL.min.z,
      },
    };
  } catch {
    return { ...DEFAULT_SOFT_TRAVEL, min: { ...DEFAULT_SOFT_TRAVEL.min } };
  }
}

/** Persist bed / soft-travel extents for the visualizer across sessions. */
export function saveSoftTravel(limits: SoftTravelLimits): void {
  try {
    localStorage.setItem(
      SOFT_TRAVEL_STORAGE_KEY,
      JSON.stringify({
        maxX: limits.maxX,
        maxY: limits.maxY,
        maxZ: limits.maxZ,
        min: limits.min,
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Highest allowed machine coordinate for an axis (null = unbounded).
 * Z: the top of travel (home), never above it.
 */
export function maxForAxis(
  limits: SoftTravelLimits,
  axis: Axis,
): number | null {
  if (axis === "X") return limits.maxX;
  if (axis === "Y") return limits.maxY;
  return limits.min.z;
}

/**
 * Lowest allowed machine coordinate for an axis.
 * Z: home minus `$132` travel; −Infinity while Z travel is unknown.
 */
export function minForAxis(limits: SoftTravelLimits, axis: Axis): number {
  if (axis === "X") return limits.min.x;
  if (axis === "Y") return limits.min.y;
  return limits.maxZ !== null ? limits.min.z - limits.maxZ : -Infinity;
}

/** Human wording for a soft-limit edge, e.g. "Z above home (top of travel)". */
export function describeSoftEdge(axis: Axis, edge: "min" | "max", value: number): string {
  if (axis === "Z") {
    return edge === "max"
      ? "Z above home (top of travel)"
      : `Z below the bottom of travel (${value} mm)`;
  }
  return edge === "max"
    ? `${axis} past far end of travel (${value} mm)`
    : `${axis} past home side (${value} mm)`;
}

/** Bed size for the machine view — use known soft max when set, else a small placeholder. */
export function bedSizeFromLimits(limits: SoftTravelLimits): {
  width: number;
  depth: number;
} {
  return {
    width: limits.maxX ?? 300,
    depth: limits.maxY ?? 200,
  };
}
