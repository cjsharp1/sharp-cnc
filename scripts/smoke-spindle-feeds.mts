/**
 * Smoke: material presets, spindle/feed override helpers, SVG M3/S/M5.
 * Run: npx --yes tsx scripts/smoke-spindle-feeds.mts
 */
import {
  DEFAULT_FEEDS_SELECTION,
  MATERIAL_PRESETS,
  REF_BIT_DIAMETER_MM,
  getMaterialPreset,
  selectionFromSuggestion,
  suggestFeedsSpeeds,
} from "../src/grbl/materialPresets.ts";
import {
  FEED_OVERRIDE_RESET,
  SPINDLE_OVERRIDE_COARSE_PLUS,
  applyOverrideStep,
  buildSpindleOffCommand,
  buildSpindleOnCommand,
  feedOverrideByte,
  spindleOverrideByte,
} from "../src/grbl/spindleFeed.ts";
import {
  DEFAULT_SVG_TOOLPATH,
  generateSvgGcode,
} from "../src/grbl/svgToolpath.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(MATERIAL_PRESETS.length >= 4, "four materials");
assert(getMaterialPreset("acrylic").label === "Acrylic", "acrylic preset");
assert(DEFAULT_FEEDS_SELECTION.material === "softwood", "default material");

const softEngrave = suggestFeedsSpeeds({
  material: "softwood",
  cutStyle: "engrave",
  diameterMm: REF_BIT_DIAMETER_MM,
  bitType: "endmill",
});
assert(softEngrave.feedMmMin === 800, `soft engrave feed ${softEngrave.feedMmMin}`);
assert(softEngrave.spindleRpm === 14_000, `soft rpm ${softEngrave.spindleRpm}`);
assert(softEngrave.svgMode === "engrave", "engrave mode");

const hardCutLarge = suggestFeedsSpeeds({
  material: "hardwood",
  cutStyle: "cut",
  diameterMm: 6.35,
  bitType: "endmill",
});
assert(hardCutLarge.feedMmMin > 650, "larger bit → higher feed");
assert(hardCutLarge.spindleRpm < 16_000, "larger bit → lower rpm");
assert(hardCutLarge.svgMode === "outline", "cut → outline");

const vbit = suggestFeedsSpeeds({
  material: "acrylic",
  cutStyle: "engrave",
  diameterMm: 3.175,
  bitType: "vbit",
});
assert(vbit.feedMmMin < softEngrave.feedMmMin, "vbit slower than endmill softwood baseline path");

const sel = selectionFromSuggestion(softEngrave);
assert(sel.feedMmMin === softEngrave.feedMmMin, "selection feed");

assert(buildSpindleOnCommand(12345.6) === "M3 S12346", "M3 round");
assert(buildSpindleOffCommand() === "M5", "M5");
assert(feedOverrideByte("reset") === FEED_OVERRIDE_RESET, "feed reset byte");
assert(
  spindleOverrideByte("coarse+") === SPINDLE_OVERRIDE_COARSE_PLUS,
  "spindle +10 byte",
);
assert(applyOverrideStep(100, "coarse+") === 110, "+10");
assert(applyOverrideStep(100, "fine-") === 99, "-1");
assert(applyOverrideStep(15, "coarse-") === 10, "clamp min");
assert(applyOverrideStep(195, "coarse+") === 200, "clamp max");
assert(applyOverrideStep(150, "reset") === 100, "reset");

const gcode = generateSvgGcode(
  [
    {
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      closed: false,
    },
  ],
  {
    ...DEFAULT_SVG_TOOLPATH,
    feedMmMin: softEngrave.feedMmMin,
    plungeMmMin: softEngrave.plungeMmMin,
    spindleRpm: softEngrave.spindleRpm,
    depthMm: softEngrave.depthMm,
  },
);
assert(gcode.includes("M3 S14000"), `spindle on: ${gcode.slice(0, 200)}`);
assert(gcode.includes("M5"), "spindle off before M2");
assert(gcode.includes(`F${softEngrave.feedMmMin}`), "feed in path");
assert(/; Spindle S14000/.test(gcode), "spindle comment");

const dry = generateSvgGcode(
  [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }], closed: false }],
  { ...DEFAULT_SVG_TOOLPATH, spindleRpm: 0 },
);
assert(!dry.includes("M3"), "omit spindle when rpm 0");
assert(!dry.includes("M5\n"), "no M5 when omitted");

console.log("smoke-spindle-feeds: ok");
