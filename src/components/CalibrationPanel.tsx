import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACCEL_SETTING_FOR_AXIS,
  CALIBRATION_DISTANCE_OPTIONS_MM,
  CALIBRATION_GUIDED_STEPS,
  DEFAULT_CALIBRATION_DISTANCE_MM,
  DEFAULT_JOG_FEED_MM_MIN,
  DIR_TEST_JOG_MM,
  HOMING_FEED_SUGGEST_MAX,
  HOMING_FEED_SUGGEST_MIN,
  HOMING_PULLOFF_TYPICAL_MAX,
  HOMING_PULLOFF_TYPICAL_MIN,
  MAX_TRAVEL_SETTING_FOR_AXIS,
  RATE_SETTING_FOR_AXIS,
  RATES_RECOMMEND_DEFAULT,
  RATES_RECOMMEND_MAX,
  RATES_RECOMMEND_MIN,
  HARD_LIMITS_OPTIONAL_COPY,
  SETTING_DIR_PORT_INVERT,
  SETTING_HARD_LIMITS,
  SETTING_HOMING_CYCLE,
  SETTING_HOMING_DIR_MASK,
  SETTING_HOMING_FEED,
  SETTING_HOMING_PULLOFF,
  SETTING_HOMING_SEEK,
  SETTING_LIMIT_INVERT,
  SOFT_LIMITS_WORKING_COPY,
  SOFT_TRAVEL_MACHINE_NOT_WORK_COPY,
  SOFT_TRAVEL_NEEDS_HOMING_COPY,
  STEPS_MM_LARGE_CHANGE_FRACTION,
  STEPS_RETEST_TOLERANCE_MM,
  STEPS_SETTING_FOR_AXIS,
  Z_TRAVEL_POSITIVE_COPY,
  advanceSwitchCheck,
  allSwitchesVerified,
  buildJogCommand,
  canFitRatesTest,
  computeStepsPerMm,
  decodeDirInvertMask,
  decodeHomingDirMask,
  decodeLimitInvert,
  defaultRatesCycles,
  defaultRatesDistanceMm,
  describeDirInvertMask,
  describeHomingDirMask,
  emptySwitchCheckState,
  encodeDirInvertMask,
  encodeHomingDirMask,
  encodeLimitInvert,
  estimateStepsPerMm,
  flippedLimitInvert,
  hardLimitsEnabled,
  homingEnabled,
  homingSettingPlainLabel,
  homingSettingUnit,
  loadCalNewStepsBannerDismissed,
  loadCalibrationState,
  nextRatesTrialValue,
  ratesSettingId,
  ratesSettingPlainLabel,
  ratesSettingUnit,
  ratesTrialCeiling,
  recommendRatesValue,
  roundStepsPerMm,
  saveCalNewStepsBannerDismissed,
  softLimitsEnabled,
  stepsPerMmChangeFraction,
  suggestHomingFeed,
  suggestHomingPullOff,
  suggestHomingSeek,
  type Axis,
  type AxisDirInvert,
  type CalibrationGuidedStepId,
  type GrblSetting,
  type GrblStatus,
  type HomingXyCorner,
  type LimitAxis,
  type RatesKind,
  type RatesTrialResult,
  type SoftTravelLimits,
  type SwitchCheckState,
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
  rates: { label: "Speed & accel", short: "4 · Rates" },
  homing: { label: "Homing", short: "5 · Home" },
  travel: { label: "Soft travel", short: "6 · Travel" },
};

const WIZARD_STEPS = CALIBRATION_GUIDED_STEPS.map((id) => ({
  id,
  ...STEP_CHROME[id],
}));

const STEP_CONFIRM_LABELS: Record<CalibrationStepId, string> = {
  zero: "Machine homed (or no switches) and positions look right — I completed this step",
  direction: "Jog direction matches the machine — I completed this step",
  steps: "Measured and wrote steps/mm — I completed this step",
  rates: "Max speed and acceleration checked — I completed this step",
  homing: "Switches checked, first home done, Z repeatable — I completed this step",
  travel: "Soft travel / bed extents set — I completed this step",
};

const RATES_AXIS_TABS: Axis[] = ["X", "Y", "Z"];

/** Map layout: NW NE top row, SW SE bottom. */
const HOMING_CORNERS: {
  id: HomingXyCorner;
  label: string;
  title: string;
}[] = [
  { id: "NW", label: "NW", title: "Back-left (min X, max Y)" },
  { id: "NE", label: "NE", title: "Back-right (max X, max Y)" },
  { id: "SW", label: "SW", title: "Front-left (min X, min Y)" },
  { id: "SE", label: "SE", title: "Front-right (max X, min Y)" },
];

const LIMIT_AXES: LimitAxis[] = ["X", "Y", "Z"];

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
  onApplySoftTravel: (
    limits: SoftTravelLimits,
    enableSoft: boolean,
    enableHard?: boolean,
  ) => void;
  /**
   * Intentional overshoot jog to verify soft limits (expects error:15).
   * Bypasses app-side soft clamp.
   */
  onVerifySoftLimit?: (axis: Axis) => void;
  /**
   * Run an out-and-back G1 rates/accel trial (temp setting write + restore
   * bookkeeping). Resolves when Idle (or rejects / aborts).
   */
  onRatesTrial?: (args: {
    axis: Axis;
    kind: RatesKind;
    trialValue: number;
    baselineValue: number;
    distanceMm: number;
    cycles: number;
  }) => Promise<void> | void;
  /** Accept recommended rate/accel (old → new write). */
  onWriteRates?: (
    kind: RatesKind,
    axis: Axis,
    before: number,
    after: number,
  ) => void;
  /** Leave/cancel rates step — restore any temp trial writes. */
  onRatesCancelRestore?: () => void;
  /** Write one homing-related setting with old → new (undoable). */
  onWriteHomingSetting?: (id: number, before: number, after: number) => void;
  /**
   * Virtual CNC only: toggle `$ExtLimitX/Y/Z` so switch lights can be practiced.
   * Never wired on a real USB port.
   */
  onToggleLimitPin?: ((axis: LimitAxis) => void) | null;
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
  /** True while a rates trial is running (disables other actions). */
  ratesTrialRunning?: boolean;
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
  onVerifySoftLimit,
  onRatesTrial,
  onWriteRates,
  onRatesCancelRestore,
  onWriteHomingSetting,
  onToggleLimitPin = null,
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
  ratesTrialRunning = false,
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
  const [enableHard, setEnableHard] = useState(false);
  const [travelError, setTravelError] = useState<string | null>(null);

  // Speed & accel (rates)
  const [ratesAxis, setRatesAxis] = useState<Axis>("X");
  const [ratesKind, setRatesKind] = useState<RatesKind>("rate");
  const [ratesReady, setRatesReady] = useState(false);
  const [ratesDistanceMm, setRatesDistanceMm] = useState(
    defaultRatesDistanceMm("X"),
  );
  const [ratesCycles, setRatesCycles] = useState(defaultRatesCycles("X"));
  const [ratesTrial, setRatesTrial] = useState<number | null>(null);
  const [ratesBaseline, setRatesBaseline] = useState<number | null>(null);
  const [ratesLastPassing, setRatesLastPassing] = useState<number | null>(null);
  const [ratesAskOpen, setRatesAskOpen] = useState(false);
  const [ratesFailed, setRatesFailed] = useState(false);
  const [ratesFactor, setRatesFactor] = useState(RATES_RECOMMEND_DEFAULT);
  const [ratesGateError, setRatesGateError] = useState<string | null>(null);

  // Homing setup (PR 4)
  const [switchCheck, setSwitchCheck] = useState<SwitchCheckState>(
    emptySwitchCheckState,
  );
  const [homingCorner, setHomingCorner] = useState<HomingXyCorner>("SW");
  const [seekDraft, setSeekDraft] = useState("");
  const [feedDraft, setFeedDraft] = useState("");
  const [pullOffDraft, setPullOffDraft] = useState("");
  const [firstHomeArmed, setFirstHomeArmed] = useState(false);
  const [firstHomeDone, setFirstHomeDone] = useState(false);
  const [zRepeatAnswers, setZRepeatAnswers] = useState<(boolean | null)[]>([
    null,
    null,
    null,
  ]);

  const [showNewStepsBanner, setShowNewStepsBanner] = useState(() => {
    try {
      return (
        loadCalibrationState().calibrationCompleted &&
        !loadCalNewStepsBannerDismissed()
      );
    } catch {
      return false;
    }
  });

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
  const hardOn = settings ? hardLimitsEnabled(settings) : false;
  const homingStepIndex = WIZARD_STEPS.findIndex((s) => s.id === "homing");

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

  // Leaving the rates step restores any temporary trial writes.
  useEffect(() => {
    if (step.id === "rates") return;
    onRatesCancelRestore?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on step leave
  }, [step.id]);

  const resetRatesSession = (axis: Axis, kind: RatesKind) => {
    setRatesReady(false);
    setRatesAskOpen(false);
    setRatesFailed(false);
    setRatesLastPassing(null);
    setRatesGateError(null);
    setRatesFactor(RATES_RECOMMEND_DEFAULT);
    setRatesDistanceMm(defaultRatesDistanceMm(axis));
    setRatesCycles(defaultRatesCycles(axis));
    const id = ratesSettingId(kind, axis);
    const cur = settingValue(settings, id);
    setRatesBaseline(cur);
    setRatesTrial(cur);
  };

  useEffect(() => {
    if (step.id !== "rates") return;
    resetRatesSession(ratesAxis, ratesKind);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed when entering rates
  }, [step.id]);

  // Advance switch lights: on → off ⇒ ✓
  useEffect(() => {
    if (step.id !== "homing") return;
    const pins = status.pins;
    setSwitchCheck((prev) =>
      advanceSwitchCheck(prev, {
        X: pins?.limitX === true,
        Y: pins?.limitY === true,
        Z: pins?.limitZ === true,
      }),
    );
  }, [
    step.id,
    status.pins?.limitX,
    status.pins?.limitY,
    status.pins?.limitZ,
    status.pins?.raw,
  ]);

  // Seed homing form from loaded settings when entering the step.
  useEffect(() => {
    if (step.id !== "homing") return;
    const dir = settingValue(settings, SETTING_HOMING_DIR_MASK);
    if (dir !== null) setHomingCorner(decodeHomingDirMask(dir).xyCorner);
    const seek = settingValue(settings, SETTING_HOMING_SEEK);
    const feed = settingValue(settings, SETTING_HOMING_FEED);
    const pull = settingValue(settings, SETTING_HOMING_PULLOFF);
    setSeekDraft(
      String(
        suggestHomingSeek(seek, {
          x: settingValue(settings, RATE_SETTING_FOR_AXIS.X),
          y: settingValue(settings, RATE_SETTING_FOR_AXIS.Y),
          z: settingValue(settings, RATE_SETTING_FOR_AXIS.Z),
        }) ?? seek ?? 500,
      ),
    );
    setFeedDraft(String(suggestHomingFeed(feed)));
    setPullOffDraft(String(suggestHomingPullOff(pull)));
    setFirstHomeArmed(false);
    // Keep firstHomeDone / switchCheck / zRepeat across re-entry in session.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on enter
  }, [step.id, settings]);

  useEffect(() => {
    if (homing?.homed && firstHomeArmed) {
      setFirstHomeDone(true);
    }
  }, [homing?.homed, firstHomeArmed]);

  const parseTravel = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const canAct = enabled && !busy && !ratesTrialRunning;

  const clearConfirm = () => setStepConfirmed(false);

  const switchesOk = allSwitchesVerified(switchCheck);
  const limitInvertNow = settingValue(settings, SETTING_LIMIT_INVERT) ?? 0;
  const homingDirNow = settingValue(settings, SETTING_HOMING_DIR_MASK);
  const homingCycleNow = settingValue(settings, SETTING_HOMING_CYCLE);
  const draftHomingMask = encodeHomingDirMask({
    xyCorner: homingCorner,
    zSide: "top",
  });
  const homingDirDirty =
    homingDirNow === null || draftHomingMask !== Math.trunc(homingDirNow);
  const zRepeatDone = zRepeatAnswers.every((a) => a !== null);
  const zRepeatDrift = zRepeatAnswers.some((a) => a === false);
  const limOn = {
    X: status.pins?.limitX === true,
    Y: status.pins?.limitY === true,
    Z: status.pins?.limitZ === true,
  };
  /** Light on while not yet ✓ — may mean polarity is inverted if nothing is pressed. */
  const maybeInvertedAxis = LIMIT_AXES.find(
    (ax) => limOn[ax] && !switchCheck[ax].verified,
  );

  const ratesSettingNow = settingValue(
    settings,
    ratesSettingId(ratesKind, ratesAxis),
  );
  const ratesCeiling =
    ratesBaseline !== null && ratesBaseline > 0
      ? ratesTrialCeiling(ratesBaseline)
      : null;
  const ratesRecommended =
    ratesLastPassing !== null
      ? recommendRatesValue(ratesLastPassing, ratesFactor, ratesKind)
      : null;
  const ratesFit = canFitRatesTest(
    machinePos,
    softTravel,
    ratesAxis,
    ratesDistanceMm,
  );
  const ratesIdle = status.state === "Idle" || status.state === "Check";

  const startRatesTrial = async (trialValue: number) => {
    if (!onRatesTrial) return;
    if (ratesBaseline === null || !Number.isFinite(ratesBaseline)) {
      setRatesGateError("Load settings first (Reload).");
      return;
    }
    if (!ratesIdle) {
      setRatesGateError("Wait for Idle before starting a trial.");
      return;
    }
    if (!ratesFit.ok) {
      setRatesGateError(ratesFit.reason ?? "Test does not fit soft travel.");
      return;
    }
    if (ratesCeiling !== null && trialValue > ratesCeiling + 1e-9) {
      setRatesGateError(
        `Trial ${trialValue} is above the safety ceiling (${ratesCeiling}).`,
      );
      return;
    }
    setRatesGateError(null);
    setRatesAskOpen(false);
    setRatesTrial(trialValue);
    try {
      await onRatesTrial({
        axis: ratesAxis,
        kind: ratesKind,
        trialValue,
        baselineValue: ratesBaseline,
        distanceMm: ratesDistanceMm,
        cycles: ratesCycles,
      });
      setRatesAskOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRatesGateError(message);
    }
  };

  const onRatesResult = (result: RatesTrialResult) => {
    clearConfirm();
    setRatesAskOpen(false);
    if (result === "pass") {
      const passing = ratesTrial ?? ratesBaseline;
      if (passing !== null) setRatesLastPassing(passing);
      setRatesFailed(false);
      if (passing !== null && ratesCeiling !== null) {
        const next = nextRatesTrialValue(passing, ratesCeiling, ratesKind);
        if (next !== null) {
          // Offer next ramp — operator clicks Run again.
          setRatesTrial(next);
          return;
        }
      }
      // At ceiling or no further ramp — show recommend.
      return;
    }
    // off / stall — stop ramp; recommend last passing (or none).
    setRatesFailed(true);
  };

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

      {showNewStepsBanner ? (
        <div className="cal__banner" role="status">
          <p className="cal__banner-body">
            New: Speed &amp; accel and Homing setup steps.
          </p>
          <button
            type="button"
            className="cal__link"
            onClick={() => {
              saveCalNewStepsBannerDismissed();
              setShowNewStepsBanner(false);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

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

      {step.id === "rates" && (
        <div
          className="cal__body"
          role="group"
          aria-labelledby="cal-step-rates"
        >
          <h3 id="cal-step-rates" className="cal__step-title">
            Speed &amp; acceleration
          </h3>
          <p className="cal__hint">
            GRBL can&rsquo;t tell when a motor skips a step. So we move an axis
            fast, back and forth, and check it comes back to exactly where it
            started. Then we back off a bit for safety.
          </p>

          <div className="cal__tabs" role="tablist" aria-label="Axis">
            {RATES_AXIS_TABS.map((ax) => (
              <button
                key={ax}
                type="button"
                role="tab"
                aria-selected={ratesAxis === ax}
                className={`cal__tab${ratesAxis === ax ? " is-active" : ""}`}
                disabled={!canAct}
                onClick={() => {
                  clearConfirm();
                  onRatesCancelRestore?.();
                  setRatesAxis(ax);
                  setRatesKind("rate");
                  resetRatesSession(ax, "rate");
                }}
              >
                {ax}
              </button>
            ))}
          </div>

          {ratesAxis === "Z" ? (
            <p className="cal__warn cal__warn--callout" role="note">
              Z lifts the spindle against gravity, so lower numbers than X/Y are
              normal. Z usually skips going <strong>up</strong>. If it loses
              steps on the way up, SharpCNC thinks the tool is higher than it
              really is, so every plunge after that goes deeper than planned,
              and it gets worse through the job.
            </p>
          ) : null}

          <div className="cal__tabs cal__tabs--sub" role="tablist" aria-label="Rate or accel">
            <button
              type="button"
              role="tab"
              aria-selected={ratesKind === "rate"}
              className={`cal__tab${ratesKind === "rate" ? " is-active" : ""}`}
              disabled={!canAct}
              onClick={() => {
                clearConfirm();
                onRatesCancelRestore?.();
                setRatesKind("rate");
                resetRatesSession(ratesAxis, "rate");
              }}
            >
              Max speed
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ratesKind === "accel"}
              className={`cal__tab${ratesKind === "accel" ? " is-active" : ""}`}
              disabled={!canAct}
              onClick={() => {
                clearConfirm();
                onRatesCancelRestore?.();
                setRatesKind("accel");
                resetRatesSession(ratesAxis, "accel");
              }}
            >
              Acceleration
            </button>
          </div>

          <p className="cal__current">
            {ratesSettingPlainLabel(ratesKind, ratesAxis)}{" "}
            <span className="cal__meta">
              (${ratesSettingId(ratesKind, ratesAxis)})
            </span>
            {": "}
            <strong>
              {ratesSettingNow !== null ? ratesSettingNow : "—"}
            </strong>{" "}
            {ratesSettingUnit(ratesKind)}
            {ratesKind === "rate" ? (
              <>
                {" · "}
                accel $
                {ACCEL_SETTING_FOR_AXIS[ratesAxis]}=
                {settingValue(settings, ACCEL_SETTING_FOR_AXIS[ratesAxis]) ?? "—"}
              </>
            ) : (
              <>
                {" · "}
                max rate $
                {RATE_SETTING_FOR_AXIS[ratesAxis]}=
                {settingValue(settings, RATE_SETTING_FOR_AXIS[ratesAxis]) ?? "—"}
              </>
            )}
          </p>

          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Test distance (mm)</span>
              <input
                className="cal__input"
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={ratesDistanceMm}
                disabled={!canAct || ratesReady}
                onChange={(e) => {
                  clearConfirm();
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) setRatesDistanceMm(n);
                }}
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Cycles (out &amp; back)</span>
              <input
                className="cal__input"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={ratesCycles}
                disabled={!canAct || ratesReady}
                onChange={(e) => {
                  clearConfirm();
                  const n = Math.trunc(Number(e.target.value));
                  if (Number.isFinite(n) && n >= 1) setRatesCycles(n);
                }}
              />
            </label>
          </div>

          {!ratesReady ? (
            <div className="cal__actions">
              <p className="cal__hint">
                Put a dial indicator or a pencil mark at the carriage. Confirm
                the test distance fits soft travel, then click Ready.
              </p>
              {!ratesFit.ok ? (
                <p className="cal__warn" role="alert">
                  {ratesFit.reason}
                </p>
              ) : null}
              <button
                type="button"
                className="cal__btn"
                disabled={!canAct || !ratesFit.ok || ratesBaseline === null}
                onClick={() => {
                  clearConfirm();
                  setRatesReady(true);
                  setRatesGateError(null);
                }}
              >
                Ready
              </button>
            </div>
          ) : (
            <>
              <p className="cal__hint" role="status">
                Reference set. Trial{" "}
                {ratesKind === "rate" ? "max rate" : "acceleration"}:{" "}
                <strong>{ratesTrial ?? "—"}</strong>{" "}
                {ratesSettingUnit(ratesKind)}
                {ratesCeiling !== null
                  ? ` (ceiling ${ratesCeiling} = 2× starting value)`
                  : ""}
                .{" "}
                {ratesAxis === "Z"
                  ? "Z starts down, then returns up — check the mark after the final up move."
                  : "Out and back — check the mark when Idle."}
              </p>

              <div className="cal__actions">
                <button
                  type="button"
                  className="cal__btn"
                  disabled={
                    !canAct ||
                    !onRatesTrial ||
                    ratesTrial === null ||
                    ratesAskOpen ||
                    ratesTrialRunning
                  }
                  onClick={() => {
                    if (ratesTrial !== null) void startRatesTrial(ratesTrial);
                  }}
                >
                  {ratesTrialRunning
                    ? "Running…"
                    : ratesLastPassing !== null &&
                        ratesTrial !== null &&
                        ratesTrial > ratesLastPassing
                      ? `Run trial at ${ratesTrial}`
                      : `Run ${ratesCycles}× out-and-back`}
                </button>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!canAct || ratesTrialRunning}
                  onClick={() => {
                    onRatesCancelRestore?.();
                    resetRatesSession(ratesAxis, ratesKind);
                  }}
                >
                  Reset / cancel
                </button>
              </div>

              {ratesAskOpen ? (
                <div className="cal__dir-ask" role="group" aria-label="Trial result">
                  <p className="cal__dir-ask-label">
                    {ratesAxis === "Z"
                      ? "After the final up move — did it come back to the mark?"
                      : "Did it come back to the mark?"}
                  </p>
                  <div className="cal__actions">
                    <button
                      type="button"
                      className="cal__btn"
                      disabled={!canAct}
                      onClick={() => onRatesResult("pass")}
                    >
                      Yes, same spot
                    </button>
                    <button
                      type="button"
                      className="cal__btn cal__btn--ghost"
                      disabled={!canAct}
                      onClick={() => onRatesResult("off")}
                    >
                      It&rsquo;s off
                    </button>
                    <button
                      type="button"
                      className="cal__btn cal__btn--ghost"
                      disabled={!canAct}
                      onClick={() => onRatesResult("stall")}
                    >
                      Stalled / grinding
                    </button>
                  </div>
                </div>
              ) : null}

              {ratesLastPassing !== null &&
              (ratesFailed ||
                (ratesCeiling !== null &&
                  ratesTrial !== null &&
                  nextRatesTrialValue(ratesLastPassing, ratesCeiling, ratesKind) ===
                    null &&
                  !ratesAskOpen)) ? (
                <div className="cal__result" aria-live="polite">
                  <p className="cal__hint">
                    Last passing: <strong>{ratesLastPassing}</strong>{" "}
                    {ratesSettingUnit(ratesKind)}. Recommend ×
                    {ratesFactor.toFixed(2)} (0.7–0.8).
                  </p>
                  <label className="cal__field">
                    <span className="cal__field-label">
                      Safety factor {ratesFactor.toFixed(2)}
                    </span>
                    <input
                      className="cal__input"
                      type="range"
                      min={RATES_RECOMMEND_MIN}
                      max={RATES_RECOMMEND_MAX}
                      step="0.01"
                      value={ratesFactor}
                      disabled={!canAct}
                      onChange={(e) =>
                        setRatesFactor(Number(e.target.value))
                      }
                    />
                  </label>
                  {ratesRecommended !== null && ratesBaseline !== null ? (
                    <>
                      <p className="cal__result-line">
                        Before: <strong>{ratesBaseline}</strong>
                        {" → "}
                        After: <strong>{ratesRecommended}</strong>{" "}
                        {ratesSettingUnit(ratesKind)}
                      </p>
                      <button
                        type="button"
                        className="cal__btn"
                        disabled={!canAct || !onWriteRates}
                        onClick={() => {
                          onWriteRates?.(
                            ratesKind,
                            ratesAxis,
                            ratesBaseline,
                            ratesRecommended,
                          );
                          // Accept clears temp restore; seed next kind/axis from new value.
                          setRatesBaseline(ratesRecommended);
                          setRatesTrial(ratesRecommended);
                          setRatesLastPassing(null);
                          setRatesFailed(false);
                          setRatesAskOpen(false);
                          setRatesReady(false);
                        }}
                      >
                        Write $
                        {ratesSettingId(ratesKind, ratesAxis)}=
                        {ratesRecommended}
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              {ratesLastPassing !== null &&
              !ratesFailed &&
              ratesTrial !== null &&
              ratesLastPassing < ratesTrial &&
              !ratesAskOpen ? (
                <div className="cal__actions">
                  <p className="cal__hint" role="status">
                    Passed at {ratesLastPassing}. Next trial offered at{" "}
                    {ratesTrial} (+20%).
                  </p>
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct}
                    onClick={() => setRatesFailed(true)}
                  >
                    Stop ramp — recommend
                  </button>
                </div>
              ) : null}
            </>
          )}

          {ratesGateError ? (
            <p className="cal__warn" role="alert">
              {ratesGateError}
            </p>
          ) : null}
          {!ratesIdle && canAct ? (
            <p className="cal__hint" role="status">
              State {status.state} — wait for Idle to start a trial.
            </p>
          ) : null}

          <WizardStepConfirm
            id="cal-confirm-rates"
            checked={isConfirmed}
            disabled={!canAct}
            label={STEP_CONFIRM_LABELS.rates}
            onChange={setStepConfirmed}
          />
        </div>
      )}

      {step.id === "homing" && (
        <div
          className="cal__body"
          role="group"
          aria-labelledby="cal-step-homing"
        >
          <h3 id="cal-step-homing" className="cal__step-title">
            Homing setup
          </h3>
          <p className="cal__hint">
            This machine has switches on the <strong>zero side only</strong>.
            Check each switch by hand, set which corner they sit on, then run a
            first home with your hand near E-Stop. GRBL homes{" "}
            <strong>Z first</strong>, so the tool lifts clear before X and Y
            move.
          </p>

          {/* Part A — switch lights */}
          <section className="cal__homing-part" aria-labelledby="cal-home-a">
            <h4 id="cal-home-a" className="cal__homing-part-title">
              1 · Check the switches
            </h4>
            <p className="cal__hint">
              Press each limit switch by hand. Its light should come on. Release
              — light goes off. Each axis needs on → off for ✓.
            </p>
            <div className="cal__switch-lights" role="group" aria-label="Limit switches">
              {LIMIT_AXES.map((ax) => {
                const on = limOn[ax];
                const st = switchCheck[ax];
                return (
                  <div
                    key={ax}
                    className={`cal__switch${on ? " is-on" : ""}${st.verified ? " is-ok" : ""}`}
                  >
                    <span
                      className={`coords__pin${on ? " is-on" : ""}`}
                      title={`${ax} limit: ${on ? "ACTIVE" : "not active"}`}
                    >
                      {ax} lim
                    </span>
                    <span className="cal__switch-meta">
                      {st.verified ? "✓" : st.seenOn ? "release…" : "press"}
                    </span>
                  </div>
                );
              })}
            </div>
            {onToggleLimitPin ? (
              <div
                className="cal__mock-limits"
                role="group"
                aria-label="Virtual CNC limit toggles"
              >
                <span className="cal__mock-limits-label">
                  Virtual CNC only · toggle:
                </span>
                {LIMIT_AXES.map((ax) => (
                  <button
                    key={ax}
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct}
                    title={`Toggle $ExtLimit${ax} (never sent to USB)`}
                    onClick={() => onToggleLimitPin(ax)}
                  >
                    {ax} limit
                  </button>
                ))}
              </div>
            ) : null}
            {maybeInvertedAxis ? (
              <div className="cal__warn cal__warn--callout" role="status">
                <p>
                  {maybeInvertedAxis} switch light is on. If you aren&apos;t
                  pressing it, this switch reads backwards.
                </p>
                <p className="cal__hint">
                  {homingSettingPlainLabel(SETTING_LIMIT_INVERT)}{" "}
                  <code>${SETTING_LIMIT_INVERT}</code>: Before:{" "}
                  <strong>{encodeLimitInvert(decodeLimitInvert(limitInvertNow))}</strong>{" "}
                  → After:{" "}
                  <strong>{flippedLimitInvert(limitInvertNow)}</strong>
                </p>
                <button
                  type="button"
                  className="cal__btn"
                  disabled={!canAct || !onWriteHomingSetting}
                  onClick={() => {
                    clearConfirm();
                    onWriteHomingSetting?.(
                      SETTING_LIMIT_INVERT,
                      encodeLimitInvert(decodeLimitInvert(limitInvertNow)),
                      flippedLimitInvert(limitInvertNow),
                    );
                  }}
                >
                  Write ${SETTING_LIMIT_INVERT}=
                  {flippedLimitInvert(limitInvertNow)}
                </button>
              </div>
            ) : null}
            {!switchesOk ? (
              <p className="cal__hint">
                Can&apos;t continue until X, Y, and Z each show ✓.
              </p>
            ) : (
              <p className="cal__hint">All three switches checked ✓</p>
            )}
          </section>

          {switchesOk ? (
            <>
              {/* Part B — direction */}
              <section className="cal__homing-part" aria-labelledby="cal-home-b">
                <h4 id="cal-home-b" className="cal__homing-part-title">
                  2 · Homing direction
                </h4>
                <p className="cal__hint">
                  Click the corner where the X/Y switches are (map: NW NE / SW
                  SE). Z switch is at the <strong>top</strong> — the only option
                  on this machine.
                </p>
                <div className="prep__corners" role="group" aria-label="XY home corner">
                  {HOMING_CORNERS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`cal__btn cal__btn--ghost${homingCorner === c.id ? " is-active" : ""}`}
                      title={c.title}
                      disabled={!canAct}
                      onClick={() => {
                        clearConfirm();
                        setHomingCorner(c.id);
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <label className="cal__check">
                  <input type="checkbox" checked readOnly disabled />
                  <span>Z switch is at the top</span>
                </label>
                <p className="cal__hint">
                  Not supported: Z switch at the bottom of travel.
                </p>
                <p className="cal__current">
                  {homingSettingPlainLabel(SETTING_HOMING_DIR_MASK)}{" "}
                  <code>${SETTING_HOMING_DIR_MASK}</code>
                  {homingDirNow !== null
                    ? `: Before: ${homingDirNow} (${describeHomingDirMask(homingDirNow)})`
                    : ""}
                  {" → "}
                  After: <strong>{draftHomingMask}</strong> (
                  {describeHomingDirMask(draftHomingMask)})
                </p>
                <div className="cal__actions">
                  <button
                    type="button"
                    className="cal__btn"
                    disabled={
                      !canAct || !homingDirDirty || !onWriteHomingSetting
                    }
                    onClick={() => {
                      clearConfirm();
                      onWriteHomingSetting?.(
                        SETTING_HOMING_DIR_MASK,
                        homingDirNow ?? 0,
                        draftHomingMask,
                      );
                    }}
                  >
                    Write ${SETTING_HOMING_DIR_MASK}={draftHomingMask}
                  </button>
                </div>
              </section>

              {/* Part C — speeds / pull-off */}
              <section className="cal__homing-part" aria-labelledby="cal-home-c">
                <h4 id="cal-home-c" className="cal__homing-part-title">
                  3 · Speeds and pull-off
                </h4>
                <div className="cal__travel">
                  <label className="cal__field">
                    <span className="cal__field-label">
                      {homingSettingPlainLabel(SETTING_HOMING_SEEK)} ($
                      {SETTING_HOMING_SEEK})
                    </span>
                    <input
                      className="cal__input"
                      type="number"
                      min={1}
                      step={10}
                      value={seekDraft}
                      disabled={!canAct}
                      onChange={(e) => {
                        clearConfirm();
                        setSeekDraft(e.target.value);
                      }}
                    />
                    <span className="cal__hint">
                      Suggest ≤ 50% of the slowest axis max rate.{" "}
                      {homingSettingUnit(SETTING_HOMING_SEEK)}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct || !onWriteHomingSetting}
                    onClick={() => {
                      const after = Number(seekDraft);
                      const before =
                        settingValue(settings, SETTING_HOMING_SEEK) ?? after;
                      if (!Number.isFinite(after) || after <= 0) return;
                      clearConfirm();
                      onWriteHomingSetting?.(SETTING_HOMING_SEEK, before, after);
                    }}
                  >
                    Write ${SETTING_HOMING_SEEK}={seekDraft || "…"}
                  </button>
                  <label className="cal__field">
                    <span className="cal__field-label">
                      {homingSettingPlainLabel(SETTING_HOMING_FEED)} ($
                      {SETTING_HOMING_FEED})
                    </span>
                    <input
                      className="cal__input"
                      type="number"
                      min={1}
                      step={1}
                      value={feedDraft}
                      disabled={!canAct}
                      onChange={(e) => {
                        clearConfirm();
                        setFeedDraft(e.target.value);
                      }}
                    />
                    <span className="cal__hint">
                      How slowly it makes the final touch. Suggest{" "}
                      {HOMING_FEED_SUGGEST_MIN}–{HOMING_FEED_SUGGEST_MAX}{" "}
                      {homingSettingUnit(SETTING_HOMING_FEED)}. Slower = more
                      repeatable.
                    </span>
                  </label>
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct || !onWriteHomingSetting}
                    onClick={() => {
                      const after = Number(feedDraft);
                      const before =
                        settingValue(settings, SETTING_HOMING_FEED) ?? after;
                      if (!Number.isFinite(after) || after <= 0) return;
                      clearConfirm();
                      onWriteHomingSetting?.(SETTING_HOMING_FEED, before, after);
                    }}
                  >
                    Write ${SETTING_HOMING_FEED}={feedDraft || "…"}
                  </button>
                  <label className="cal__field">
                    <span className="cal__field-label">
                      {homingSettingPlainLabel(SETTING_HOMING_PULLOFF)} ($
                      {SETTING_HOMING_PULLOFF})
                    </span>
                    <input
                      className="cal__input"
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={pullOffDraft}
                      disabled={!canAct}
                      onChange={(e) => {
                        clearConfirm();
                        setPullOffDraft(e.target.value);
                      }}
                    />
                    <span className="cal__hint">
                      How far it backs off after touching.{" "}
                      {HOMING_PULLOFF_TYPICAL_MIN}–{HOMING_PULLOFF_TYPICAL_MAX}{" "}
                      mm is typical.
                    </span>
                  </label>
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct || !onWriteHomingSetting}
                    onClick={() => {
                      const after = Number(pullOffDraft);
                      const before =
                        settingValue(settings, SETTING_HOMING_PULLOFF) ?? after;
                      if (!Number.isFinite(after) || after <= 0) return;
                      clearConfirm();
                      onWriteHomingSetting?.(
                        SETTING_HOMING_PULLOFF,
                        before,
                        after,
                      );
                    }}
                  >
                    Write ${SETTING_HOMING_PULLOFF}={pullOffDraft || "…"}
                  </button>
                </div>
              </section>

              {/* Part D — first home */}
              <section className="cal__homing-part" aria-labelledby="cal-home-d">
                <h4 id="cal-home-d" className="cal__homing-part-title">
                  4 · First home
                </h4>
                {homingCycleNow !== 1 ? (
                  <div className="cal__actions">
                    <p className="cal__current">
                      {homingSettingPlainLabel(SETTING_HOMING_CYCLE)}{" "}
                      <code>${SETTING_HOMING_CYCLE}</code>: Before:{" "}
                      <strong>{homingCycleNow ?? 0}</strong> → After:{" "}
                      <strong>1</strong>
                    </p>
                    <button
                      type="button"
                      className="cal__btn"
                      disabled={!canAct || !onWriteHomingSetting}
                      onClick={() => {
                        clearConfirm();
                        onWriteHomingSetting?.(
                          SETTING_HOMING_CYCLE,
                          homingCycleNow ?? 0,
                          1,
                        );
                      }}
                    >
                      Write ${SETTING_HOMING_CYCLE}=1
                    </button>
                  </div>
                ) : (
                  <p className="cal__hint">Homing enabled ($22=1) ✓</p>
                )}
                <div className="cal__warn cal__warn--callout" role="alert">
                  <p>
                    Keep your hand near E-Stop. If any axis heads the wrong way,
                    hit it.
                  </p>
                  <label className="cal__check">
                    <input
                      type="checkbox"
                      checked={firstHomeArmed}
                      disabled={!canAct || homingCycleNow !== 1}
                      onChange={(e) => {
                        clearConfirm();
                        setFirstHomeArmed(e.target.checked);
                      }}
                    />
                    <span>I have my hand on E-Stop — arm Home</span>
                  </label>
                </div>
                {homing ? (
                  <div className="cal__actions">
                    <button
                      type="button"
                      className="cal__btn"
                      disabled={
                        !canAct ||
                        !firstHomeArmed ||
                        !homing.enabled ||
                        !!homing.busy ||
                        homingCycleNow !== 1
                      }
                      title={
                        !firstHomeArmed
                          ? "Tick the E-Stop warning first"
                          : (homing.blockedReason ?? "Run $H")
                      }
                      onClick={() => {
                        clearConfirm();
                        homing.onHome();
                      }}
                    >
                      {homing.busy ? "Homing…" : "Home ($H)"}
                    </button>
                    {homing.message ? (
                      <p className="cal__hint" role="status">
                        {homing.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {(firstHomeDone || homing?.homed) && (
                  <p className="cal__hint">
                    MPos now X {formatMm(machinePos.x)}, Y{" "}
                    {formatMm(machinePos.y)}, Z {formatMm(machinePos.z)}. On a
                    real machine Z reads about −1 mm after homing — that&apos;s
                    the pull-off; the switch trigger point is 0. Every Z position
                    below the top is negative, which is normal.
                  </p>
                )}
              </section>

              {/* Part E — Z repeatability */}
              <section className="cal__homing-part" aria-labelledby="cal-home-e">
                <h4 id="cal-home-e" className="cal__homing-part-title">
                  5 · Z repeatability
                </h4>
                <p className="cal__hint">
                  Home 3 times. After each, check your dial indicator or mark.
                </p>
                <div className="cal__z-repeat">
                  {zRepeatAnswers.map((ans, i) => (
                    <div key={i} className="cal__z-repeat-row">
                      <span className="cal__field-label">Run {i + 1}</span>
                      <button
                        type="button"
                        className={`cal__btn cal__btn--ghost${ans === true ? " is-active" : ""}`}
                        disabled={!canAct}
                        onClick={() => {
                          clearConfirm();
                          setZRepeatAnswers((prev) => {
                            const next = [...prev];
                            next[i] = true;
                            return next;
                          });
                        }}
                      >
                        Yes, same
                      </button>
                      <button
                        type="button"
                        className={`cal__btn cal__btn--ghost${ans === false ? " is-active" : ""}`}
                        disabled={!canAct}
                        onClick={() => {
                          clearConfirm();
                          setZRepeatAnswers((prev) => {
                            const next = [...prev];
                            next[i] = false;
                            return next;
                          });
                        }}
                      >
                        Drifted
                      </button>
                    </div>
                  ))}
                </div>
                {zRepeatDrift ? (
                  <div className="cal__warn cal__warn--callout" role="status">
                    <p>Try a slower final touch.</p>
                    <button
                      type="button"
                      className="cal__btn cal__btn--ghost"
                      disabled={!canAct || !onWriteHomingSetting}
                      onClick={() => {
                        const before =
                          settingValue(settings, SETTING_HOMING_FEED) ??
                          Number(feedDraft) ??
                          25;
                        const after = Math.max(
                          HOMING_FEED_SUGGEST_MIN,
                          Math.round(before * 0.7),
                        );
                        clearConfirm();
                        setFeedDraft(String(after));
                        onWriteHomingSetting?.(
                          SETTING_HOMING_FEED,
                          before,
                          after,
                        );
                      }}
                    >
                      Lower ${SETTING_HOMING_FEED} (slower touch)
                    </button>
                  </div>
                ) : null}
                {zRepeatDone && !zRepeatDrift ? (
                  <p className="cal__hint">Z came back to the mark on all 3 ✓</p>
                ) : null}
              </section>
            </>
          ) : null}

          <WizardStepConfirm
            id="cal-confirm-homing"
            checked={isConfirmed}
            disabled={!canAct || !switchesOk}
            label={STEP_CONFIRM_LABELS.homing}
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

          {!homingOn ? (
            <div className="cal__warn cal__warn--callout" role="alert">
              <p className="cal__hint">{SOFT_TRAVEL_NEEDS_HOMING_COPY}</p>
              {homingStepIndex >= 0 && canVisit(homingStepIndex) ? (
                <button
                  type="button"
                  className="cal__link"
                  onClick={() => goTo(homingStepIndex)}
                >
                  Open Homing step
                </button>
              ) : (
                <p className="cal__hint">
                  Use <strong>Back</strong> to finish Homing (enable $22) first.
                </p>
              )}
            </div>
          ) : null}

          <p className="cal__warn cal__warn--callout" role="note">
            {SOFT_TRAVEL_MACHINE_NOT_WORK_COPY}
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
                    disabled={!canAct || !homingOn}
                    onChange={(e) => {
                      clearConfirm();
                      setter(e.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!canAct || !homingOn}
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

          <p className="cal__hint">{Z_TRAVEL_POSITIVE_COPY}</p>

          <label className="cal__check">
            <input
              type="checkbox"
              checked={enableSoft}
              disabled={!canAct || !homingOn}
              onChange={(e) => {
                clearConfirm();
                setEnableSoft(e.target.checked);
              }}
            />
            <span>Enable soft limits ($20=1)</span>
          </label>

          <label className="cal__check">
            <input
              type="checkbox"
              checked={enableHard}
              disabled={!canAct || !homingOn}
              onChange={(e) => {
                clearConfirm();
                setEnableHard(e.target.checked);
              }}
            />
            <span>
              Hard limits optional (${SETTING_HARD_LIMITS}
              {hardOn ? ", currently on" : ""}) — {HARD_LIMITS_OPTIONAL_COPY}
            </span>
          </label>

          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!canAct || !homingOn}
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
                onApplySoftTravel(next, enableSoft, enableHard);
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

          {onVerifySoftLimit && softOn ? (
            <div className="cal__homing-part" aria-label="Test soft limits">
              <h4 className="cal__homing-part-title">Test the limit</h4>
              <p className="cal__hint">
                Jogs just past the soft edge. Real GRBL answers{" "}
                <code>error:15</code> and stays Idle — that means the fence
                works.
              </p>
              <div className="cal__actions">
                {(["Z", "X", "Y"] as const).map((ax) => (
                  <button
                    key={ax}
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!canAct || !homingOn}
                    onClick={() => onVerifySoftLimit(ax)}
                  >
                    Test {ax} limit
                  </button>
                ))}
              </div>
              {message && /Soft limits working/i.test(message) ? (
                <p className="cal__pass" role="status">
                  {SOFT_LIMITS_WORKING_COPY}
                </p>
              ) : null}
            </div>
          ) : null}

          <WizardStepConfirm
            id="cal-confirm-travel"
            checked={isConfirmed}
            disabled={!canAct || !homingOn}
            label={STEP_CONFIRM_LABELS.travel}
            onChange={setStepConfirmed}
          />

          {onOpenBedTravelTest ? (
            <div className="cal__offer">
              <button
                type="button"
                className="cal__btn cal__btn--ghost"
                disabled={!canAct || !homingOn}
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
