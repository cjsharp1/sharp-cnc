import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CALIBRATION_DISTANCE_OPTIONS_MM,
  CALIBRATION_GUIDED_STEPS,
  DEFAULT_CALIBRATION_DISTANCE_MM,
  DEFAULT_JOG_FEED_MM_MIN,
  DIR_TEST_JOG_MM,
  MAX_TRAVEL_SETTING_FOR_AXIS,
  SETTING_DIR_PORT_INVERT,
  STEPS_MM_LARGE_CHANGE_FRACTION,
  STEPS_RETEST_TOLERANCE_MM,
  STEPS_SETTING_FOR_AXIS,
  buildJogCommand,
  computeStepsPerMm,
  decodeDirInvertMask,
  describeDirInvertMask,
  encodeDirInvertMask,
  estimateStepsPerMm,
  homingEnabled,
  roundStepsPerMm,
  softLimitsEnabled,
  stepsPerMmChangeFraction,
  type Axis,
  type AxisDirInvert,
  type CalibrationGuidedStepId,
  type GrblSetting,
  type GrblStatus,
  type SoftTravelLimits,
  type ZeroAxisSelection,
} from "../grbl";
import { useWizardStepGate, WizardStepConfirm } from "./wizardStepGate";

export type CalibrationStepId = CalibrationGuidedStepId;

const STEP_CHROME: Record<
  CalibrationStepId,
  { label: string; short: string }
> = {
  zero: { label: "Start", short: "1 · Start" },
  direction: { label: "Direction", short: "2 · Dir" },
  steps: { label: "Steps/mm", short: "3 · Steps" },
  travel: { label: "Soft travel", short: "4 · Travel" },
};

const WIZARD_STEPS = CALIBRATION_GUIDED_STEPS.map((id) => ({
  id,
  ...STEP_CHROME[id],
}));

const STEP_CONFIRM_LABELS: Record<CalibrationStepId, string> = {
  zero: "Machine homed (or no switches) and positions look right — I completed this step",
  direction: "Jog direction matches the machine — I completed this step",
  steps: "Measured and wrote steps/mm — I completed this step",
  travel: "Soft travel / bed extents set — I completed this step",
};

/** Compact Home ($H) offered on Zero context — recommended, not a hard gate. */
export interface CalibrationHomingProps {
  enabled: boolean;
  blockedReason?: string | null;
  homed: boolean;
  busy?: boolean;
  message?: string | null;
  onHome: () => void;
}

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
  /** Open the post-calibration full bed travel test (recommended, not required). */
  onOpenBedTravelTest?: () => void;
  /** Optional compact Home on Zero context (recommended). */
  homing?: CalibrationHomingProps | null;
  /** Denser chrome for the phase rail (no tall stack). */
  dense?: boolean;
  /** Jog pad shown where a step needs the operator to move the machine. */
  jogPad?: ReactNode;
  /** Download / save a `$n=value` dump of the loaded settings. */
  onBackupSettings?: () => void;
  /** Top of the session Calibrate undo stack (null = nothing to undo). */
  undoLabel?: string | null;
  onUndoCalibrateWrite?: () => void;
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

/** Z homes to the top, so Z test moves go down and stay short. */
const Z_CALIBRATION_DISTANCE_OPTIONS_MM = [10, 20, 25] as const;
const DEFAULT_Z_CALIBRATION_DISTANCE_MM = 20;

/** Direction rows: Z first — a wrong +Z plunges into the work on retract. */
const DIR_AXIS_ROWS: { ax: Axis; key: keyof AxisDirInvert; expected: string }[] =
  [
    {
      ax: "Z",
      key: "z",
      expected: "+Z → up (tool lifts off the work)",
    },
    { ax: "X", key: "x", expected: "+X → right" },
    { ax: "Y", key: "y", expected: "+Y → away from you" },
  ];

function distanceOptionsFor(axis: Axis): readonly number[] {
  return axis === "Z"
    ? Z_CALIBRATION_DISTANCE_OPTIONS_MM
    : CALIBRATION_DISTANCE_OPTIONS_MM;
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
  homing = null,
  dense = false,
  jogPad = null,
  onBackupSettings,
  undoLabel = null,
  onUndoCalibrateWrite,
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
  /** After a successful Write, offer "Move again to check". */
  const [stepsRetestPending, setStepsRetestPending] = useState(false);
  const [stepsRetestPass, setStepsRetestPass] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperMotorSteps, setHelperMotorSteps] = useState("200");
  const [helperMicrosteps, setHelperMicrosteps] = useState("8");
  const [helperMmPerRev, setHelperMmPerRev] = useState("2");

  // Axis direction ($3)
  const [dirFlags, setDirFlags] = useState<AxisDirInvert>({
    x: false,
    y: false,
    z: false,
  });
  /** Axis whose last Test ± jog still needs Yes / No. */
  const [dirTestPending, setDirTestPending] = useState<Axis | null>(null);

  // Soft travel form
  const [maxX, setMaxX] = useState(String(softTravel.maxX ?? ""));
  const [maxY, setMaxY] = useState(String(softTravel.maxY ?? ""));
  const [maxZ, setMaxZ] = useState(
    softTravel.maxZ !== null ? String(softTravel.maxZ) : "",
  );
  const [enableSoft, setEnableSoft] = useState(true);
  const [travelError, setTravelError] = useState<string | null>(null);

  const stepsId = STEPS_SETTING_FOR_AXIS[axis];
  const currentSteps = settingValue(settings, stepsId);
  const currentDirMask = settingValue(settings, SETTING_DIR_PORT_INVERT);
  const draftDirMask = encodeDirInvertMask(dirFlags);
  const dirDirty =
    currentDirMask === null || draftDirMask !== Math.trunc(currentDirMask);
  const homingOn = settings ? homingEnabled(settings) : false;

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

  const stepsLargeChange =
    computed !== null &&
    stepsPerMmChangeFraction(computed.before, computed.after) >
      STEPS_MM_LARGE_CHANGE_FRACTION;

  const helperEstimate = useMemo(() => {
    const motor = Number(helperMotorSteps);
    const micro = Number(helperMicrosteps);
    const mmRev = Number(helperMmPerRev);
    try {
      return roundStepsPerMm(estimateStepsPerMm(motor, micro, mmRev));
    } catch {
      return null;
    }
  }, [helperMotorSteps, helperMicrosteps, helperMmPerRev]);

  const softOn = settings ? softLimitsEnabled(settings) : false;

  const resetStepsMeasure = () => {
    setMoved(false);
    setMeasuredMm("");
    setStepsRetestPass(false);
  };

  // Guided steps need settings; load quietly (no raw $$ chrome — Advanced has that).
  useEffect(() => {
    if (!enabled || busy || settings) return;
    onRefreshSettings();
    // Intentionally omit onRefreshSettings — parents often pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when empty
  }, [enabled, busy, settings]);

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

  const finishToPrepare = () => {
    onComplete?.();
    onClose?.();
  };

  return (
    <section
      className={`cal${dense ? " cal--dense" : ""}`}
      aria-label="Calibration wizard"
    >
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

      <p className="cal__meta cal__meta--bar" aria-live="polite">
        {settings
          ? `${settings.size} settings · soft limits ${softOn ? "ON" : "off"}`
          : busy
            ? "Loading settings…"
            : "Settings not loaded"}
        {canAct && settings ? (
          <>
            {" · "}
            <button
              type="button"
              className="cal__link"
              onClick={onRefreshSettings}
              title="Reload GRBL settings for this wizard"
            >
              Reload
            </button>
            {onBackupSettings ? (
              <>
                {" · "}
                <button
                  type="button"
                  className="cal__link"
                  onClick={onBackupSettings}
                  title="Save a $n=value text file of the loaded settings"
                >
                  Back up settings
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </p>

      {step.id === "zero" && (
        <div className="cal__body" role="group" aria-labelledby="cal-step-zero">
          <h3 id="cal-step-zero" className="cal__step-title">
            Before you start
          </h3>
          <p className="cal__hint">
            Clear the bed and keep a hand near E-Stop. Home the machine so
            machine positions are trustworthy. Setting a material zero here is
            optional — it only helps if you want to measure from a mark. Job
            zeros are set in Prepare.
          </p>

          {homing ? (
            <div className="cal__recommend" role="group" aria-label="Homing">
              <button
                type="button"
                className="cal__btn cal__btn--ghost"
                disabled={!homing.enabled || !!homing.busy}
                title={homing.blockedReason ?? "Cycle home ($H)"}
                onClick={homing.onHome}
              >
                {homing.busy ? "Homing…" : "Home ($H)"}
              </button>
              <span className="cal__recommend-meta">
                {homing.homed ? "Homed this session" : "Home once after each power-on"}
                {homing.message ? ` · ${homing.message}` : ""}
              </span>
            </div>
          ) : null}

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
              Zeroing sets material origin — it does not move the machine.
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
            Axis direction
          </h3>
          <p className="cal__hint">
            Match jog +X / +Y / +Z to the machine. Start with Z — if +Z goes
            down, every &ldquo;safe&rdquo; retract drives the tool into the
            work. Fix direction (<code>$3</code>) before steps/mm.
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
              <> — waiting for settings</>
            )}
          </p>

          <div className="cal__dir" role="group" aria-label="Invert axes">
            {DIR_AXIS_ROWS.map(({ ax, key, expected }) => (
              <div
                key={ax}
                className={`cal__dir-row${ax === "Z" ? " cal__dir-row--z" : ""}`}
              >
                <div className="cal__dir-main">
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
                    <span>Invert {ax}</span>
                  </label>
                  <p className="cal__dir-expect">{expected}</p>
                  {ax === "Z" ? (
                    <p className="cal__warn cal__dir-z-warn" role="note">
                      If +Z goes down, every &ldquo;safe&rdquo; retract would
                      drive the tool into the work. Fix this before anything
                      else.
                    </p>
                  ) : null}
                </div>
                <div className="cal__dir-side">
                  <div
                    className="cal__dir-tests"
                    role="group"
                    aria-label={`Test jog ${ax}`}
                  >
                    <button
                      type="button"
                      className="cal__btn cal__btn--ghost"
                      disabled={!canAct}
                      onClick={() => {
                        onCalibrateMove(ax, DIR_TEST_JOG_MM);
                        setDirTestPending(ax);
                      }}
                      title={`Jog +${DIR_TEST_JOG_MM} mm on ${ax}`}
                    >
                      Test +{ax}
                    </button>
                    <button
                      type="button"
                      className="cal__btn cal__btn--ghost"
                      disabled={!canAct}
                      onClick={() => {
                        onCalibrateMove(ax, -DIR_TEST_JOG_MM);
                        setDirTestPending(ax);
                      }}
                      title={`Jog −${DIR_TEST_JOG_MM} mm on ${ax}`}
                    >
                      Test −{ax}
                    </button>
                  </div>
                  {dirTestPending === ax ? (
                    <div
                      className="cal__dir-ask"
                      role="group"
                      aria-label={`Did ${ax} go the expected way?`}
                    >
                      <span className="cal__dir-ask-label">
                        Did it go the expected way?
                      </span>
                      <button
                        type="button"
                        className="cal__btn cal__btn--ghost"
                        disabled={!canAct}
                        onClick={() => setDirTestPending(null)}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        className="cal__btn cal__btn--ghost"
                        disabled={!canAct}
                        onClick={() => {
                          clearConfirm();
                          setDirFlags((prev) => ({
                            ...prev,
                            [key]: true,
                          }));
                          setDirTestPending(null);
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {homingOn && dirDirty ? (
            <p className="cal__warn" role="status">
              Changing direction (<code>$3</code>) can also flip which way
              homing goes (<code>$23</code>). Homing is on (
              <code>$22=1</code>) — check the Homing step after you write.
            </p>
          ) : null}

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
                onClick={() => {
                  onWriteDirInvert(draftDirMask);
                  setDirTestPending(null);
                }}
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
            Command a known move, measure how far it really went, write
            steps/mm ($100–$102). For Z the move goes <strong>down</strong>
            (Z homes to the top). Use calipers or a dial indicator against the
            spindle body — a small Z error makes every cut the wrong depth.
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
                  const nextAxis = e.target.value as Axis;
                  setAxis(nextAxis);
                  setCommandedMm(
                    nextAxis === "Z"
                      ? DEFAULT_Z_CALIBRATION_DISTANCE_MM
                      : DEFAULT_CALIBRATION_DISTANCE_MM,
                  );
                  resetStepsMeasure();
                  setStepsRetestPending(false);
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
                  resetStepsMeasure();
                }}
              >
                {distanceOptionsFor(axis).map((d) => (
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

          <details
            className="cal__helper"
            open={helperOpen}
            onToggle={(e) => setHelperOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>Don&rsquo;t know your starting value?</summary>
            <p className="cal__hint">
              Estimate from the drivetrain: motor steps/rev × microsteps ÷ mm
              per rev (lead-screw lead, or pulley teeth × belt pitch).
            </p>
            <div className="cal__row cal__row--helper">
              <label className="cal__field">
                <span className="cal__field-label">Motor steps/rev</span>
                <input
                  className="cal__input"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={helperMotorSteps}
                  disabled={!canAct}
                  onChange={(e) => setHelperMotorSteps(e.target.value)}
                />
              </label>
              <label className="cal__field">
                <span className="cal__field-label">Microsteps</span>
                <select
                  className="cal__select"
                  value={helperMicrosteps}
                  disabled={!canAct}
                  onChange={(e) => setHelperMicrosteps(e.target.value)}
                >
                  {[1, 2, 4, 8, 16, 32].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cal__field">
                <span className="cal__field-label">mm per rev</span>
                <input
                  className="cal__input"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={helperMmPerRev}
                  disabled={!canAct}
                  onChange={(e) => setHelperMmPerRev(e.target.value)}
                />
              </label>
            </div>
            <p className="cal__result-line">
              Estimate:{" "}
              <strong>
                {helperEstimate !== null ? helperEstimate.toFixed(3) : "—"}
              </strong>{" "}
              steps/mm
              {helperEstimate !== null && currentSteps !== null ? (
                <span className="cal__meta">
                  {" "}
                  (controller shows {currentSteps.toFixed(3)})
                </span>
              ) : null}
            </p>
          </details>

          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!canAct || currentSteps === null}
              onClick={() => {
                onCalibrateMove(axis, axis === "Z" ? -commandedMm : commandedMm);
                setMoved(true);
                setStepsRetestPass(false);
              }}
              title={buildJogCommand(
                axis === "X"
                  ? { x: commandedMm }
                  : axis === "Y"
                    ? { y: commandedMm }
                    : { z: -commandedMm },
                DEFAULT_JOG_FEED_MM_MIN,
              )}
            >
              {stepsRetestPending
                ? axis === "Z"
                  ? `Move again — Z down ${commandedMm} mm`
                  : `Move again — +${commandedMm} ${axis}`
                : axis === "Z"
                  ? `Move Z down ${commandedMm} mm`
                  : `Move +${commandedMm} ${axis}`}
            </button>
          </div>

          <label className="cal__field">
            <span className="cal__field-label">How far it actually moved (mm)</span>
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
                const raw = e.target.value;
                setMeasuredMm(raw);
                if (stepsRetestPending) {
                  const m = Number(raw);
                  setStepsRetestPass(
                    Number.isFinite(m) &&
                      Math.abs(m - commandedMm) <= STEPS_RETEST_TOLERANCE_MM,
                  );
                } else {
                  setStepsRetestPass(false);
                }
              }}
            />
          </label>

          {stepsRetestPending && stepsRetestPass ? (
            <p className="cal__pass" role="status">
              Within ±{STEPS_RETEST_TOLERANCE_MM} mm of commanded ✓
            </p>
          ) : null}
          {stepsRetestPending &&
          moved &&
          measuredMm.trim() &&
          !stepsRetestPass ? (
            <p className="cal__hint" role="status">
              Re-measure: pass when within ±{STEPS_RETEST_TOLERANCE_MM} mm of{" "}
              {commandedMm} mm.
            </p>
          ) : null}

          {computed && !(stepsRetestPending && stepsRetestPass) ? (
            <div className="cal__result" aria-live="polite">
              <p className="cal__result-line">
                Before: <strong>{computed.before.toFixed(3)}</strong>
                {" → "}
                After: <strong>{computed.after.toFixed(3)}</strong> steps/mm
              </p>
              {stepsLargeChange ? (
                <p className="cal__warn" role="status">
                  That&rsquo;s a big change (more than ±
                  {Math.round(STEPS_MM_LARGE_CHANGE_FRACTION * 100)}%). Usually
                  this means a microstepping or screw setting is wrong, not a
                  measuring error. You can still write if you&rsquo;re sure.
                </p>
              ) : null}
              <button
                type="button"
                className="cal__btn"
                disabled={!canAct}
                onClick={() => {
                  onWriteSteps(axis, computed.before, computed.after);
                  setStepsRetestPending(true);
                  resetStepsMeasure();
                }}
              >
                Write ${stepsId}={computed.after.toFixed(3)}
              </button>
            </div>
          ) : null}

          {stepsRetestPending && !measuredMm.trim() ? (
            <p className="cal__hint" role="status">
              Written. Move again to check — pass within ±
              {STEPS_RETEST_TOLERANCE_MM} mm of commanded.
            </p>
          ) : null}

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
            Soft travel
          </h3>
          <p className="cal__hint">
            Home first. Then jog each axis to the far end of its travel, stop a
            few mm short of the hard stop, and click <strong>Use MPos</strong>.
            For Z, jog <strong>down</strong> to the lowest safe point. Writes
            $130–$132 and turns on soft limits ($20).
          </p>
          {jogPad ? <div className="cal__jog">{jogPad}</div> : null}

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
                  title={
                    ax === "Z"
                      ? `Use how far Z is below home now (${Math.abs(mpos).toFixed(2)} mm)`
                      : `Use current machine ${ax} (${mpos.toFixed(2)} mm)`
                  }
                  onClick={() => {
                    clearConfirm();
                    setTravelError(null);
                    // Z homes to the top, so machine Z is negative below home.
                    // GRBL wants $132 as a positive travel length.
                    setter(Math.abs(mpos).toFixed(2));
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
                const bad = (
                  [
                    ["X", next.maxX, maxX],
                    ["Y", next.maxY, maxY],
                    ["Z", next.maxZ, maxZ],
                  ] as const
                )
                  .filter(([, parsed, raw]) => parsed === null && raw.trim())
                  .map(([ax]) => ax);
                if (bad.length > 0) {
                  setTravelError(
                    `Max ${bad.join(", ")} must be a positive number of millimeters (travel length, not a coordinate).`,
                  );
                  return;
                }
                setTravelError(null);
                onApplySoftTravel(next, enableSoft);
              }}
            >
              Write travel + $20
            </button>
          </div>
          {travelError ? (
            <p className="cal__warn" role="alert">
              {travelError}
            </p>
          ) : null}

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
                className="cal__btn cal__btn--ghost"
                disabled={!canAct}
                onClick={onOpenBedTravelTest}
              >
                Bed travel test…
              </button>
              <p className="cal__offer-hint">
                Recommended once after soft travel — not required to finish.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {message || undoLabel ? (
        <p className="cal__message" role="status">
          {message ? <span>{message}</span> : null}
          {undoLabel && onUndoCalibrateWrite ? (
            <>
              {message ? " · " : null}
              <button
                type="button"
                className="cal__link"
                disabled={!canAct || busy}
                onClick={onUndoCalibrateWrite}
                title="Write the previous value back (session undo)"
              >
                {undoLabel}
              </button>
            </>
          ) : null}
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
                    ? "Mark calibrated, then open bed travel test"
                    : "Confirm this step before finishing"
                }
              >
                Bed test…
              </button>
            ) : null}
            <button
              type="button"
              className="cal__btn"
              onClick={finishToPrepare}
              disabled={(!onClose && !onComplete) || !isConfirmed}
              title={
                isConfirmed
                  ? "Mark calibrated and continue to Prepare"
                  : "Confirm this step before finishing"
              }
            >
              Continue to Prepare
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
