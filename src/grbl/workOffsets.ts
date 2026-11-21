import type { Position3 } from "./types";
import { ZERO_POSITION } from "./types";

/** G54–G59 → GRBL G10 P values 1–6. */
export type WcsId = "G54" | "G55" | "G56" | "G57" | "G58" | "G59";

export const WCS_OPTIONS: { id: WcsId; p: number; label: string }[] = [
  { id: "G54", p: 1, label: "G54" },
  { id: "G55", p: 2, label: "G55" },
  { id: "G56", p: 3, label: "G56" },
  { id: "G57", p: 4, label: "G57" },
  { id: "G58", p: 5, label: "G58" },
  { id: "G59", p: 6, label: "G59" },
];

export const WORK_OFFSETS_KEY = "sharpcnc.workOffsets.v1";

export interface SavedWorkOffset {
  id: WcsId;
  /** Absolute WCO (machine − work) when saved, mm. */
  wco: Position3;
  /** Optional short label. */
  name: string;
  updatedAt: number;
}

export interface WorkOffsetsStore {
  active: WcsId;
  slots: Partial<Record<WcsId, SavedWorkOffset>>;
}

export const DEFAULT_WORK_OFFSETS: WorkOffsetsStore = {
  active: "G54",
  slots: {},
};

export function wcsP(id: WcsId): number {
  const found = WCS_OPTIONS.find((o) => o.id === id);
  return found?.p ?? 1;
}

export function parseWcsId(raw: string): WcsId | null {
  const upper = raw.trim().toUpperCase();
  return WCS_OPTIONS.some((o) => o.id === upper) ? (upper as WcsId) : null;
}

export function loadWorkOffsets(): WorkOffsetsStore {
  try {
    const raw = localStorage.getItem(WORK_OFFSETS_KEY);
    if (!raw) return { ...DEFAULT_WORK_OFFSETS, slots: {} };
    const parsed = JSON.parse(raw) as Partial<WorkOffsetsStore>;
    const active = parseWcsId(String(parsed.active ?? "G54")) ?? "G54";
    const slots: WorkOffsetsStore["slots"] = {};
    if (parsed.slots && typeof parsed.slots === "object") {
      for (const opt of WCS_OPTIONS) {
        const slot = (parsed.slots as Record<string, SavedWorkOffset>)[opt.id];
        if (!slot || typeof slot !== "object") continue;
        const wco = slot.wco;
        if (
          !wco ||
          typeof wco.x !== "number" ||
          typeof wco.y !== "number" ||
          typeof wco.z !== "number"
        ) {
          continue;
        }
        slots[opt.id] = {
          id: opt.id,
          wco: { x: wco.x, y: wco.y, z: wco.z },
          name: typeof slot.name === "string" ? slot.name : opt.id,
          updatedAt:
            typeof slot.updatedAt === "number" ? slot.updatedAt : Date.now(),
        };
      }
    }
    return { active, slots };
  } catch {
    return { ...DEFAULT_WORK_OFFSETS, slots: {} };
  }
}

export function saveWorkOffsets(store: WorkOffsetsStore): void {
  try {
    localStorage.setItem(WORK_OFFSETS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

/** Activate WCS modal (G54…G59). */
export function buildSelectWcsCommand(id: WcsId): string {
  return id;
}

/**
 * Set absolute work coordinate offset for a WCS slot (GRBL G10 L2).
 * WCO = machine − work; after this, work = machine − wco.
 */
export function buildSetAbsoluteWcoCommand(
  id: WcsId,
  wco: Position3,
): string {
  return `G10 L2 P${wcsP(id)} X${fmt(wco.x)} Y${fmt(wco.y)} Z${fmt(wco.z)}`;
}

/** Snapshot current WCO into a saved slot (app store — not EEPROM until recall). */
export function snapshotOffset(
  id: WcsId,
  wco: Position3,
  name?: string,
): SavedWorkOffset {
  return {
    id,
    wco: { ...wco },
    name: name?.trim() || id,
    updatedAt: Date.now(),
  };
}

/** Commands to recall a saved offset into GRBL and select that WCS. */
export function buildRecallOffsetCommands(slot: SavedWorkOffset): string[] {
  return [
    buildSetAbsoluteWcoCommand(slot.id, slot.wco),
    buildSelectWcsCommand(slot.id),
  ];
}

export function currentWcoFromStatus(
  machine: Position3,
  work: Position3,
  wco?: Position3,
): Position3 {
  if (wco) return { ...wco };
  return {
    x: machine.x - work.x,
    y: machine.y - work.y,
    z: machine.z - work.z,
  };
}

export { ZERO_POSITION };

function fmt(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}
