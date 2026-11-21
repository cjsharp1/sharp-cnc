/**
 * User-saved material / feeds presets (named slots on top of built-ins).
 */

import type { CutStyle, FeedsSpeedsSelection, MaterialKind } from "./materialPresets";
import { MATERIAL_PRESETS } from "./materialPresets";

export interface CustomFeedsPreset {
  id: string;
  name: string;
  selection: FeedsSpeedsSelection;
  updatedAt: number;
}

const STORAGE_KEY = "sharpcnc.customFeedsPresets.v1";
const MAX_PRESETS = 12;

const MATERIAL_IDS = new Set(MATERIAL_PRESETS.map((p) => p.id));

function isPositiveFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function isValidSelection(sel: unknown): sel is FeedsSpeedsSelection {
  if (!sel || typeof sel !== "object") return false;
  const s = sel as Partial<FeedsSpeedsSelection>;
  return (
    typeof s.material === "string" &&
    MATERIAL_IDS.has(s.material) &&
    (s.cutStyle === "engrave" || s.cutStyle === "cut") &&
    isPositiveFinite(s.feedMmMin) &&
    isPositiveFinite(s.plungeMmMin) &&
    isPositiveFinite(s.spindleRpm) &&
    isPositiveFinite(s.depthMm)
  );
}

function newId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Load named custom feeds presets. */
export function loadCustomFeedsPresets(): CustomFeedsPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: CustomFeedsPreset[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const p = item as Partial<CustomFeedsPreset>;
      if (
        typeof p.id !== "string" ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        !isValidSelection(p.selection) ||
        typeof p.updatedAt !== "number"
      ) {
        continue;
      }
      out.push({
        id: p.id,
        name: p.name.trim().slice(0, 48),
        selection: {
          material: p.selection.material as MaterialKind,
          cutStyle: p.selection.cutStyle as CutStyle,
          feedMmMin: p.selection.feedMmMin,
          plungeMmMin: p.selection.plungeMmMin,
          spindleRpm: p.selection.spindleRpm,
          depthMm: p.selection.depthMm,
        },
        updatedAt: p.updatedAt,
      });
      if (out.length >= MAX_PRESETS) break;
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persist(list: CustomFeedsPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_PRESETS)));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Save or replace a named preset from the current selection. */
export function upsertCustomFeedsPreset(
  name: string,
  selection: FeedsSpeedsSelection,
  existingId?: string,
): CustomFeedsPreset[] {
  const trimmed = name.trim().slice(0, 48);
  if (!trimmed || !isValidSelection(selection)) {
    return loadCustomFeedsPresets();
  }
  const list = loadCustomFeedsPresets();
  const now = Date.now();
  if (existingId) {
    const idx = list.findIndex((p) => p.id === existingId);
    if (idx >= 0) {
      list[idx] = {
        ...list[idx],
        name: trimmed,
        selection: { ...selection },
        updatedAt: now,
      };
      persist(list);
      return loadCustomFeedsPresets();
    }
  }
  const byName = list.findIndex(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byName >= 0) {
    list[byName] = {
      ...list[byName],
      name: trimmed,
      selection: { ...selection },
      updatedAt: now,
    };
  } else {
    list.unshift({
      id: newId(),
      name: trimmed,
      selection: { ...selection },
      updatedAt: now,
    });
  }
  persist(list);
  return loadCustomFeedsPresets();
}

/** Delete a custom preset by id. */
export function deleteCustomFeedsPreset(id: string): CustomFeedsPreset[] {
  const next = loadCustomFeedsPresets().filter((p) => p.id !== id);
  persist(next);
  return next;
}
