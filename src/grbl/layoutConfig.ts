/**
 * Persisted shell layout sizes (right phase rail width).
 * Matches the localStorage JSON pattern used by theme / tool / stock prefs.
 */

/** Default right rail width — wider than the post-#86 20.5–24.5rem band. */
export const DEFAULT_SHELL_RAIL_WIDTH_PX = 448; // 28rem @ 16px

/** Narrowest usable rail (phase controls still readable). */
export const MIN_SHELL_RAIL_WIDTH_PX = 320; // 20rem

/** Widest rail before the visualizer feels squeezed on laptop widths. */
export const MAX_SHELL_RAIL_WIDTH_PX = 560; // 35rem

/** Keep at least this many pixels for the visualizer column while dragging. */
export const MIN_SHELL_MAIN_WIDTH_PX = 420;

const STORAGE_KEY = "sharpcnc.shellRailWidth.v1";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Clamp a candidate rail width into the absolute min/max band. */
export function clampShellRailWidth(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_SHELL_RAIL_WIDTH_PX;
  return Math.round(
    Math.min(MAX_SHELL_RAIL_WIDTH_PX, Math.max(MIN_SHELL_RAIL_WIDTH_PX, px)),
  );
}

/**
 * Clamp against both absolute limits and the live stage width so the
 * visualizer never collapses below {@link MIN_SHELL_MAIN_WIDTH_PX}.
 */
export function clampShellRailWidthForStage(
  px: number,
  stageWidthPx: number,
  splitterWidthPx = 10,
): number {
  const absolute = clampShellRailWidth(px);
  if (!Number.isFinite(stageWidthPx) || stageWidthPx <= 0) return absolute;
  const maxForStage = Math.max(
    MIN_SHELL_RAIL_WIDTH_PX,
    stageWidthPx - MIN_SHELL_MAIN_WIDTH_PX - splitterWidthPx,
  );
  return Math.round(Math.min(absolute, maxForStage));
}

/** Load preferred right-rail width (default: {@link DEFAULT_SHELL_RAIL_WIDTH_PX}). */
export function loadShellRailWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_SHELL_RAIL_WIDTH_PX;
    const parsed = JSON.parse(raw) as unknown;
    return isFiniteNumber(parsed)
      ? clampShellRailWidth(parsed)
      : DEFAULT_SHELL_RAIL_WIDTH_PX;
  } catch {
    return DEFAULT_SHELL_RAIL_WIDTH_PX;
  }
}

/** Persist right-rail width across sessions. */
export function saveShellRailWidth(px: number): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(clampShellRailWidth(px)),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}
