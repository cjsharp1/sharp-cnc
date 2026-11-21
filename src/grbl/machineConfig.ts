import type { Axis, Position3 } from "./types";

/**
 * Soft travel / bed extents known to the app.
 * Homing switches are only on the zero side; max travel is user-configured.
 * Until calibration lands, defaults match the project plan (X/Y 1000 mm; Z unset).
 */
export interface SoftTravelLimits {
  /** Max machine travel from home (mm). Null = unknown — do not soft-block that axis. */
  maxX: number | null;
  maxY: number | null;
  maxZ: number | null;
  /**
   * Assumed machine-coordinate minimum after homing (usually 0).
   * Soft-limit UI checks refuse moves below this when max is known.
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

export function maxForAxis(
  limits: SoftTravelLimits,
  axis: Axis,
): number | null {
  if (axis === "X") return limits.maxX;
  if (axis === "Y") return limits.maxY;
  return limits.maxZ;
}

export function minForAxis(limits: SoftTravelLimits, axis: Axis): number {
  if (axis === "X") return limits.min.x;
  if (axis === "Y") return limits.min.y;
  return limits.min.z;
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
