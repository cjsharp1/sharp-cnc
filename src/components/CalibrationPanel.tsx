import { useMemo, useState } from "react";
import {
  CALIBRATION_DISTANCE_OPTIONS_MM,
  DEFAULT_CALIBRATION_DISTANCE_MM,
  DEFAULT_JOG_FEED_MM_MIN,
  MAX_TRAVEL_SETTING_FOR_AXIS,
  SETTING_LABELS,
  SETTING_SOFT_LIMITS,
  STEPS_SETTING_FOR_AXIS,
  buildJogCommand,
  computeStepsPerMm,
  roundStepsPerMm,
  softLimitsEnabled,
  type Axis,
  type GrblSetting,
  type SoftTravelLimits,
} from "../grbl";

export type CalibrationTab = "steps" | "travel" | "manual";

interface CalibrationPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  settings: Map<number, GrblSetting> | null;
  softTravel: SoftTravelLimits;
  machinePos: { x: number; y: number; z: number };
  busy?: boolean;
  message?: string | null;
  onRefreshSettings: () => void;
  onCalibrateMove: (axis: Axis, distanceMm: number) => void;
  onWriteSteps: (
    axis: Axis,
    before: number,
    after: number,
  ) => void;
  onApplySoftTravel: (limits: SoftTravelLimits, enableSoft: boolean) => void;
  onWriteManual: (id: number, value: number) => void;
}

function settingValue(
  settings: Map<number, GrblSetting> | null,
  id: number,
): number | null {
  const v = settings?.get(id)?.value;
  return v !== undefined && Number.isFinite(v) ? v : null;
}

export function CalibrationPanel({
  enabled,
  blockedReason,
  settings,
  softTravel,
  machinePos,
  busy = false,
  message,
  onRefreshSettings,
  onCalibrateMove,
  onWriteSteps,
  onApplySoftTravel,
  onWriteManual,
}: CalibrationPanelProps) {
  const [tab, setTab] = useState<CalibrationTab>("steps");

  // Steps/mm wizard
  const [axis, setAxis] = useState<Axis>("X");
  const [commandedMm, setCommandedMm] = useState(
    DEFAULT_CALIBRATION_DISTANCE_MM,
  );
  const [measuredMm, setMeasuredMm] = useState("");
  const [moved, setMoved] = useState(false);

  // Soft travel form
  const [maxX, setMaxX] = useState(String(softTravel.maxX ?? ""));
  const [maxY, setMaxY] = useState(String(softTravel.maxY ?? ""));
  const [maxZ, setMaxZ] = useState(
    softTravel.maxZ !== null ? String(softTravel.maxZ) : "",
  );
  const [enableSoft, setEnableSoft] = useState(true);

  // Manual editor
  const [editId, setEditId] = useState("100");
  const [editValue, setEditValue] = useState("");

  const stepsId = STEPS_SETTING_FOR_AXIS[axis];
  const currentSteps = settingValue(settings, stepsId);

  const computed = useMemo(() => {
    const measured = Number(measuredMm);
    if (
      currentSteps === null ||
      !Number.isFinite(measured) ||
      measured === 0 ||
      commandedMm === 0
    ) {
      return null;
    }
    try {
      const next = roundStepsPerMm(
        computeStepsPerMm(currentSteps, commandedMm, measured),
      );
      return { before: currentSteps, after: next };
    } catch {
      return null;
    }
  }, [currentSteps, commandedMm, measuredMm]);

  const softOn = settings ? softLimitsEnabled(settings) : false;

  const syncTravelFromProps = () => {
    setMaxX(softTravel.maxX !== null ? String(softTravel.maxX) : "");
    setMaxY(softTravel.maxY !== null ? String(softTravel.maxY) : "");
    setMaxZ(softTravel.maxZ !== null ? String(softTravel.maxZ) : "");
  };

  const parseTravel = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const sortedSettings = useMemo(() => {
    if (!settings) return [];
    return [...settings.values()].sort((a, b) => a.id - b.id);
  }, [settings]);

  const canAct = enabled && !busy;

  return (
    <section className="cal" aria-label="Calibration and soft travel">
      <header className="cal__head">
        <h2 className="cal__title">Calibration</h2>
        <div className="cal__tabs" role="tablist">
          {(
            [
              ["steps", "Steps/mm"],
              ["travel", "Soft travel"],
              ["manual", "Manual"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`cal__tab${tab === id ? " is-active" : ""}`}
              onClick={() => {
                setTab(id);
                if (id === "travel") syncTravelFromProps();
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {!enabled && blockedReason ? (
        <p className="cal__warn" role="status">
          {blockedReason}
        </p>
      ) : null}

      <div className="cal__toolbar">
        <button
          type="button"
          className="cal__btn cal__btn--ghost"
          disabled={!canAct}
          onClick={onRefreshSettings}
          title="Read $$ from GRBL"
        >
          Read $$
        </button>
        <span className="cal__meta">
          {settings
            ? `${settings.size} settings · soft limits ${softOn ? "ON" : "off"}`
            : "Settings not loaded"}
        </span>
      </div>

      {tab === "steps" && (
        <div className="cal__body" role="tabpanel">
          <p className="cal__hint">
            Command a known move, measure the real distance, then write the new
            steps/mm ($100–$102).
          </p>

          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Axis</span>
              <select
                className="cal__select"
                value={axis}
                disabled={!canAct}
                onChange={(e) => {
                  setAxis(e.target.value as Axis);
                  setMoved(false);
                  setMeasuredMm("");
                }}
              >
                <option value="X">X ($100)</option>
                <option value="Y">Y ($101)</option>
                <option value="Z">Z ($102)</option>
              </select>
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Command mm</span>
              <select
                className="cal__select"
                value={commandedMm}
                disabled={!canAct}
                onChange={(e) => {
                  setCommandedMm(Number(e.target.value));
                  setMoved(false);
                }}
              >
                {CALIBRATION_DISTANCE_OPTIONS_MM.map((d) => (
                  <option key={d} value={d}>
                    {d} mm
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="cal__current">
            Current ${stepsId} ={" "}
            <strong>
              {currentSteps !== null ? currentSteps.toFixed(3) : "—"}
            </strong>{" "}
            steps/mm
          </p>

          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!canAct || currentSteps === null}
              onClick={() => {
                onCalibrateMove(axis, commandedMm);
                setMoved(true);
              }}
              title={buildJogCommand(
                axis === "X"
                  ? { x: commandedMm }
                  : axis === "Y"
                    ? { y: commandedMm }
                    : { z: commandedMm },
                DEFAULT_JOG_FEED_MM_MIN,
              )}
            >
              Move +{commandedMm} {axis}
            </button>
          </div>

          <label className="cal__field">
            <span className="cal__field-label">Measured mm (ruler)</span>
            <input
              className="cal__input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              placeholder={moved ? "e.g. 98.5" : "Move first, then measure"}
              value={measuredMm}
              disabled={!canAct}
              onChange={(e) => setMeasuredMm(e.target.value)}
            />
          </label>

          {computed && (
            <div className="cal__result" aria-live="polite">
              <p className="cal__result-line">
                Before: <strong>{computed.before.toFixed(3)}</strong>
              </p>
              <p className="cal__result-line">
                After: <strong>{computed.after.toFixed(3)}</strong> steps/mm
              </p>
              <button
                type="button"
                className="cal__btn"
                disabled={!canAct}
                onClick={() =>
                  onWriteSteps(axis, computed.before, computed.after)
                }
              >
                Write ${stepsId}={computed.after.toFixed(3)}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "travel" && (
        <div className="cal__body" role="tabpanel">
          <p className="cal__hint">
            Limit switches are on the zero side only. Set max travel, write
            $130–$132, and enable soft limits ($20). Bed size updates the
            visualizer.
          </p>

          <div className="cal__travel">
            {(
              [
                ["X", maxX, setMaxX, machinePos.x],
                ["Y", maxY, setMaxY, machinePos.y],
                ["Z", maxZ, setMaxZ, machinePos.z],
              ] as const
            ).map(([ax, value, setter, mpos]) => (
              <div key={ax} className="cal__travel-row">
                <label className="cal__field">
                  <span className="cal__field-label">
                    Max {ax} mm (${MAX_TRAVEL_SETTING_FOR_AXIS[ax]})
                  </span>
                  <input
                    className="cal__input"
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="1"
                    placeholder={ax === "Z" ? "optional" : "e.g. 1000"}
                    value={value}
                    disabled={!canAct}
                    onChange={(e) => setter(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!canAct}
                  title={`Use current machine ${ax} (${mpos.toFixed(2)} mm)`}
                  onClick={() => setter(mpos.toFixed(2))}
                >
                  Use MPos
                </button>
              </div>
            ))}
          </div>

          <label className="cal__check">
            <input
              type="checkbox"
              checked={enableSoft}
              disabled={!canAct}
              onChange={(e) => setEnableSoft(e.target.checked)}
            />
            <span>Enable soft limits ($20=1)</span>
          </label>

          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!canAct}
              onClick={() => {
                const next: SoftTravelLimits = {
                  maxX: parseTravel(maxX),
                  maxY: parseTravel(maxY),
                  maxZ: parseTravel(maxZ),
                  min: softTravel.min,
                };
                if (next.maxX === null && maxX.trim()) {
                  return;
                }
                if (next.maxY === null && maxY.trim()) {
                  return;
                }
                if (next.maxZ === null && maxZ.trim()) {
                  return;
                }
                onApplySoftTravel(next, enableSoft);
              }}
            >
              Write travel + $20
            </button>
          </div>
        </div>
      )}

      {tab === "manual" && (
        <div className="cal__body" role="tabpanel">
          <p className="cal__hint">
            View/edit any GRBL setting (`$$` / `$x=value`). Prefer the guided
            tabs for steps/mm and soft travel.
          </p>

          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Setting #</span>
              <input
                className="cal__input"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={editId}
                disabled={!canAct}
                onChange={(e) => setEditId(e.target.value)}
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Value</span>
              <input
                className="cal__input"
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

          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
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
              <span className="cal__meta">{SETTING_LABELS[Number(editId)]}</span>
            ) : null}
          </div>

          <div className="cal__table-wrap">
            <table className="cal__table">
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
        </div>
      )}

      {message ? (
        <p className="cal__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
