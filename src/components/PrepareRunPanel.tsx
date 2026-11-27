import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_FEED_OPTIONS_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  PREPARE_GUIDED_STEPS,
  TOOL_BIT_LABELS,
  applyStockSizeKeepingOrigin,
  loadStockDisplayUnit,
  saveStockDisplayUnit,
  stockDisplayToMm,
  stockMmToDisplay,
  stockOffsetForCorner,
  stockOffsetForWorkOriginCorner,
  stockUnitLabel,
  stockUnitMin,
  stockUnitStep,
  type GrblStatus,
  type JogMode,
  type PrepareGuidedStepId,
  type ProbeConfig,
  type SoftTravelLimits,
  type StockConfig,
  type StockCorner,
  type StockDisplayUnit,
  type ToolBitType,
  type ToolConfig,
} from "../grbl";
import { JogPanel, type JogAxisMap } from "./JogPanel";
import { ProbePinLight } from "./CoordinateReadout";
import { useWizardStepGate, WizardStepConfirm } from "./wizardStepGate";
import { PROBE_CONTINUITY_HINT } from "../grbl";

export type PrepareStepId = PrepareGuidedStepId;

const STEP_CHROME: Record<
  PrepareStepId,
  { label: string; short: string }
> = {
  stock: { label: "Stock + tool", short: "1 · Stock" },
  xy: { label: "Material XY", short: "2 · XY" },
  probe: { label: "Z probe", short: "3 · Z" },
  load: { label: "Load", short: "4 · Load" },
  ready: { label: "Ready", short: "5 · Ready" },
};

const WIZARD_STEPS = PREPARE_GUIDED_STEPS.map((id) => ({
  id,
  ...STEP_CHROME[id],
}));

/** Map layout: north on top (NW/NE), south on bottom (SW/SE). */
const CORNERS: { id: StockCorner; label: string; title: string }[] = [
  { id: "nw", label: "NW", title: "Back-left" },
  { id: "ne", label: "NE", title: "Back-right" },
  { id: "sw", label: "SW", title: "Front-left (min X/Y)" },
  { id: "se", label: "SE", title: "Front-right" },
];

interface PrepareRunPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  status: GrblStatus;
  stock: StockConfig;
  tool: ToolConfig;
  probe: ProbeConfig;
  softTravel: SoftTravelLimits;
  bedMm: { width: number; depth: number };
  jogEnabled: boolean;
  probeEnabled: boolean;
  probeBlockedReason?: string | null;
  /**
   * True after `status.pins.probe` has lit at least once this Prepare session
   * (guided continuity check before Run Z probe unlocks).
   */
  probeContinuityOk?: boolean;
  /** Virtual CNC only: pulse `Pn:P` so the continuity light can be practiced. */
  onSimulateProbeTouch?: (() => void) | null;
  busy?: boolean;
  message?: string | null;
  /** True after a successful probe (or manual Z zero) this session. */
  zProbed: boolean;
  xyZeroed: boolean;
  /** True when a job path is loaded (G-code / SVG generate). */
  jobLoaded?: boolean;
  /** Session already marked ready — Ready step shows Continue. */
  prepareReady?: boolean;
  jogMode: JogMode;
  stepMm: number;
  feedMmMin: number;
  softLimitHint?: string | null;
  gamepadStatus?: string | null;
  /** Denser chrome for the phase rail (no tall stack). */
  dense?: boolean;
  /** Jump to a step when menu deep-links (stock / load). */
  focusStep?: PrepareStepId | null;
  onFocusStepConsumed?: () => void;
  onStockChange: (next: StockConfig) => void;
  onToolChange: (next: ToolConfig) => void;
  onPlaceCorner: (corner: StockCorner) => void;
  /** Primary: G10 XY zero + stock corner at current toolhead. */
  onSetCornerFromToolhead: (corner: StockCorner) => void;
  onProbeChange: (next: ProbeConfig) => void;
  onJogModeChange: (mode: JogMode) => void;
  onStepChange: (stepMm: number) => void;
  onFeedChange: (feedMmMin: number) => void;
  onJog: (axes: JogAxisMap) => void;
  onJogEnd: () => void;
  onZeroXy: () => void;
  onRunProbe: () => void;
  onManualZZero: () => void;
  onRetract: () => void;
  onConfirmReady: () => void;
  /** Optional: open stock perimeter boundary check after XY/stock are set. */
  onOpenStockPerimeter?: () => void;
  /** Compact XY edge/corner probe (optional). */
  xyProbe?: {
    enabled: boolean;
    blockedReason?: string | null;
    busy?: boolean;
    bitDiameterMm: number;
    message?: string | null;
    onEdge: (axis: "X" | "Y", direction: "positive" | "negative") => void;
    onCorner: (mode: "outside" | "inside") => void;
    onToolLength?: () => void;
  } | null;
  /** Compact Home ($H) — recommended, not a hard gate. */
  homing?: {
    enabled: boolean;
    blockedReason?: string | null;
    busy?: boolean;
    homed: boolean;
    onHome: () => void;
  } | null;
  /** Load + place step body (file / recent / SVG / external). */
  loadSlot?: ReactNode;
  onClose?: () => void;
}

function parsePositive(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNonNeg(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function PrepareRunPanel({
  enabled,
  blockedReason,
  status,
  stock,
  tool,
  probe,
  softTravel,
  bedMm,
  jogEnabled,
  probeEnabled,
  probeBlockedReason,
  probeContinuityOk = false,
  onSimulateProbeTouch = null,
  busy = false,
  message,
  zProbed,
  xyZeroed,
  jobLoaded = false,
  prepareReady = false,
  jogMode,
  stepMm,
  feedMmMin,
  softLimitHint,
  gamepadStatus = null,
  dense = false,
  focusStep = null,
  onFocusStepConsumed,
  onStockChange,
  onToolChange,
  onPlaceCorner,
  onSetCornerFromToolhead,
  onProbeChange,
  onJogModeChange,
  onStepChange,
  onFeedChange,
  onJog,
  onJogEnd,
  onZeroXy,
  onRunProbe,
  onManualZZero,
  onRetract,
  onConfirmReady,
  onOpenStockPerimeter,
  xyProbe = null,
  homing = null,
  loadSlot = null,
  onClose,
}: PrepareRunPanelProps) {
  const {
    stepIndex,
    confirmed,
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
  const stockStep = WIZARD_STEPS.findIndex((s) => s.id === "stock");
  const xyStep = WIZARD_STEPS.findIndex((s) => s.id === "xy");
  const probeStep = WIZARD_STEPS.findIndex((s) => s.id === "probe");
  const loadStep = WIZARD_STEPS.findIndex((s) => s.id === "load");
  const safeZStep = probeStep;

  const stockConfirmed = confirmed[stockStep] === true;
  const safeZConfirmed = confirmed[safeZStep] === true;

  const canAct = enabled && !busy;

  const [stockUnit, setStockUnit] = useState<StockDisplayUnit>(() =>
    loadStockDisplayUnit(),
  );
  const unitLabel = stockUnitLabel(stockUnit);

  const setStockDisplayUnit = (next: StockDisplayUnit) => {
    setStockUnit(next);
    saveStockDisplayUnit(next);
  };

  useEffect(() => {
    if (!focusStep) return;
    const idx = WIZARD_STEPS.findIndex((s) => s.id === focusStep);
    if (idx >= 0) goTo(idx);
    onFocusStepConsumed?.();
    // Only react to a new focus request from Menu deep-links.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [focusStep]);

  /** XY zero / load are system-verifiable — auto-confirm those steps. */
  useEffect(() => {
    setStepConfirmed(xyZeroed, xyStep);
  }, [xyZeroed, xyStep, setStepConfirmed]);

  useEffect(() => {
    setStepConfirmed(jobLoaded, loadStep);
  }, [jobLoaded, loadStep, setStepConfirmed]);

  /** Clearing Z also clears the plate-removed confirm on the probe step. */
  useEffect(() => {
    if (!zProbed) setStepConfirmed(false, probeStep);
  }, [zProbed, probeStep, setStepConfirmed]);

  const activeBedCorner = useMemo(() => {
    return (
      CORNERS.find(({ id }) => {
        const expected = stockOffsetForCorner(
          stock,
          id,
          bedMm.width,
          bedMm.depth,
        );
        return (
          Math.abs(expected.offsetXMm - stock.offsetXMm) < 1e-6 &&
          Math.abs(expected.offsetYMm - stock.offsetYMm) < 1e-6
        );
      })?.id ?? null
    );
  }, [stock, bedMm.width, bedMm.depth]);

  const activeOriginCorner = useMemo(() => {
    if (stock.originCorner) return stock.originCorner;
    return (
      CORNERS.find(({ id }) => {
        const expected = stockOffsetForWorkOriginCorner(stock, id);
        return (
          Math.abs(expected.offsetXMm - stock.offsetXMm) < 1e-6 &&
          Math.abs(expected.offsetYMm - stock.offsetYMm) < 1e-6
        );
      })?.id ?? null
    );
  }, [stock]);

  const patchStock = (partial: Partial<StockConfig>) => {
    onStockChange({ ...stock, ...partial });
    setStepConfirmed(false, stockStep);
  };

  const patchStockSize = (
    size: Partial<Pick<StockConfig, "widthMm" | "lengthMm" | "thicknessMm">>,
  ) => {
    if (stock.originCorner) {
      onStockChange(applyStockSizeKeepingOrigin(stock, size));
    } else {
      onStockChange({ ...stock, ...size });
    }
    setStepConfirmed(false, stockStep);
  };

  /** Parse a stock size field (display unit) → stored mm. */
  const patchStockSizeFromDisplay = (
    key: "widthMm" | "lengthMm" | "thicknessMm",
    raw: string,
    fallbackMm: number,
  ) => {
    const displayFallback = stockMmToDisplay(fallbackMm, stockUnit);
    const display = parsePositive(raw, displayFallback);
    patchStockSize({ [key]: stockDisplayToMm(display, stockUnit) });
  };

  const patchTool = (partial: Partial<ToolConfig>) => {
    onToolChange({ ...tool, ...partial });
    setStepConfirmed(false, stockStep);
  };

  const patchProbe = (partial: Partial<ProbeConfig>) => {
    onProbeChange({ ...probe, ...partial });
    if (step.id === "probe") setStepConfirmed(false, probeStep);
  };

  const nextDisabled = !isConfirmed;

  const softMaxHint =
    softTravel.maxZ !== null
      ? `Soft max Z ${softTravel.maxZ} mm`
      : "Soft max Z not set — probe seek carefully";

  const markReadyDisabled =
    !stockConfirmed ||
    !xyZeroed ||
    !zProbed ||
    !safeZConfirmed ||
    !jobLoaded ||
    busy;

  const markReadyReason = busy
    ? "Busy — wait for the machine"
    : !stockConfirmed
      ? "Confirm stock + tool first"
      : !xyZeroed
        ? "Set material XY zero first"
        : !zProbed
          ? "Probe or zero Z first"
          : !safeZConfirmed
            ? "Confirm plate removed / clear first"
            : !jobLoaded
              ? "Load a path first"
              : null;

  const retractDisabled = !jogEnabled || busy || !zProbed;
  const retractReason = busy
    ? "Busy — wait for the machine"
    : !jogEnabled
      ? (blockedReason ?? "Motion locked")
      : !zProbed
        ? "Probe or zero Z before retracting"
        : null;

  return (
    <section
      className={`cal prep${dense ? " cal--dense prep--dense" : ""}`}
      aria-label="Prepare phase"
    >
      <nav className="cal__steps prep__steps" aria-label="Prepare steps">
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

      {step.id === "stock" && (
        <div className="cal__body" role="group" aria-labelledby="prep-stock">
          <h3 id="prep-stock" className="cal__step-title">
            Stock + tool
          </h3>
          <p className="cal__hint">
            Enter blank size and bit. Bed corners place the stock rectangle on
            the soft-travel frame (map: NW NE / SW SE). Machine / GRBL stay in
            mm — inches only change how you type the blank.
          </p>
          <div className="prep__stock-units" role="group" aria-label="Stock size units">
            <span className="cal__field-label">Stock units</span>
            <div className="prep__unit-toggle">
              <button
                type="button"
                className={`prep__unit-btn${stockUnit === "mm" ? " is-active" : ""}`}
                aria-pressed={stockUnit === "mm"}
                disabled={!canAct}
                onClick={() => setStockDisplayUnit("mm")}
              >
                mm
              </button>
              <button
                type="button"
                className={`prep__unit-btn${stockUnit === "in" ? " is-active" : ""}`}
                aria-pressed={stockUnit === "in"}
                disabled={!canAct}
                title="Inches for stock size entry (stored as mm for the machine)"
                onClick={() => setStockDisplayUnit("in")}
              >
                in
              </button>
            </div>
          </div>
          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">W X {unitLabel}</span>
              <input
                className="cal__input"
                type="number"
                min={stockUnitMin(stockUnit)}
                step={stockUnitStep(stockUnit, "xy")}
                value={stockMmToDisplay(stock.widthMm, stockUnit)}
                disabled={!canAct}
                onChange={(e) =>
                  patchStockSizeFromDisplay(
                    "widthMm",
                    e.target.value,
                    stock.widthMm,
                  )
                }
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">L Y {unitLabel}</span>
              <input
                className="cal__input"
                type="number"
                min={stockUnitMin(stockUnit)}
                step={stockUnitStep(stockUnit, "xy")}
                value={stockMmToDisplay(stock.lengthMm, stockUnit)}
                disabled={!canAct}
                onChange={(e) =>
                  patchStockSizeFromDisplay(
                    "lengthMm",
                    e.target.value,
                    stock.lengthMm,
                  )
                }
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">T {unitLabel}</span>
              <input
                className="cal__input"
                type="number"
                min={stockUnitMin(stockUnit)}
                step={stockUnitStep(stockUnit, "thickness")}
                value={stockMmToDisplay(stock.thicknessMm, stockUnit)}
                disabled={!canAct}
                onChange={(e) =>
                  patchStockSizeFromDisplay(
                    "thicknessMm",
                    e.target.value,
                    stock.thicknessMm,
                  )
                }
              />
            </label>
          </div>
          <div className="cal__row">
            <div className="cal__field">
              <span className="cal__field-label">Bed corner</span>
              <div className="prep__corners">
                {CORNERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cal__btn cal__btn--ghost${activeBedCorner === c.id ? " is-active" : ""}`}
                    title={`${c.title} — soft-travel bed only`}
                    disabled={!canAct}
                    onClick={() => {
                      onPlaceCorner(c.id);
                      setStepConfirmed(false, stockStep);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="cal__field">
              <span className="cal__field-label">Bit</span>
              <select
                className="cal__select"
                value={tool.type}
                disabled={!canAct}
                onChange={(e) =>
                  patchTool({ type: e.target.value as ToolBitType })
                }
              >
                {(Object.keys(TOOL_BIT_LABELS) as ToolBitType[]).map((t) => (
                  <option key={t} value={t}>
                    {TOOL_BIT_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Ø mm</span>
              <input
                className="cal__input"
                type="number"
                min={0.1}
                step={0.1}
                value={tool.diameterMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchTool({
                    diameterMm: parsePositive(e.target.value, tool.diameterMm),
                  })
                }
              />
            </label>
          </div>
          {tool.type === "vbit" ? (
            <label className="cal__field">
              <span className="cal__field-label">Tip angle °</span>
              <input
                className="cal__input"
                type="number"
                min={1}
                max={179}
                step={1}
                value={tool.tipAngleDeg}
                disabled={!canAct}
                onChange={(e) =>
                  patchTool({
                    tipAngleDeg: parsePositive(
                      e.target.value,
                      tool.tipAngleDeg,
                    ),
                  })
                }
              />
            </label>
          ) : null}
          {activeOriginCorner ? (
            <p className="cal__meta prep__ok">
              Material-origin anchor: {activeOriginCorner.toUpperCase()}
            </p>
          ) : (
            <p className="cal__meta">
              Tip: on Material XY, set zero + stock corner from the tip.
            </p>
          )}
          {homing ? (
            <div className="cal__actions">
              <button
                type="button"
                className="cal__btn cal__btn--ghost"
                disabled={!homing.enabled || !!homing.busy}
                title={
                  !homing.enabled
                    ? (homing.blockedReason ?? "Homing unavailable")
                    : (homing.blockedReason ?? "Cycle home ($H)")
                }
                onClick={homing.onHome}
              >
                {homing.busy ? (
                  "Homing…"
                ) : (
                  <>
                    {homing.homed ? "Re-home" : "Home"}{" "}
                    <span className="cal__btn-code">$H</span>
                  </>
                )}
              </button>
              <span className="cal__meta">Home once after each power-on, before setting zeros</span>
            </div>
          ) : null}
          <WizardStepConfirm
            id="prep-confirm-stock"
            checked={stockConfirmed}
            disabled={!canAct}
            label="Stock clamped · size and bit look right"
            onChange={(v) => setStepConfirmed(v, stockStep)}
          />
        </div>
      )}

      {step.id === "xy" && (
        <div className="cal__body" role="group" aria-labelledby="prep-xy">
          <h3 id="prep-xy" className="cal__step-title">
            Material XY + jog
          </h3>
          <p className="cal__hint">
            Jog tip to a stock corner → pick that corner →{" "}
            <strong>Set XY zero + stock</strong>. Optional edge/corner probe
            helpers below.
          </p>
          <div
            className="prep__corners"
            role="group"
            aria-label="Stock corner at tip"
          >
            {CORNERS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cal__btn cal__btn--ghost${(stock.originCorner ?? "sw") === c.id ? " is-active" : ""}`}
                title={c.title}
                disabled={!jogEnabled || busy}
                onClick={() => {
                  patchStock({ originCorner: c.id });
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!jogEnabled || busy}
              onClick={() =>
                onSetCornerFromToolhead(stock.originCorner ?? "sw")
              }
              title="G10 L20 P1 X0 Y0 and place stock corner at material origin"
            >
              Set XY zero + stock{" "}
              {(stock.originCorner ?? "sw").toUpperCase()} at tip
            </button>
            <button
              type="button"
              className="cal__btn cal__btn--ghost"
              disabled={!jogEnabled || busy}
              onClick={onZeroXy}
              title="G10 L20 P1 X0 Y0 only — does not move stock"
            >
              Zero XY only
            </button>
            {xyZeroed ? (
              <span className="cal__meta prep__ok">XY set — Next unlocked</span>
            ) : (
              <span className="cal__meta">XY not set — Next locked</span>
            )}
          </div>
          {onOpenStockPerimeter ? (
            <div className="cal__actions">
              <button
                type="button"
                className="cal__btn cal__btn--ghost"
                disabled={!canAct}
                onClick={onOpenStockPerimeter}
                title="Safe Z retract, then cancelable XY jogs around the stock blank"
              >
                Trace perimeter…
              </button>
              <span className="cal__meta">Optional check</span>
            </div>
          ) : null}
          <div className="prep__jog">
            <JogPanel
              enabled={jogEnabled && canAct}
              mode={jogMode}
              stepMm={stepMm}
              feedMmMin={feedMmMin}
              softLimitHint={softLimitHint}
              gamepadStatus={gamepadStatus}
              onModeChange={onJogModeChange}
              onStepChange={onStepChange}
              onFeedChange={onFeedChange}
              onJog={onJog}
              onJogEnd={onJogEnd}
            />
          </div>
          {xyProbe ? (
            <div className="prep__xyprobe" role="group" aria-label="XY probe">
              <p className="cal__meta">
                XY probe · Ø {xyProbe.bitDiameterMm.toFixed(2)} mm
                {xyProbe.blockedReason
                  ? ` — ${xyProbe.blockedReason}`
                  : ""}
              </p>
              <div className="cal__actions prep__xyprobe-actions">
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!xyProbe.enabled || !!xyProbe.busy}
                  onClick={() => xyProbe.onEdge("X", "negative")}
                >
                  −X
                </button>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!xyProbe.enabled || !!xyProbe.busy}
                  onClick={() => xyProbe.onEdge("X", "positive")}
                >
                  +X
                </button>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!xyProbe.enabled || !!xyProbe.busy}
                  onClick={() => xyProbe.onEdge("Y", "negative")}
                >
                  −Y
                </button>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!xyProbe.enabled || !!xyProbe.busy}
                  onClick={() => xyProbe.onEdge("Y", "positive")}
                >
                  +Y
                </button>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!xyProbe.enabled || !!xyProbe.busy}
                  onClick={() => xyProbe.onCorner("outside")}
                >
                  Corner out
                </button>
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!xyProbe.enabled || !!xyProbe.busy}
                  onClick={() => xyProbe.onCorner("inside")}
                >
                  Corner in
                </button>
                {xyProbe.onToolLength ? (
                  <button
                    type="button"
                    className="cal__btn cal__btn--ghost"
                    disabled={!xyProbe.enabled || !!xyProbe.busy}
                    onClick={xyProbe.onToolLength}
                    title="Re-zero Z on the plate after a bit change"
                  >
                    Tool Z
                  </button>
                ) : null}
              </div>
              {xyProbe.message ? (
                <p className="cal__meta" role="status">
                  {xyProbe.message}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {step.id === "probe" && (
        <div className="cal__body" role="group" aria-labelledby="prep-probe">
          <h3 id="prep-probe" className="cal__step-title">
            Z probe + clear plate
          </h3>
          <p className="cal__hint">
            Plate on <strong>stock top</strong> · check continuity · enter
            thickness · probe (or manual Zero Z) · retract · remove plate before
            Mark ready.
          </p>
          <div
            className={`prep__continuity${probeContinuityOk ? " is-ok" : ""}`}
            role="group"
            aria-labelledby="prep-continuity"
          >
            <p id="prep-continuity" className="prep__continuity-title">
              {PROBE_CONTINUITY_HINT}
            </p>
            <div className="prep__continuity-row">
              <span className="cal__meta">Probe light</span>
              <ProbePinLight active={!!status.pins?.probe} />
              {probeContinuityOk ? (
                <span className="cal__meta prep__ok">Continuity OK</span>
              ) : (
                <span className="cal__meta">Waiting for light…</span>
              )}
            </div>
            {onSimulateProbeTouch ? (
              <div className="cal__actions">
                <button
                  type="button"
                  className="cal__btn cal__btn--ghost"
                  disabled={!canAct || busy}
                  onClick={onSimulateProbeTouch}
                  title="Virtual CNC only — pulses Pn:P (never sent to USB)"
                >
                  Simulate clip touch (Virtual CNC)
                </button>
              </div>
            ) : null}
            {probeContinuityOk && status.pins?.probe ? (
              <p className="cal__meta" role="status">
                Separate the clip from the plate so the light goes off, then
                Run Z probe.
              </p>
            ) : null}
          </div>
          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Plate mm</span>
              <input
                className="cal__input"
                type="number"
                min={0}
                step={0.1}
                value={probe.plateThicknessMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchProbe({
                    plateThicknessMm: parseNonNeg(
                      e.target.value,
                      probe.plateThicknessMm,
                    ),
                  })
                }
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Seek mm</span>
              <input
                className="cal__input"
                type="number"
                min={1}
                step={1}
                value={probe.seekMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchProbe({
                    seekMm: parsePositive(e.target.value, probe.seekMm),
                  })
                }
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Feed</span>
              <input
                className="cal__input"
                type="number"
                min={10}
                step={10}
                value={probe.feedMmMin}
                disabled={!canAct}
                onChange={(e) =>
                  patchProbe({
                    feedMmMin: parsePositive(e.target.value, probe.feedMmMin),
                  })
                }
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Retract Z</span>
              <input
                className="cal__input"
                type="number"
                min={0}
                step={0.5}
                value={probe.retractWorkZMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchProbe({
                    retractWorkZMm: parseNonNeg(
                      e.target.value,
                      probe.retractWorkZMm,
                    ),
                  })
                }
              />
            </label>
          </div>
          <p className="cal__meta">{softMaxHint}</p>
          {!probeEnabled && probeBlockedReason ? (
            <p className="cal__warn" role="status">
              {probeBlockedReason}
            </p>
          ) : null}
          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!probeEnabled || busy}
              onClick={onRunProbe}
              title={
                probeContinuityOk
                  ? "Seek Z with G38.2 after continuity check"
                  : PROBE_CONTINUITY_HINT
              }
            >
              Run Z probe
            </button>
            <button
              type="button"
              className="cal__btn cal__btn--ghost"
              disabled={!jogEnabled || busy}
              onClick={onManualZZero}
              title="Paper feel fallback — G10 L20 Z0 at current tip"
            >
              Manual Zero Z
            </button>
            <button
              type="button"
              className="cal__btn cal__btn--ghost"
              disabled={retractDisabled}
              title={retractReason ?? undefined}
              onClick={onRetract}
            >
              Retract Z{probe.retractWorkZMm}
            </button>
            {zProbed ? (
              <span className="cal__meta prep__ok">Z set</span>
            ) : (
              <span className="cal__meta">Probe or manual Z required</span>
            )}
          </div>
          <p className="cal__meta">
            Feed {DEFAULT_JOG_FEED_MM_MIN} · steps {JOG_STEP_OPTIONS_MM.join("/")}{" "}
            · feeds {JOG_FEED_OPTIONS_MM_MIN.slice(0, 3).join("/")}…
          </p>
          <WizardStepConfirm
            id="prep-confirm-safez"
            checked={safeZConfirmed}
            disabled={!canAct || !zProbed}
            label="Plate removed · clamps clear · Z looks safe"
            onChange={(v) => setStepConfirmed(v, probeStep)}
          />
        </div>
      )}

      {step.id === "load" && (
        <div className="cal__body" role="group" aria-labelledby="prep-load">
          <h3 id="prep-load" className="cal__step-title">
            Load + place
          </h3>
          <p className="cal__hint">
            Load G-code or generate from SVG. Path placement shows on the
            visualizer. External folder/Drive stays behind one button.
          </p>
          {loadSlot}
          {jobLoaded ? (
            <p className="cal__meta prep__ok">Path loaded — Next unlocked</p>
          ) : (
            <p className="cal__meta">Load a path to continue</p>
          )}
        </div>
      )}

      {step.id === "ready" && (
        <div className="cal__body" role="group" aria-labelledby="prep-ready">
          <h3 id="prep-ready" className="cal__step-title">
            Ready for Verify
          </h3>
          <p className="cal__hint">
            Mark ready unlocks <strong>Verify</strong> (simulate + Start). Stay
            at the machine when you cut.
          </p>
          <ul className="prep__checklist">
            <li className={stockConfirmed ? "is-ok" : ""}>
              Stock + tool confirmed
            </li>
            <li className={xyZeroed ? "is-ok" : ""}>Material XY zero</li>
            <li className={zProbed ? "is-ok" : ""}>Z probed / zeroed</li>
            <li className={safeZConfirmed ? "is-ok" : ""}>
              Plate removed / clear
            </li>
            <li className={jobLoaded ? "is-ok" : ""}>Path loaded</li>
          </ul>
          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={markReadyDisabled}
              title={markReadyReason ?? undefined}
              onClick={() => {
                onConfirmReady();
                onClose?.();
              }}
            >
              {prepareReady ? "Continue to Verify" : "Mark ready → Verify"}
            </button>
          </div>
          {markReadyDisabled && markReadyReason ? (
            <p className="cal__warn" role="status">
              {markReadyReason}
            </p>
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
          <button
            type="button"
            className="cal__btn"
            disabled={markReadyDisabled}
            title={markReadyReason ?? undefined}
            onClick={() => {
              onConfirmReady();
              onClose?.();
            }}
          >
            {prepareReady ? "Continue to Verify" : "Mark ready → Verify"}
          </button>
        ) : (
          <button
            type="button"
            className="cal__btn"
            disabled={nextDisabled}
            onClick={goNext}
            title={
              nextDisabled
                ? "Confirm this step before continuing"
                : undefined
            }
          >
            {step.id === "stock"
              ? "Stock looks good — Next"
              : step.id === "xy"
                ? "XY set — Next"
                : step.id === "probe"
                  ? "Z clear — Next"
                  : "Loaded — Next"}
          </button>
        )}
      </footer>
    </section>
  );
}
