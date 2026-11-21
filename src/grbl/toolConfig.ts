/**
 * Tool / bit profile for visualizer, SVG→G-code defaults, and future checks.
 */

export type ToolBitType =
  | "endmill"
  | "ballnose"
  | "vbit"
  | "engraving"
  | "other";

export interface ToolConfig {
  type: ToolBitType;
  /** Cutting diameter (mm). */
  diameterMm: number;
  /**
   * V-bit included tip angle (degrees). Only meaningful for `vbit`;
   * ignored by follow-path SVG generation today.
   */
  tipAngleDeg: number;
}

export const DEFAULT_TOOL: ToolConfig = {
  type: "endmill",
  /** 1/8" default endmill — matches DEFAULT_SVG_TOOLPATH. */
  diameterMm: 3.175,
  tipAngleDeg: 60,
};

export const TOOL_BIT_LABELS: Record<ToolBitType, string> = {
  endmill: "Endmill",
  ballnose: "Ballnose",
  vbit: "V-bit",
  engraving: "Engraving",
  other: "Other",
};

const TOOL_STORAGE_KEY = "sharpcnc.tool.v1";

const TOOL_TYPES = new Set<string>([
  "endmill",
  "ballnose",
  "vbit",
  "engraving",
  "other",
]);

function isPositiveFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Load persisted tool / bit profile. */
export function loadTool(): ToolConfig {
  try {
    const raw = localStorage.getItem(TOOL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TOOL };
    const parsed = JSON.parse(raw) as Partial<ToolConfig>;
    if (
      typeof parsed.type !== "string" ||
      !TOOL_TYPES.has(parsed.type) ||
      !isPositiveFinite(parsed.diameterMm)
    ) {
      return { ...DEFAULT_TOOL };
    }
    const tip =
      typeof parsed.tipAngleDeg === "number" &&
      Number.isFinite(parsed.tipAngleDeg) &&
      parsed.tipAngleDeg > 0
        ? parsed.tipAngleDeg
        : DEFAULT_TOOL.tipAngleDeg;
    return {
      type: parsed.type as ToolBitType,
      diameterMm: parsed.diameterMm,
      tipAngleDeg: tip,
    };
  } catch {
    return { ...DEFAULT_TOOL };
  }
}

/** Persist tool / bit profile. */
export function saveTool(tool: ToolConfig): void {
  try {
    localStorage.setItem(
      TOOL_STORAGE_KEY,
      JSON.stringify({
        type: tool.type,
        diameterMm: tool.diameterMm,
        tipAngleDeg: tool.tipAngleDeg,
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}
