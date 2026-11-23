/**
 * Prepare phase guided steps (Slice D).
 * Stepped one-screen flow — not a tall scroll stack.
 */

export const PREPARE_GUIDED_STEPS = [
  "stock",
  "xy",
  "probe",
  "load",
  "ready",
] as const;

export type PrepareGuidedStepId = (typeof PREPARE_GUIDED_STEPS)[number];
