import { useMemo, useState } from "react";
import {
  diffSettings,
  formatSnapshotLabel,
  type GrblSetting,
  type SettingsDiffEntry,
  type SettingsSnapshot,
} from "../grbl";

interface SettingsRestorePanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  busy?: boolean;
  message?: string | null;
  /** Current live $$ map (needed for the changed-only diff). */
  settings: Map<number, GrblSetting> | null;
  snapshots: SettingsSnapshot[];
  onRefreshSettings: () => void;
  onRestore: (snapshot: SettingsSnapshot) => void;
}

/**
 * Menu → Advanced… restore of a saved `$$` snapshot (calibration PR 1).
 * Shows only settings that differ from the live controller, then writes them.
 */
export function SettingsRestorePanel({
  enabled,
  blockedReason = null,
  busy = false,
  message = null,
  settings,
  snapshots,
  onRefreshSettings,
  onRestore,
}: SettingsRestorePanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const canAct = enabled && !busy;

  const selected: SettingsSnapshot | null =
    snapshots.length > 0
      ? snapshots[Math.min(selectedIndex, snapshots.length - 1)]!
      : null;

  const diff: SettingsDiffEntry[] = useMemo(() => {
    if (!selected || !settings) return [];
    return diffSettings(selected.settings, settings);
  }, [selected, settings]);

  return (
    <section className="settings-restore" aria-label="Restore settings backup">
      <header className="settings-restore__head">
        <h2 className="settings-restore__title">Restore settings</h2>
        <span className="settings-restore__meta">$$ backups</span>
      </header>

      <p className="settings-restore__hint">
        Snapshots are taken automatically the first time Calibrate loads
        settings each session (last 5 kept). Pick one, review only the
        settings that changed, then write them back one at a time.
      </p>

      {!enabled && blockedReason ? (
        <p className="settings-restore__warn" role="status">
          {blockedReason}
        </p>
      ) : null}

      {snapshots.length === 0 ? (
        <p className="settings-restore__empty" role="status">
          No backups yet. Open Calibrate (connected) so settings load once, or
          use <strong>Back up settings</strong> in the Calibrate meta bar.
        </p>
      ) : (
        <>
          <label className="settings-restore__field">
            <span className="settings-restore__field-label">Snapshot</span>
            <select
              className="settings-restore__select"
              value={Math.min(selectedIndex, snapshots.length - 1)}
              disabled={!canAct}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
            >
              {snapshots.map((s, i) => (
                <option key={`${s.timestamp}-${i}`} value={i}>
                  {formatSnapshotLabel(s.timestamp)} ·{" "}
                  {Object.keys(s.settings).length} settings
                </option>
              ))}
            </select>
          </label>

          <div className="settings-restore__toolbar">
            <button
              type="button"
              className="settings-restore__btn settings-restore__btn--ghost"
              disabled={!canAct}
              onClick={onRefreshSettings}
              title="Re-read $$ so the diff matches the controller"
            >
              Read $$
            </button>
            <span className="settings-restore__count">
              {settings
                ? `${settings.size} live · ${diff.length} changed`
                : "Load settings to see the diff"}
            </span>
          </div>

          {settings && selected ? (
            diff.length === 0 ? (
              <p className="settings-restore__empty" role="status">
                Live settings already match this snapshot — nothing to restore.
              </p>
            ) : (
              <div className="settings-restore__table-wrap">
                <table className="settings-restore__table">
                  <thead>
                    <tr>
                      <th scope="col">Setting</th>
                      <th scope="col">Live (now)</th>
                      <th scope="col">Backup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <code>${d.id}</code>
                        </td>
                        <td>
                          {d.to === null ? "—" : d.to}
                        </td>
                        <td>
                          <strong>{d.from === null ? "—" : d.from}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          <div className="settings-restore__actions">
            <button
              type="button"
              className="settings-restore__btn"
              disabled={
                !canAct || !selected || !settings || diff.length === 0
              }
              onClick={() => {
                if (selected) onRestore(selected);
              }}
              title="Write only the changed settings, then re-read $$"
            >
              Restore {diff.length > 0 ? `${diff.length} setting${diff.length === 1 ? "" : "s"}` : "changed settings"}
            </button>
          </div>
        </>
      )}

      {message ? (
        <p className="settings-restore__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
