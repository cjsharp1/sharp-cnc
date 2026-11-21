/**
 * Smoke: theme config persist helpers + CSS token file present.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_UI_THEME,
  applyUiTheme,
  loadUiTheme,
  saveUiTheme,
} from "../src/grbl/themeConfig.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const themeCss = readFileSync(join(root, "src/theme.css"), "utf8");

const requiredTokens = [
  "--bg-0",
  "--brass",
  "--ink",
  "--focus-ring",
  "--viz-grid-major",
  "--viz-path-done-feed",
  "--text-brand",
  '[data-theme="light"]',
  '[data-theme="dark"]',
];

for (const token of requiredTokens) {
  if (!themeCss.includes(token)) {
    throw new Error(`theme.css missing token/selector: ${token}`);
  }
}

if (DEFAULT_UI_THEME !== "dark") {
  throw new Error("default theme should be dark");
}

// jsdom-less: stub document for applyUiTheme
const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  get length() {
    return store.size;
  },
} as Storage;

const el = { dataset: {} as Record<string, string>, style: { colorScheme: "" } };
(globalThis as { document?: { documentElement: typeof el } }).document = {
  documentElement: el,
};

saveUiTheme("light");
if (loadUiTheme() !== "light") throw new Error("load/save light failed");
applyUiTheme("light");
if (el.dataset.theme !== "light") throw new Error("apply light failed");
if (el.style.colorScheme !== "light") throw new Error("colorScheme light failed");

saveUiTheme("dark");
if (loadUiTheme() !== "dark") throw new Error("load/save dark failed");
applyUiTheme("dark");
if (el.dataset.theme !== "dark") throw new Error("apply dark failed");

console.log("smoke-theme: ok");
