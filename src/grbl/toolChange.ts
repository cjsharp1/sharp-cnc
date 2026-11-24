import type { ResumeState } from "./jobControls";

/** Seconds the spindle dwells after restore before the job continues. */
export const TOOL_CHANGE_SPINDLE_DWELL_SEC = 3;

/** Spindle stop sent once the machine is Idle at an M6 pause. */
export function buildToolChangeSpindleStop(): string {
  return "M5";
}

/**
 * Restore spindle (and dwell) after a tool change, using modal state scanned
 * from job lines before the M6. Empty when the spindle was already off.
 */
export function buildToolChangeSpindleRestore(
  state: Pick<ResumeState, "spindle" | "spindleSpeed">,
  dwellSec: number = TOOL_CHANGE_SPINDLE_DWELL_SEC,
): string[] {
  if (state.spindle !== "M3" && state.spindle !== "M4") return [];
  const speed =
    state.spindleSpeed !== null && Number.isFinite(state.spindleSpeed)
      ? ` S${Number(state.spindleSpeed)}`
      : "";
  const dwell = Math.max(0, dwellSec);
  const out = [`${state.spindle}${speed}`];
  if (dwell > 0) out.push(`G4 P${Number(dwell.toFixed(3))}`);
  return out;
}

/** True when Continue may leave the M6 pause. */
export function canContinueToolChange(options: {
  spindleStopped: boolean;
  zReprobed: boolean;
  sameToolLength: boolean;
  busy?: boolean;
}): boolean {
  if (options.busy) return false;
  if (!options.spindleStopped) return false;
  return options.zReprobed || options.sameToolLength;
}
