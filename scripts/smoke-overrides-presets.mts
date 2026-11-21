/**
 * Smoke: override percent persistence + custom material presets.
 * Run: npx --yes tsx scripts/smoke-overrides-presets.mts
 */
import {
  DEFAULT_OVERRIDE_PERCENTS,
  loadOverridePercents,
  saveOverridePercents,
} from "../src/grbl/overrideConfig.ts";
import {
  deleteCustomFeedsPreset,
  loadCustomFeedsPresets,
  upsertCustomFeedsPreset,
} from "../src/grbl/customPresets.ts";
import {
  DEFAULT_FEEDS_SELECTION,
  loadFeedsSpeedsSelection,
  saveFeedsSpeedsSelection,
} from "../src/grbl/materialPresets.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size;
  },
} as Storage;

assert(
  loadOverridePercents().feed === DEFAULT_OVERRIDE_PERCENTS.feed,
  "default feed",
);
saveOverridePercents({ feed: 110, rapid: 50, spindle: 90 });
const loaded = loadOverridePercents();
assert(loaded.feed === 110, `feed ${loaded.feed}`);
assert(loaded.rapid === 50, `rapid ${loaded.rapid}`);
assert(loaded.spindle === 90, `spindle ${loaded.spindle}`);

saveOverridePercents({ feed: 5, rapid: 40, spindle: 999 });
const clamped = loadOverridePercents();
assert(clamped.feed === 10, "feed clamp min");
assert(clamped.rapid === 50, "rapid snap");
assert(clamped.spindle === 200, "spindle clamp max");

saveFeedsSpeedsSelection({
  ...DEFAULT_FEEDS_SELECTION,
  material: "hardwood",
  feedMmMin: 520,
});
const feeds = loadFeedsSpeedsSelection();
assert(feeds.material === "hardwood", "feeds material");
assert(feeds.feedMmMin === 520, "feeds feed");

let presets = upsertCustomFeedsPreset("Oak engrave", feeds);
assert(presets.length === 1, "one preset");
assert(presets[0].name === "Oak engrave", "preset name");
assert(presets[0].selection.feedMmMin === 520, "preset feed");

presets = upsertCustomFeedsPreset("Oak engrave", {
  ...feeds,
  feedMmMin: 480,
});
assert(presets.length === 1, "upsert by name");
assert(presets[0].selection.feedMmMin === 480, "updated feed");

presets = deleteCustomFeedsPreset(presets[0].id);
assert(presets.length === 0, "deleted");
assert(loadCustomFeedsPresets().length === 0, "empty store");

console.log("smoke-overrides-presets: ok");
