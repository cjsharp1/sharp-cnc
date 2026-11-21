/**
 * Material-based suggested feed / spindle for hobby CNC (PWM spindle).
 * Conservative starting points — always verify on scrap.
 */

import type { SvgCutMode } from "./svgToolpath";
import type { ToolBitType } from "./toolConfig";

export type MaterialKind = "softwood" | "hardwood" | "acrylic" | "mdf";

export type CutStyle = "engrave" | "cut";

export interface MaterialPreset {
  id: MaterialKind;
  label: string;
  /** Brief operator note. */
  hint: string;
  /**
   * Baseline XY feed (mm/min) at {@link REF_BIT_DIAMETER_MM} for a light engrave.
   */
  engraveFeedMmMin: number;
  /** Baseline XY feed (mm/min) at ref diameter for a through/outline cut. */
  cutFeedMmMin: number;
  /** Plunge feed (mm/min) at ref diameter. */
  plungeMmMin: number;
  /** Spindle RPM at ref diameter. */
  spindleRpm: number;
  /** Suggested engrave depth (mm) — informational for SVG defaults. */
  engraveDepthMm: number;
  /** Suggested cut depth per pass awareness (mm) — not multi-pass CAM. */
  cutDepthMm: number;
}

/** Reference bit diameter for preset tables (1/8"). */
export const REF_BIT_DIAMETER_MM = 3.175;

export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  {
    id: "softwood",
    label: "Softwood",
    hint: "Pine, cedar — higher feed, moderate RPM",
    engraveFeedMmMin: 800,
    cutFeedMmMin: 1000,
    plungeMmMin: 250,
    spindleRpm: 14_000,
    engraveDepthMm: 0.4,
    cutDepthMm: 1.5,
  },
  {
    id: "hardwood",
    label: "Hardwood",
    hint: "Oak, maple — slower feed, higher RPM",
    engraveFeedMmMin: 500,
    cutFeedMmMin: 650,
    plungeMmMin: 180,
    spindleRpm: 16_000,
    engraveDepthMm: 0.3,
    cutDepthMm: 1.0,
  },
  {
    id: "acrylic",
    label: "Acrylic",
    hint: "Watch melt — moderate feed, higher RPM, sharp bit",
    engraveFeedMmMin: 400,
    cutFeedMmMin: 520,
    plungeMmMin: 150,
    spindleRpm: 18_000,
    engraveDepthMm: 0.3,
    cutDepthMm: 1.0,
  },
  {
    id: "mdf",
    label: "MDF",
    hint: "Dusty — solid feed, moderate RPM",
    engraveFeedMmMin: 700,
    cutFeedMmMin: 900,
    plungeMmMin: 220,
    spindleRpm: 15_000,
    engraveDepthMm: 0.5,
    cutDepthMm: 1.5,
  },
] as const;

export const MATERIAL_LABELS: Record<MaterialKind, string> = {
  softwood: "Softwood",
  hardwood: "Hardwood",
  acrylic: "Acrylic",
  mdf: "MDF",
};

export const CUT_STYLE_LABELS: Record<CutStyle, string> = {
  engrave: "Engrave",
  cut: "Cut / outline",
};

export interface FeedsSpeedsSuggestion {
  material: MaterialKind;
  cutStyle: CutStyle;
  bitType: ToolBitType;
  diameterMm: number;
  feedMmMin: number;
  plungeMmMin: number;
  spindleRpm: number;
  depthMm: number;
  /** Maps to SVG mode. */
  svgMode: SvgCutMode;
  note: string;
}

/** Last material / cut-style choice + applied F/S (persisted). */
export interface FeedsSpeedsSelection {
  material: MaterialKind;
  cutStyle: CutStyle;
  feedMmMin: number;
  plungeMmMin: number;
  spindleRpm: number;
  depthMm: number;
}

export const DEFAULT_FEEDS_SELECTION: FeedsSpeedsSelection = {
  material: "softwood",
  cutStyle: "engrave",
  feedMmMin: 800,
  plungeMmMin: 250,
  spindleRpm: 14_000,
  depthMm: 0.4,
};

const STORAGE_KEY = "sharpcnc.feedsSpeeds.v1";

const MATERIAL_IDS = new Set<string>(MATERIAL_PRESETS.map((p) => p.id));

function isPositiveFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export function getMaterialPreset(id: MaterialKind): MaterialPreset {
  return (
    MATERIAL_PRESETS.find((p) => p.id === id) ?? MATERIAL_PRESETS[0]
  );
}

/**
 * Scale baseline feeds with bit diameter; RPM slightly inverse to diameter.
 * V-bit / engraving tips: slightly slower feed.
 */
export function suggestFeedsSpeeds(input: {
  material: MaterialKind;
  cutStyle: CutStyle;
  diameterMm: number;
  bitType?: ToolBitType;
}): FeedsSpeedsSuggestion {
  const preset = getMaterialPreset(input.material);
  const d = Math.max(0.2, input.diameterMm);
  const scale = d / REF_BIT_DIAMETER_MM;
  const bitType = input.bitType ?? "endmill";

  let bitFactor = 1;
  if (bitType === "vbit" || bitType === "engraving") bitFactor = 0.75;
  else if (bitType === "ballnose") bitFactor = 0.9;

  const baseFeed =
    input.cutStyle === "cut" ? preset.cutFeedMmMin : preset.engraveFeedMmMin;
  const feedMmMin = Math.round(
    Math.min(3000, Math.max(50, baseFeed * scale * bitFactor)),
  );
  const plungeMmMin = Math.round(
    Math.min(800, Math.max(30, preset.plungeMmMin * Math.sqrt(scale) * bitFactor)),
  );
  const spindleRpm = Math.round(
    Math.min(
      24_000,
      Math.max(5_000, preset.spindleRpm * Math.sqrt(REF_BIT_DIAMETER_MM / d)),
    ),
  );
  const depthMm =
    input.cutStyle === "cut" ? preset.cutDepthMm : preset.engraveDepthMm;
  const svgMode: SvgCutMode =
    input.cutStyle === "cut" ? "outline" : "engrave";

  return {
    material: input.material,
    cutStyle: input.cutStyle,
    bitType,
    diameterMm: d,
    feedMmMin,
    plungeMmMin,
    spindleRpm,
    depthMm,
    svgMode,
    note: `${preset.label} · Ø ${d.toFixed(2)} mm · ${CUT_STYLE_LABELS[input.cutStyle]} — starting point; test on scrap`,
  };
}

export function selectionFromSuggestion(
  s: FeedsSpeedsSuggestion,
): FeedsSpeedsSelection {
  return {
    material: s.material,
    cutStyle: s.cutStyle,
    feedMmMin: s.feedMmMin,
    plungeMmMin: s.plungeMmMin,
    spindleRpm: s.spindleRpm,
    depthMm: s.depthMm,
  };
}

/** Load persisted feeds/speeds selection. */
export function loadFeedsSpeedsSelection(): FeedsSpeedsSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FEEDS_SELECTION };
    const parsed = JSON.parse(raw) as Partial<FeedsSpeedsSelection>;
    if (
      typeof parsed.material !== "string" ||
      !MATERIAL_IDS.has(parsed.material) ||
      (parsed.cutStyle !== "engrave" && parsed.cutStyle !== "cut") ||
      !isPositiveFinite(parsed.feedMmMin) ||
      !isPositiveFinite(parsed.plungeMmMin) ||
      !isPositiveFinite(parsed.spindleRpm) ||
      !isPositiveFinite(parsed.depthMm)
    ) {
      return { ...DEFAULT_FEEDS_SELECTION };
    }
    return {
      material: parsed.material as MaterialKind,
      cutStyle: parsed.cutStyle,
      feedMmMin: parsed.feedMmMin,
      plungeMmMin: parsed.plungeMmMin,
      spindleRpm: parsed.spindleRpm,
      depthMm: parsed.depthMm,
    };
  } catch {
    return { ...DEFAULT_FEEDS_SELECTION };
  }
}

/** Persist feeds/speeds selection. */
export function saveFeedsSpeedsSelection(sel: FeedsSpeedsSelection): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        material: sel.material,
        cutStyle: sel.cutStyle,
        feedMmMin: sel.feedMmMin,
        plungeMmMin: sel.plungeMmMin,
        spindleRpm: sel.spindleRpm,
        depthMm: sel.depthMm,
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}
