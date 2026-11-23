/**
 * Verify + Run phase prefs (Slice E).
 * Dry-run default + first real-machine Start tracking.
 */

const STORAGE_KEY = "sharpcnc.verifyRun.v1";

/** Final clear-path checks before Start (session — not persisted). */
export const VERIFY_CHECKLIST = [
  { id: "plate", label: "Plate removed" },
  { id: "clamps", label: "Clamps clear" },
  { id: "path", label: "Spindle path free" },
] as const;

export type VerifyChecklistId = (typeof VERIFY_CHECKLIST)[number]["id"];

export type VerifyChecklistState = Record<VerifyChecklistId, boolean>;

export function emptyVerifyChecklist(): VerifyChecklistState {
  return { plate: false, clamps: false, path: false };
}

export function verifyChecklistComplete(state: VerifyChecklistState): boolean {
  return VERIFY_CHECKLIST.every((item) => state[item.id]);
}

export interface VerifyRunState {
  /**
   * Last dry-run toggle choice. Used after the first real-machine Start
   * (and for Virtual CNC). Before that, first real Start defaults dry-run on.
   */
  dryRunPreferred: boolean;
  /** True after at least one Start on a non-Virtual CNC port. */
  hasStartedOnRealMachine: boolean;
  /**
   * Operator dismissed the “simulate once” soft nudge — do not hard-block Start.
   */
  simNudgeDismissed: boolean;
}

export const DEFAULT_VERIFY_RUN: VerifyRunState = {
  dryRunPreferred: true,
  hasStartedOnRealMachine: false,
  simNudgeDismissed: false,
};

export function loadVerifyRunState(): VerifyRunState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_VERIFY_RUN };
    const parsed = JSON.parse(raw) as Partial<VerifyRunState>;
    return {
      dryRunPreferred: parsed.dryRunPreferred !== false,
      hasStartedOnRealMachine: parsed.hasStartedOnRealMachine === true,
      simNudgeDismissed: parsed.simNudgeDismissed === true,
    };
  } catch {
    return { ...DEFAULT_VERIFY_RUN };
  }
}

function saveVerifyRunState(next: VerifyRunState): VerifyRunState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — ignore */
  }
  return next;
}

/** Initial dry-run toggle: on for first real-machine Start; else last choice. */
export function initialDryRun(
  state: VerifyRunState,
  usingVirtualCnc: boolean,
): boolean {
  if (usingVirtualCnc) return state.dryRunPreferred;
  if (!state.hasStartedOnRealMachine) return true;
  return state.dryRunPreferred;
}

export function saveDryRunPreferred(enabled: boolean): VerifyRunState {
  const prev = loadVerifyRunState();
  return saveVerifyRunState({ ...prev, dryRunPreferred: enabled });
}

export function markStartedOnRealMachine(): VerifyRunState {
  const prev = loadVerifyRunState();
  return saveVerifyRunState({ ...prev, hasStartedOnRealMachine: true });
}

export function dismissSimNudge(): VerifyRunState {
  const prev = loadVerifyRunState();
  return saveVerifyRunState({ ...prev, simNudgeDismissed: true });
}

export function resetVerifyRunState(): VerifyRunState {
  return saveVerifyRunState({ ...DEFAULT_VERIFY_RUN });
}
