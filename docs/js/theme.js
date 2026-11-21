/**
 * Persist dark/light theme the same way as the SharpCNC app (data-theme on <html>).
 */
(function () {
  const KEY = "sharpcnc.uiTheme.v1";
  const root = document.documentElement;

  function readTheme() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      /* ignore */
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      const next = theme === "dark" ? "Light" : "Dark";
      btn.textContent = next;
      btn.setAttribute("aria-label", `Switch to ${next.toLowerCase()} theme`);
    }
  }

  function toggleTheme() {
    const next =
      root.getAttribute("data-theme") === "light" ? "dark" : "light";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  }

  applyTheme(readTheme());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(readTheme());
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.addEventListener("click", toggleTheme);
  });
})();
