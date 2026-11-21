/**
 * Persisted UI color theme (dark / light).
 * Tokens live in `src/theme.css` so a future Pages site can reuse the same variables.
 */

export type UiTheme = "dark" | "light";

export const DEFAULT_UI_THEME: UiTheme = "dark";

const THEME_STORAGE_KEY = "sharpcnc.uiTheme.v1";

function isUiTheme(value: unknown): value is UiTheme {
  return value === "dark" || value === "light";
}

/** Load preferred theme (default: dark workshop). */
export function loadUiTheme(): UiTheme {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return DEFAULT_UI_THEME;
    const parsed = JSON.parse(raw) as unknown;
    return isUiTheme(parsed) ? parsed : DEFAULT_UI_THEME;
  } catch {
    return DEFAULT_UI_THEME;
  }
}

/** Persist theme across sessions. */
export function saveUiTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Apply theme to the document root for CSS `[data-theme]` selectors. */
export function applyUiTheme(theme: UiTheme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
