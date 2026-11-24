/**
 * Persist whether the operator finished machine calibration (soft travel confirm).
 * Same spirit as first-run completed — surviving disconnects and relaunches.
 */

/** Guided Calibrate phase steps only (raw $$ lives in Advanced). */
export const CALIBRATION_GUIDED_STEPS = [
  "zero",
  "direction",
  "steps",
  "rates",
  // Homing arrives in PR 4; Soft travel stays last until then.
  "travel",
] as const;

export type CalibrationGuidedStepId =
  (typeof CALIBRATION_GUIDED_STEPS)[number];

const STORAGE_KEY = "sharpcnc.calibration.v1";

export interface CalibrationState {
  /** Operator finished Soft travel confirm (or explicitly marked already calibrated). */
  calibrationCompleted: boolean;
  completedAt: number | null;
}

export const DEFAULT_CALIBRATION: CalibrationState = {
  calibrationCompleted: false,
  completedAt: null,
};

export function loadCalibrationState(): CalibrationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CALIBRATION };
    const parsed = JSON.parse(raw) as Partial<CalibrationState>;
    return {
      calibrationCompleted: parsed.calibrationCompleted === true,
      completedAt:
        typeof parsed.completedAt === "number" ? parsed.completedAt : null,
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
}

export function saveCalibrationCompleted(
  completed = true,
): CalibrationState {
  const next: CalibrationState = {
    calibrationCompleted: completed,
    completedAt: completed ? Date.now() : null,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — ignore */
  }
  return next;
}

export function resetCalibrationState(): CalibrationState {
  return saveCalibrationCompleted(false);
}
