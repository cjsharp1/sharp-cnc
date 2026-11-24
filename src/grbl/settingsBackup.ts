/**
 * Settings backup / restore / Calibrate undo helpers (calibration spec PR 1).
 *
 * Snapshots live in localStorage (`sharpcnc.settingsBackup.v1`), last 5.
 * Undo stack is session-only (in-memory) — every successful Calibrate write.
 */

import { formatSettingWrite, type GrblSetting } from "./settings";
import { isDesktopShell } from "./session";

/** localStorage key for persisted $$ snapshots. */
export const SETTINGS_BACKUP_STORAGE_KEY = "sharpcnc.settingsBackup.v1";

/** How many snapshots to keep (newest first). */
export const SETTINGS_BACKUP_MAX = 5;

export interface SettingsSnapshot {
  /** Wall-clock ms when the snapshot was taken. */
  timestamp: number;
  /** Full `$n` → value map at that moment. */
  settings: Record<string, number>;
}

export interface SettingsBackupStore {
  snapshots: SettingsSnapshot[];
}

export interface SettingsDiffEntry {
  id: number;
  /** Value in the snapshot (restore target). */
  from: number | null;
  /** Current value on the controller (or null if missing). */
  to: number | null;
}

/** One successful Calibrate write, for session undo. */
export interface CalibrateWriteEntry {
  id: number;
  before: number;
  after: number;
}

export const DEFAULT_SETTINGS_BACKUP: SettingsBackupStore = {
  snapshots: [],
};

/** Convert a live settings Map into a plain record for storage. */
export function settingsMapToRecord(
  map: Map<number, GrblSetting>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, setting] of map) {
    if (Number.isFinite(setting.value)) {
      out[String(id)] = setting.value;
    }
  }
  return out;
}

/** Rebuild a Map from a stored record. */
export function settingsRecordToMap(
  record: Record<string, number>,
): Map<number, GrblSetting> {
  const map = new Map<number, GrblSetting>();
  for (const [key, value] of Object.entries(record)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id < 0 || !Number.isFinite(value)) continue;
    map.set(id, { id, value });
  }
  return map;
}

/** Format a settings map/record as `$n=value` lines (sorted by id). */
export function formatSettingsDumpText(
  settings: Map<number, GrblSetting> | Record<string, number>,
): string {
  const entries: Array<{ id: number; value: number }> = [];
  if (settings instanceof Map) {
    for (const [id, setting] of settings) {
      if (Number.isFinite(setting.value)) {
        entries.push({ id, value: setting.value });
      }
    }
  } else {
    for (const [key, value] of Object.entries(settings)) {
      const id = Number(key);
      if (Number.isInteger(id) && id >= 0 && Number.isFinite(value)) {
        entries.push({ id, value });
      }
    }
  }
  entries.sort((a, b) => a.id - b.id);
  return entries.map((e) => formatSettingWrite(e.id, e.value)).join("\n") + "\n";
}

/**
 * Diff only settings that differ between `snapshot` and `current`.
 * `from` = snapshot value (what restore would write); `to` = current value.
 * Ids present only on one side are included (null for the missing side).
 */
export function diffSettings(
  snapshot: Map<number, GrblSetting> | Record<string, number>,
  current: Map<number, GrblSetting> | Record<string, number>,
): SettingsDiffEntry[] {
  const snap =
    snapshot instanceof Map ? snapshot : settingsRecordToMap(snapshot);
  const cur = current instanceof Map ? current : settingsRecordToMap(current);
  const ids = new Set<number>([...snap.keys(), ...cur.keys()]);
  const out: SettingsDiffEntry[] = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const from = snap.get(id)?.value ?? null;
    const to = cur.get(id)?.value ?? null;
    if (from === to) continue;
    // Treat near-equal floats as equal (GRBL dump formatting).
    if (
      from !== null &&
      to !== null &&
      Number.isFinite(from) &&
      Number.isFinite(to) &&
      Math.abs(from - to) < 1e-9
    ) {
      continue;
    }
    out.push({ id, from, to });
  }
  return out;
}

/** Entries to write when restoring a snapshot onto the current controller. */
export function restoreWriteEntries(
  diff: SettingsDiffEntry[],
): Array<{ id: number; value: number }> {
  return diff
    .filter((d): d is SettingsDiffEntry & { from: number } => d.from !== null)
    .map((d) => ({ id: d.id, value: d.from }));
}

function normalizeStore(raw: unknown): SettingsBackupStore {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS_BACKUP };
  const snaps = (raw as SettingsBackupStore).snapshots;
  if (!Array.isArray(snaps)) return { ...DEFAULT_SETTINGS_BACKUP };
  const snapshots: SettingsSnapshot[] = [];
  for (const s of snaps) {
    if (!s || typeof s !== "object") continue;
    const timestamp = (s as SettingsSnapshot).timestamp;
    const settings = (s as SettingsSnapshot).settings;
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) continue;
    if (!settings || typeof settings !== "object") continue;
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
    }
    snapshots.push({ timestamp, settings: clean });
  }
  return { snapshots };
}

export function loadSettingsBackups(): SettingsBackupStore {
  try {
    const raw = localStorage.getItem(SETTINGS_BACKUP_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS_BACKUP, snapshots: [] };
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS_BACKUP, snapshots: [] };
  }
}

function persistStore(store: SettingsBackupStore): void {
  try {
    localStorage.setItem(SETTINGS_BACKUP_STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* private mode / quota — ignore */
  }
}

/**
 * Prepend a snapshot of the current settings map. Keeps the last
 * {@link SETTINGS_BACKUP_MAX}. Returns the new store.
 */
export function pushSettingsBackup(
  map: Map<number, GrblSetting>,
  timestamp = Date.now(),
): SettingsBackupStore {
  const snapshot: SettingsSnapshot = {
    timestamp,
    settings: settingsMapToRecord(map),
  };
  const prev = loadSettingsBackups();
  const snapshots = [snapshot, ...prev.snapshots].slice(0, SETTINGS_BACKUP_MAX);
  const next = { snapshots };
  persistStore(next);
  return next;
}

/** Push a Calibrate write onto a session undo stack (newest at end). */
export function pushCalibrateUndo(
  stack: readonly CalibrateWriteEntry[],
  entry: CalibrateWriteEntry,
): CalibrateWriteEntry[] {
  return [...stack, entry];
}

/** Pop the last Calibrate write, or null if empty. */
export function popCalibrateUndo(
  stack: readonly CalibrateWriteEntry[],
): {
  entry: CalibrateWriteEntry | null;
  next: CalibrateWriteEntry[];
} {
  if (stack.length === 0) return { entry: null, next: [] };
  const next = stack.slice(0, -1);
  return { entry: stack[stack.length - 1]!, next };
}

/** Label for the Undo button: `Undo $112 (375 → 500)`. */
export function formatCalibrateUndoLabel(entry: CalibrateWriteEntry): string {
  const fmt = (n: number) =>
    Number.isInteger(n) ? String(n) : String(Number(n.toFixed(3)));
  return `Undo $${entry.id} (${fmt(entry.after)} → ${fmt(entry.before)})`;
}

function stampFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function downloadBlob(filename: string, contents: string): void {
  const blob = new Blob([contents || "(empty)\n"], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Save a `$n=value` dump. Desktop: native save dialog. Browser / mock: download.
 * Returns the path written (desktop) or the download filename (browser), or null if cancelled.
 */
export async function saveSettingsBackupFile(
  settings: Map<number, GrblSetting> | Record<string, number>,
  suggestedName?: string,
): Promise<string | null> {
  const filename =
    suggestedName ?? `sharpcnc-settings-${stampFilename()}.txt`;
  const contents = formatSettingsDumpText(settings);

  if (isDesktopShell()) {
    try {
      // Lazy import so Node smokes that pull this module need no Tauri.
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await invoke<string | null>("save_text_file", {
        defaultName: filename,
        contents,
        title: "Back up GRBL settings",
      });
      return path;
    } catch {
      // Fall through to browser download if invoke fails (e.g. tests).
    }
  }

  downloadBlob(filename, contents);
  return filename;
}

/** Human-readable local time for a snapshot timestamp. */
export function formatSnapshotLabel(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return new Date(timestamp).toISOString();
  }
}
