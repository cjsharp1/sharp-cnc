/**
 * Smoke: shell rail layout persist helpers + clamp bounds.
 */
import {
  DEFAULT_SHELL_RAIL_WIDTH_PX,
  MAX_SHELL_RAIL_WIDTH_PX,
  MIN_SHELL_MAIN_WIDTH_PX,
  MIN_SHELL_RAIL_WIDTH_PX,
  clampShellRailWidth,
  clampShellRailWidthForStage,
  loadShellRailWidth,
  saveShellRailWidth,
} from "../src/grbl/layoutConfig.ts";

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

if (DEFAULT_SHELL_RAIL_WIDTH_PX <= 392) {
  throw new Error(
    `default rail should be wider than post-#86 max (392px); got ${DEFAULT_SHELL_RAIL_WIDTH_PX}`,
  );
}

if (loadShellRailWidth() !== DEFAULT_SHELL_RAIL_WIDTH_PX) {
  throw new Error("default load should return DEFAULT_SHELL_RAIL_WIDTH_PX");
}

saveShellRailWidth(500);
if (loadShellRailWidth() !== 500) throw new Error("load/save 500 failed");

saveShellRailWidth(100);
if (loadShellRailWidth() !== MIN_SHELL_RAIL_WIDTH_PX) {
  throw new Error("save below min should clamp on load");
}

saveShellRailWidth(9999);
if (loadShellRailWidth() !== MAX_SHELL_RAIL_WIDTH_PX) {
  throw new Error("save above max should clamp on load");
}

if (clampShellRailWidth(200) !== MIN_SHELL_RAIL_WIDTH_PX) {
  throw new Error("clamp min failed");
}
if (clampShellRailWidth(900) !== MAX_SHELL_RAIL_WIDTH_PX) {
  throw new Error("clamp max failed");
}
if (clampShellRailWidth(448) !== 448) {
  throw new Error("clamp mid failed");
}

const stage = 1200;
const splitter = 10;
const wide = clampShellRailWidthForStage(560, stage, splitter);
const expectedMax = stage - MIN_SHELL_MAIN_WIDTH_PX - splitter;
if (wide !== Math.min(MAX_SHELL_RAIL_WIDTH_PX, expectedMax)) {
  throw new Error(`stage clamp failed: got ${wide}, expected ≤ ${expectedMax}`);
}

// Stage can still honor both mins (900 − 420 − 10 = 470).
const midStage = clampShellRailWidthForStage(500, 900, splitter);
if (midStage !== 470) {
  throw new Error(`mid stage clamp failed: got ${midStage}, expected 470`);
}

// Below both-mins budget: keep absolute rail floor (stacking kicks in ≤900).
const cramped = clampShellRailWidthForStage(500, 700, splitter);
if (cramped !== MIN_SHELL_RAIL_WIDTH_PX) {
  throw new Error(
    `cramped stage should floor at rail min; got ${cramped}`,
  );
}

console.log("smoke-layout: ok");
