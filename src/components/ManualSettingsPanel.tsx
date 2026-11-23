import { useMemo, useState } from "react";
import {
  MAX_TRAVEL_SETTING_FOR_AXIS,
  SETTING_DIR_PORT_INVERT,
  SETTING_LABELS,
  SETTING_SOFT_LIMITS,
  STEPS_SETTING_FOR_AXIS,
  type GrblSetting,
} from "../grbl";

interface ManualSettingsPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  settings: Map<number, GrblSetting> | null;
  busy?: boolean;
  message?: string | null;
  onRefreshSettings: () => void;
  onWriteManual: (id: number, value: number) => void;
}

export function ManualSettingsPanel({
  enabled,
  blockedReason = null,
  settings,
  busy = false,
  message = null,
  onRefreshSettings,
  onWriteManual,
}: ManualSettingsPanelProps) {
  const [editId, setEditId] = useState("100");
  const [editValue, setEditValue] = useState("");

  const sortedSettings = useMemo(() => {
    if (!settings) return [];
    return [...settings.values()].sort((a, b) => a.id - b.id);
  }, [settings]);

  const canAct = enabled && !busy;

  return (
    <section className="manual-settings" aria-label="Manual GRBL settings">
      <header className="manual-settings__head">
        <h2 className="manual-settings__title">Manual settings</h2>
        <span className="manual-settings__meta">$$ · $x=value</span>
      </header>

      <p className="manual-settings__hint">
        Free-form EEPROM editor. Prefer Calibration for direction (
        <code>$3</code>), steps/mm, and soft travel.
      </p>

      {!enabled && blockedReason ? (
        <p className="manual-settings__warn" role="status">
          {blockedReason}
        </p>
      ) : null}

      <div className="manual-settings__toolbar">
        <button
          type="button"
          className="manual-settings__btn manual-settings__btn--ghost"
          disabled={!canAct}
          onClick={onRefreshSettings}
          title="Read $$ from GRBL"
        >
          Read $$
        </button>
        <span className="manual-settings__count">
          {settings ? `${settings.size} settings loaded` : "Settings not loaded"}
        </span>
      </div>

      <div className="manual-settings__row">
        <label className="manual-settings__field">
          <span className="manual-settings__field-label">Setting #</span>
          <input
            className="manual-settings__input"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={editId}
            disabled={!canAct}
            onChange={(e) => setEditId(e.target.value)}
          />
        </label>
        <label className="manual-settings__field">
          <span className="manual-settings__field-label">Value</span>
          <input
            className="manual-settings__input"
            type="number"
            inputMode="decimal"
            step="any"
            value={editValue}
            disabled={!canAct}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="e.g. 250"
          />
        </label>
      </div>

      <div className="manual-settings__actions">
        <button
          type="button"
          className="manual-settings__btn"
          disabled={!canAct}
          onClick={() => {
            const id = Number(editId);
            const value = Number(editValue);
            if (!Number.isInteger(id) || id < 0 || !Number.isFinite(value)) {
              return;
            }
            onWriteManual(id, value);
          }}
        >
          Write $x=value
        </button>
        {SETTING_LABELS[Number(editId)] ? (
          <span className="manual-settings__label-hint">
            {SETTING_LABELS[Number(editId)]}
          </span>
        ) : null}
      </div>

      <div className="manual-settings__table-wrap">
        <table className="manual-settings__table">
          <thead>
            <tr>
              <th>$</th>
              <th>Value</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {sortedSettings.length === 0 ? (
              <tr>
                <td colSpan={3}>Read $$ to load settings</td>
              </tr>
            ) : (
              sortedSettings.map((s) => (
                <tr
                  key={s.id}
                  className={
                    s.id === SETTING_DIR_PORT_INVERT ||
                    s.id === SETTING_SOFT_LIMITS ||
                    s.id === STEPS_SETTING_FOR_AXIS.X ||
                    s.id === STEPS_SETTING_FOR_AXIS.Y ||
                    s.id === STEPS_SETTING_FOR_AXIS.Z ||
                    s.id === MAX_TRAVEL_SETTING_FOR_AXIS.X ||
                    s.id === MAX_TRAVEL_SETTING_FOR_AXIS.Y ||
                    s.id === MAX_TRAVEL_SETTING_FOR_AXIS.Z
                      ? "is-key"
                      : undefined
                  }
                  onClick={() => {
                    setEditId(String(s.id));
                    setEditValue(String(s.value));
                  }}
                >
                  <td>{s.id}</td>
                  <td>{s.value}</td>
                  <td>{SETTING_LABELS[s.id] ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {message ? (
        <p className="manual-settings__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
