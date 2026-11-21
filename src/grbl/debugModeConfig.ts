/**
 * Persisted Debug mode preference.
 * When off, the Log tab hides Export / Copy / Debug bridge chrome for everyday use.
 */

export const DEFAULT_DEBUG_MODE = false;

const DEBUG_MODE_STORAGE_KEY = "sharpcnc.debugMode.v1";

/** Load whether Debug mode UI chrome should be shown (default: off). */
export function loadDebugMode(): boolean {
  try {
    const raw = localStorage.getItem(DEBUG_MODE_STORAGE_KEY);
    if (raw === null) return DEFAULT_DEBUG_MODE;
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "boolean" ? parsed : DEFAULT_DEBUG_MODE;
  } catch {
    return DEFAULT_DEBUG_MODE;
  }
}

/** Persist Debug mode across sessions. */
export function saveDebugMode(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_MODE_STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    /* private mode / quota — ignore */
  }
}
