/**
 * First-run setup wizard: step order + completion flag (local).
 */

const STORAGE_KEY = "sharpcnc.firstRun.v1";

export type FirstRunStepId =
  | "connect"
  | "home"
  | "calibrate"
  | "travel"
  | "stock";

/** Fixed operator order: connect → home → calibrate → soft travel → stock. */
export const FIRST_RUN_STEPS: {
  id: FirstRunStepId;
  label: string;
  short: string;
}[] = [
  { id: "connect", label: "Connect", short: "1 · Connect" },
  { id: "home", label: "Home", short: "2 · Home" },
  { id: "calibrate", label: "Calibrate", short: "3 · Calibrate" },
  { id: "travel", label: "Travel", short: "4 · Travel" },
  { id: "stock", label: "Stock", short: "5 · Stock" },
];

export interface FirstRunState {
  /** Operator finished or skipped the guided setup. */
  completed: boolean;
  completedAt: number | null;
}

export const DEFAULT_FIRST_RUN: FirstRunState = {
  completed: false,
  completedAt: null,
};

export function loadFirstRunState(): FirstRunState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FIRST_RUN };
    const parsed = JSON.parse(raw) as Partial<FirstRunState>;
    return {
      completed: parsed.completed === true,
      completedAt:
        typeof parsed.completedAt === "number" ? parsed.completedAt : null,
    };
  } catch {
    return { ...DEFAULT_FIRST_RUN };
  }
}

export function saveFirstRunCompleted(completed = true): FirstRunState {
  const next: FirstRunState = {
    completed,
    completedAt: completed ? Date.now() : null,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — ignore */
  }
  return next;
}

export function resetFirstRunState(): FirstRunState {
  return saveFirstRunCompleted(false);
}
