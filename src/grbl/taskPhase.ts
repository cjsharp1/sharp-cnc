/**
 * Task-phase shell: Calibrate → Prepare → Verify → Run on the right rail.
 * Connect lives in the header chip (and First-run) — not a rail tab.
 * Internal id `"connect"` is the offline shell state until linked.
 * Gates decide which phases are selectable; Calibrate stays re-enterable after done.
 */

export type TaskPhaseId =
  | "connect"
  | "calibrate"
  | "prepare"
  | "verify"
  | "run";

/** Right-rail phase tabs (Connect is header-only, never listed here). */
export const TASK_PHASES: {
  id: Exclude<TaskPhaseId, "connect">;
  label: string;
  purpose: string;
}[] = [
  {
    id: "calibrate",
    label: "Calibrate",
    purpose: "Direction, steps/mm, and soft travel — once, always re-enterable",
  },
  {
    id: "prepare",
    label: "Prepare",
    purpose: "Stock, material origin, load path, then mark ready",
  },
  {
    id: "verify",
    label: "Verify",
    purpose: "Simulate and Start — last checks before the cut",
  },
  {
    id: "run",
    label: "Run",
    purpose: "Watch progress; feed/spindle overrides and stop only",
  },
];

/** Purpose line while offline (no rail tab selected). */
export const CONNECT_OFFLINE_PURPOSE =
  "Connect in the header (USB or Virtual CNC) before using the phase rail";

export interface TaskPhaseContext {
  connected: boolean;
  calibrationCompleted: boolean;
  prepareReady: boolean;
  jobLoaded: boolean;
  streaming: boolean;
}

export interface PhaseGate {
  enabled: boolean;
  reason: string | null;
}

/** Which phase to land after a successful connect. */
export function phaseAfterConnect(calibrationCompleted: boolean): TaskPhaseId {
  return calibrationCompleted ? "prepare" : "calibrate";
}

/** Exit target when a job stream ends (complete / stop / abort). */
export function phaseAfterStreamEnds(jobStillLoaded: boolean): TaskPhaseId {
  return jobStillLoaded ? "verify" : "prepare";
}

export function gateForPhase(
  id: TaskPhaseId,
  ctx: TaskPhaseContext,
): PhaseGate {
  switch (id) {
    case "connect":
      return { enabled: true, reason: null };
    case "calibrate":
      if (!ctx.connected) {
        return { enabled: false, reason: "Connect first" };
      }
      return { enabled: true, reason: null };
    case "prepare":
      if (!ctx.connected) {
        return { enabled: false, reason: "Connect first" };
      }
      if (!ctx.calibrationCompleted) {
        return { enabled: false, reason: "Finish Calibrate first" };
      }
      return { enabled: true, reason: null };
    case "verify":
      if (!ctx.connected) {
        return { enabled: false, reason: "Connect first" };
      }
      if (!ctx.calibrationCompleted) {
        return { enabled: false, reason: "Finish Calibrate first" };
      }
      if (!ctx.prepareReady) {
        return { enabled: false, reason: "Mark material ready first" };
      }
      if (!ctx.jobLoaded) {
        return { enabled: false, reason: "Load a job in Prepare first" };
      }
      return { enabled: true, reason: null };
    case "run":
      if (!ctx.connected) {
        return { enabled: false, reason: "Connect first" };
      }
      if (ctx.streaming) {
        return { enabled: true, reason: null };
      }
      return {
        enabled: false,
        reason: "Start from Verify to enter Run",
      };
    default: {
      const _exhaustive: never = id;
      void _exhaustive;
      return { enabled: false, reason: "Unknown phase" };
    }
  }
}

/** True when Start is allowed from the Verify phase UI. */
export function canStartFromVerify(ctx: TaskPhaseContext): boolean {
  return (
    ctx.connected &&
    ctx.calibrationCompleted &&
    ctx.prepareReady &&
    ctx.jobLoaded &&
    !ctx.streaming
  );
}
