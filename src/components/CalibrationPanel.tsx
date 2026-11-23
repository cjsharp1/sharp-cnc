import { useEffect, useMemo, useState } from "react";
import {
  CALIBRATION_DISTANCE_OPTIONS_MM,
  DEFAULT_CALIBRATION_DISTANCE_MM,
  DEFAULT_JOG_FEED_MM_MIN,
  DIR_TEST_JOG_MM,
  MAX_TRAVEL_SETTING_FOR_AXIS,
  SETTING_DIR_PORT_INVERT,
  STEPS_SETTING_FOR_AXIS,
  buildJogCommand,
  computeStepsPerMm,
  decodeDirInvertMask,
  describeDirInvertMask,
  encodeDirInvertMask,
  roundStepsPerMm,
  softLimitsEnabled,
  type Axis,
  type AxisDirInvert,
  type GrblSetting,
  type GrblStatus,
  type SoftTravelLimits,
  type ZeroAxisSelection,
} from "../grbl";
import { useWizardStepGate, WizardStepConfirm } from "./wizardStepGate";

export type CalibrationStepId =
  | "zero"
  | "direction"
  | "steps"
  | "travel";

const WIZARD_STEPS: {
  id: CalibrationStepId;
  label: string;
  short: string;
}[] = [
  { id: "zero", label: "Zero context", short: "1 · Zero" },
  { id: "direction", label: "Direction", short: "2 · Dir" },
  { id: "steps", label: "Steps/mm", short: "3 · Steps" },
  { id: "travel", label: "Soft travel", short: "4 · Travel" },
];

const STEP_CONFIRM_LABELS: Record<CalibrationStepId, string> = {
  zero: "Material zero looks right — I completed this step",
  direction: "Jog direction matches the machine — I completed this step",
  steps: "Measured and wrote steps/mm — I completed this step",
  travel: "Soft travel / bed extents set — I completed this step",
};

interface CalibrationPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  settings: Map<number, GrblSetting> | null;
  softTravel: SoftTravelLimits;
  status: GrblStatus;
  machinePos: { x: number; y: number; z: number };
  busy?: boolean;
  message?: string | null;
  zeroEnabled: boolean;
  zeroMessage?: string | null;
  onRefreshSettings: () => void;
  onCalibrateMove: (axis: Axis, distanceMm: number) => void;
  onWriteSteps: (axis: Axis, before: number, after: number) => void;
  onWriteDirInvert: (mask: number) => void;
  onApplySoftTravel: (limits: SoftTravelLimits, enableSoft: boolean) => void;
  onZero: (axes: ZeroAxisSelection) => void;
  onClose?: () => void;
  /** Soft travel confirmed — persist calibrated and advance (phase shell). */
  onComplete?: () => void;
  /** Open the post-calibration full bed travel test (clear entry). */
  onOpenBedTravelTest?: () => void;
}

function settingValue(
  settings: Map<number, GrblSetting> | null,
  id: number,
): number | null {
  const v = settings?.get(id)?.value;
  return v !== undefined && Number.isFinite(v) ? v : null;
}

function formatMm(value: number): string {
  return value.toFixed(3);
}

const ZERO_BUTTONS: { id: ZeroAxisSelection; label: string }[] = [
  { id: "X", label: "Zero X" },
  { id: "Y", label: "Zero Y" },
  { id: "Z", label: "Zero Z" },
  { id: "XYZ", label: "Zero XYZ" },
];

export function CalibrationPanel({
  enabled,
  blockedReason,
  settings,
  softTravel,
  status,
  machinePos,
  busy = false,
  message,
  zeroEnabled,
  zeroMessage,
  onRefreshSettings,
  onCalibrateMove,
  onWriteSteps,
  onWriteDirInvert,
  onApplySoftTravel,
  onZero,
  onClose,
  onComplete,
  onOpenBedTravelTest,
}: CalibrationPanelProps) {
  const {
    stepIndex,
    isConfirmed,
    canVisit,
    setStepConfirmed,
    goNext,
    goBack,
    goTo,
    isFirst,
    isLast,
  } = useWizardStepGate(WIZARD_STEPS.length);
  const step = WIZARD_STEPS[stepIndex]!;

  // Steps/mm wizard
  const [axis, setAxis] = useState<Axis>("X");
  const [commandedMm, setCommandedMm] = useState(
    DEFAULT_CALIBRATION_DISTANCE_MM,
  );
  const [measuredMm, setMeasuredMm] = useState("");
  const [moved, setMoved] = useState(false);

  // Axis direction ($3)
  const [dirFlags, setDirFlags] = useState<AxisDirInvert>({
    x: false,
    y: false,
    z: false,
  });

  // Soft travel form
  const [maxX, setMaxX] = useState(String(softTravel.maxX ?? ""));
  const [maxY, setMaxY] = useState(String(softTravel.maxY ?? ""));
  const [maxZ, setMaxZ] = useState(
    softTravel.maxZ !== null ? String(softTravel.maxZ) : "",
  );
  const [enableSoft, setEnableSoft] = useState(true);

  const stepsId = STEPS_SETTING_FOR_AXIS[axis];
  const currentSteps = settingValue(settings, stepsId);
  const currentDirMask = settingValue(settings, SETTING_DIR_PORT_INVERT);
  const draftDirMask = encodeDirInvertMask(dirFlags);
  const dirDirty =
    currentDirMask === null || draftDirMask !== Math.trunc(currentDirMask);

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

  useEffect(() => {
    if (step.id !== "travel") return;
    setMaxX(softTravel.maxX !== null ? String(softTravel.maxX) : "");
    setMaxY(softTravel.maxY !== null ? String(softTravel.maxY) : "");
    setMaxZ(softTravel.maxZ !== null ? String(softTravel.maxZ) : "");
  }, [step.id, softTravel.maxX, softTravel.maxY, softTravel.maxZ]);

  useEffect(() => {
    if (currentDirMask === null) return;
    setDirFlags(decodeDirInvertMask(currentDirMask));
  }, [currentDirMask]);

  const parseTravel = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const canAct = enabled && !busy;

  const clearConfirm = () => setStepConfirmed(false);

  return (
    <section className="cal" aria-label="Calibration wizard">
      <nav className="cal__steps" aria-label="Calibration steps">
        {WIZARD_STEPS.map((s, i) => {
          const state =
            i === stepIndex ? "current" : i < stepIndex ? "done" : "upcoming";
          const locked = !canVisit(i);
          return (
            <button
              key={s.id}
              type="button"
              className={`cal__step cal__step--${state}${locked ? " is-locked" : ""}`}
              aria-current={i === stepIndex ? "step" : undefined}
              aria-disabled={locked || undefined}
              disabled={locked}
              onClick={() => goTo(i)}
            >
              <span className="cal__step-num" aria-hidden>
                {i + 1}
              </span>
              <span className="cal__step-label">{s.label}</span>
            </button>
          );
        })}
      </nav>

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

      {step.id === "zero" && (
        <div className="cal__body" role="group" aria-labelledby="cal-step-zero">
          <h3 id="cal-step-zero" className="cal__step-title">
            Confirm zero context
          </h3>
          <p className="cal__hint">
            Before measuring steps/mm, confirm material zero (and machine home
            if you use it). Homing/limit switches are only on the zero side —
            set material origin at a known reference, then continue.
          </p>

          <div className="cal__pos" aria-label="Current position">
            <div className="cal__pos-legend" aria-hidden>
              <span />
              <span>Material</span>
              <span>Machine</span>
            </div>
            {(["X", "Y", "Z"] as const).map((ax) => {
              const key = ax.toLowerCase() as "x" | "y" | "z";
              return (
                <div key={ax} className="cal__pos-row">
                  <span className="cal__pos-axis">{ax}</span>
                  <span className="cal__pos-val">{formatMm(status.work[key])}</span>
                  <span className="cal__pos-val cal__pos-val--muted">
                    {formatMm(status.machine[key])}
                  </span>
                </div>
              );
            })}
            <p className="cal__pos-state">
              State <strong>{status.state}</strong>
            </p>
          </div>

          <div
            className="cal__actions"
            role="group"
            aria-label="Set material zero"
          >
            {ZERO_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                className="cal__btn"
                disabled={!zeroEnabled || busy}
                onClick={() => onZero(btn.id)}
                title={`Set current ${btn.id === "XYZ" ? "position" : `${btn.id} position`} as material zero (G10 L20)`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {zeroMessage ? (
            <p className="cal__message" role="status">
              {zeroMessage}
            </p>
          ) : (
            <p className="cal__hint">
              Zeroing sets the current tool location as material origin — it
              does not move the machine. Use Move tab jog if you need to
              reposition first.
            </p>
          )}

          <WizardStepConfirm
            id="cal-confirm-zero"
            checked={isConfirmed}
            disabled={!canAct}
            label={STEP_CONFIRM_LABELS.zero}
            onChange={setStepConfirmed}
          />
        </div>
      )}

      {step.id === "direction" && (
        <div
          className="cal__body"
          role="group"
          aria-labelledby="cal-step-direction"
        >
          <h3 id="cal-step-direction" className="cal__step-title">
            Axis direction invert
          </h3>
          <p className="cal__hint">
            Swap stepper direction per axis so jog +X / +Y / +Z matches your
            machine wiring (GRBL <code>$3</code>). Toggle independently, write
            the mask, then use the short test jogs to confirm before measuring
            steps/mm.
          </p>

          <p className="cal__current">
            Current ${SETTING_DIR_PORT_INVERT} ={" "}
            <strong>
              {currentDirMask !== null ? Math.trunc(currentDirMask) : "—"}
            </strong>
            {currentDirMask !== null ? (
              <>
                {" "}
                <span className="cal__meta">
                  ({describeDirInvertMask(currentDirMask)} inverted)
                </span>
              </>
            ) : (
              <> — click Read $$</>
            )}
          </p>

          <div className="cal__dir" role="group" aria-label="Invert axes">
            {(
              [
                ["X", "x"],
                ["Y", "y"],
                ["Z", "z"],
              ] as const
            ).map(([ax, key]) => (
              <div key={ax} className="cal__dir-row">
                <label className="cal__check cal__dir-toggle">
                  <input
                    type="checkbox"
                    checked={dirFlags[key]}
                    disabled={!canAct}
                    onChange={(e) => {
                      clearConfirm();
                      setDirFlags((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }));
                    }}
                  />
                  <span>
                    Invert {ax}{" "}
                    <span className="cal__meta">
                      (bit {ax === "X" ? "0" : ax === "Y" ? "1" : "2"})
                    </span>
                  </span>
                </label>
                <div
                  className="cal__dir-tests"
                  role="group"
                  aria-label={`Test jog ${ax}`}
                >
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct}
                    onClick={() => onCalibrateMove(ax, DIR_TEST_JOG_MM)}
                    title={`Jog +${DIR_TEST_JOG_MM} mm on ${ax}`}
                  >
                    Test +{ax}
                  </button>
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct}
                    onClick={() => onCalibrateMove(ax, -DIR_TEST_JOG_MM)}
                    title={`Jog −${DIR_TEST_JOG_MM} mm on ${ax}`}
                  >
                    Test −{ax}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cal__result" aria-live="polite">
            <p className="cal__result-line">
              Draft mask: <strong>{draftDirMask}</strong>{" "}
              <span className="cal__meta">
                ({describeDirInvertMask(draftDirMask)} inverted)
              </span>
            </p>
            <div className="cal__actions">
              <button
                type="button"
                className="cal__btn"
                disabled={!canAct || !dirDirty}
                onClick={() => onWriteDirInvert(draftDirMask)}
              >
                Write ${SETTING_DIR_PORT_INVERT}={draftDirMask}
              </button>
              {currentDirMask !== null && dirDirty ? (
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!canAct}
                  onClick={() =>
                    setDirFlags(decodeDirInvertMask(currentDirMask))
                  }
                >
                  Reset toggles
                </button>
              ) : null}
            </div>
          </div>

          <p className="cal__hint">
            Test jogs move {DIR_TEST_JOG_MM} mm at the current jog feed. Clear
            the bed, keep Z high for XY checks, and stand ready on E-Stop. If
            +X moves left instead of right, invert X and write again.
          </p>

          <WizardStepConfirm
            id="cal-confirm-direction"
            checked={isConfirmed}
            disabled={!canAct}
            label={STEP_CONFIRM_LABELS.direction}
            onChange={setStepConfirmed}
          />
        </div>
      )}

      {step.id === "steps" && (
        <div
          className="cal__body"
          role="group"
          aria-labelledby="cal-step-steps"
        >
          <h3 id="cal-step-steps" className="cal__step-title">
            Steps per mm
          </h3>
          <p className="cal__hint">
            Command a known move, measure the real distance with a ruler, then
            write the new steps/mm ($100–$102). Confirm axis direction first if
            jog signs look wrong.
          </p>

          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Axis</span>
              <select
                className="cal__select"
                value={axis}
                disabled={!canAct}
                onChange={(e) => {
                  clearConfirm();
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
                  clearConfirm();
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
              onChange={(e) => {
                clearConfirm();
                setMeasuredMm(e.target.value);
              }}
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

          <WizardStepConfirm
            id="cal-confirm-steps"
            checked={isConfirmed}
            disabled={!canAct}
            label={STEP_CONFIRM_LABELS.steps}
            onChange={setStepConfirmed}
          />
        </div>
      )}

      {step.id === "travel" && (
        <div
          className="cal__body"
          role="group"
          aria-labelledby="cal-step-travel"
        >
          <h3 id="cal-step-travel" className="cal__step-title">
            Soft travel / bed extents
          </h3>
          <p className="cal__hint">
            Jog to the far end of each axis (or enter known bed size), write
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
                    onChange={(e) => {
                      clearConfirm();
                      setter(e.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!canAct}
                  title={`Use current machine ${ax} (${mpos.toFixed(2)} mm)`}
                  onClick={() => {
                    clearConfirm();
                    setter(mpos.toFixed(2));
                  }}
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
              onChange={(e) => {
                clearConfirm();
                setEnableSoft(e.target.checked);
              }}
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

          <WizardStepConfirm
            id="cal-confirm-travel"
            checked={isConfirmed}
            disabled={!canAct}
            label={STEP_CONFIRM_LABELS.travel}
            onChange={setStepConfirmed}
          />

          {onOpenBedTravelTest ? (
            <div className="cal__offer">
              <button
                type="button"
                className="cal__btn"
                disabled={!canAct}
                onClick={onOpenBedTravelTest}
              >
                Bed travel test…
              </button>
              <p className="cal__offer-hint">
                After soft travel is set, run the full-bed corner walk (safe Z,
                cruise, slow approach).
              </p>
            </div>
          ) : null}
        </div>
      )}

      {message ? (
        <p className="cal__message" role="status">
          {message}
        </p>
      ) : null}

      <footer className="cal__nav">
        <button
          type="button"
          className="cal__btn cal__btn--ghost"
          disabled={isFirst}
          onClick={goBack}
        >
          Back
        </button>
        <span className="cal__nav-meta" aria-live="polite">
          {WIZARD_STEPS[stepIndex]?.short}
        </span>
        {isLast ? (
          <>
            {onOpenBedTravelTest ? (
              <button
                type="button"
                className="cal__btn cal__btn--ghost"
                disabled={!isConfirmed}
                onClick={() => {
                  onComplete?.();
                  onOpenBedTravelTest();
                }}
                title={
                  isConfirmed
                    ? "Finish calibration and open the bed travel test"
                    : "Confirm this step before finishing"
                }
              >
                Done → Bed travel test
              </button>
            ) : null}
            <button
              type="button"
              className="cal__btn"
              onClick={() => {
                onComplete?.();
                onClose?.();
              }}
              disabled={(!onClose && !onComplete) || !isConfirmed}
              title={
                isConfirmed ? undefined : "Confirm this step before finishing"
              }
            >
              Done
            </button>
          </>
        ) : (
          <button
            type="button"
            className="cal__btn"
            disabled={!isConfirmed}
            onClick={goNext}
            title={
              isConfirmed ? undefined : "Confirm this step before continuing"
            }
          >
            Next
          </button>
        )}
      </footer>
    </section>
  );
}
