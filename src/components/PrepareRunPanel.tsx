import { useEffect, useMemo } from "react";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_FEED_OPTIONS_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  TOOL_BIT_LABELS,
  stockOffsetForCorner,
  type GrblStatus,
  type JogMode,
  type ProbeConfig,
  type SoftTravelLimits,
  type StockConfig,
  type StockCorner,
  type ToolBitType,
  type ToolConfig,
} from "../grbl";
import { JogPanel, type JogAxisMap } from "./JogPanel";
import { useWizardStepGate, WizardStepConfirm } from "./wizardStepGate";

export type PrepareStepId =
  | "stock"
  | "tool"
  | "xy"
  | "probe"
  | "safez"
  | "ready";

const WIZARD_STEPS: {
  id: PrepareStepId;
  label: string;
  short: string;
}[] = [
  { id: "stock", label: "Stock", short: "1 · Stock" },
  { id: "tool", label: "Tool", short: "2 · Tool" },
  { id: "xy", label: "XY zero", short: "3 · XY" },
  { id: "probe", label: "Z probe", short: "4 · Probe" },
  { id: "safez", label: "Safe Z", short: "5 · Safe Z" },
  { id: "ready", label: "Ready", short: "6 · Ready" },
];

const CORNERS: { id: StockCorner; label: string; title: string }[] = [
  { id: "sw", label: "SW", title: "Front-left (min X/Y)" },
  { id: "se", label: "SE", title: "Front-right" },
  { id: "nw", label: "NW", title: "Back-left" },
  { id: "ne", label: "NE", title: "Back-right" },
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
  busy?: boolean;
  message?: string | null;
  /** True after a successful probe (or manual Z zero) this session. */
  zProbed: boolean;
  xyZeroed: boolean;
  jogMode: JogMode;
  stepMm: number;
  feedMmMin: number;
  softLimitHint?: string | null;
  onStockChange: (next: StockConfig) => void;
  onToolChange: (next: ToolConfig) => void;
  onPlaceCorner: (corner: StockCorner) => void;
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
  onClose?: () => void;
}

function formatMm(value: number): string {
  return value.toFixed(3);
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
  busy = false,
  message,
  zProbed,
  xyZeroed,
  jogMode,
  stepMm,
  feedMmMin,
  softLimitHint,
  onStockChange,
  onToolChange,
  onPlaceCorner,
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
  const toolStep = WIZARD_STEPS.findIndex((s) => s.id === "tool");
  const xyStep = WIZARD_STEPS.findIndex((s) => s.id === "xy");
  const probeStep = WIZARD_STEPS.findIndex((s) => s.id === "probe");
  const safeZStep = WIZARD_STEPS.findIndex((s) => s.id === "safez");

  const stockConfirmed = confirmed[stockStep] === true;
  const toolConfirmed = confirmed[toolStep] === true;
  const safeZConfirmed = confirmed[safeZStep] === true;

  const canAct = enabled && !busy;

  /** XY zero / Z probe are system-verifiable actions — auto-confirm those steps. */
  useEffect(() => {
    setStepConfirmed(xyZeroed, xyStep);
  }, [xyZeroed, xyStep, setStepConfirmed]);

  useEffect(() => {
    setStepConfirmed(zProbed, probeStep);
  }, [zProbed, probeStep, setStepConfirmed]);

  const activeCorner = useMemo(() => {
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

  const patchStock = (partial: Partial<StockConfig>) => {
    onStockChange({ ...stock, ...partial });
    setStepConfirmed(false, stockStep);
  };

  const patchTool = (partial: Partial<ToolConfig>) => {
    onToolChange({ ...tool, ...partial });
    setStepConfirmed(false, toolStep);
  };

  const patchProbe = (partial: Partial<ProbeConfig>) => {
    onProbeChange({ ...probe, ...partial });
    if (step.id === "safez") setStepConfirmed(false, safeZStep);
  };

  const nextDisabled = !isConfirmed;

  const softMaxHint =
    softTravel.maxZ !== null
      ? `Soft max Z ${softTravel.maxZ} mm`
      : "Soft max Z not set — probe seek carefully";

  return (
    <section className="cal prep" aria-label="Prepare to run wizard">
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

      <div className="cal__pos" aria-label="Current position">
        <div className="cal__pos-legend" aria-hidden>
          <span />
          <span>Work</span>
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
          {status.pins?.probe ? (
            <span className="prep__pin"> · Probe pin ON</span>
          ) : null}
        </p>
      </div>

      {step.id === "stock" && (
        <div className="cal__body" role="group" aria-labelledby="prep-stock">
          <h3 id="prep-stock" className="cal__step-title">
            Confirm stock on bed
          </h3>
          <p className="cal__hint">
            Match the physical workpiece: size, thickness, and where it sits on
            the bed. This updates the visualizer (same as Material &amp; tool).
          </p>
          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Width X mm</span>
              <input
                className="cal__input"
                type="number"
                min={0.1}
                step={1}
                value={stock.widthMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchStock({
                    widthMm: parsePositive(e.target.value, stock.widthMm),
                  })
                }
              />
            </label>
            <label className="cal__field">
              <span className="cal__field-label">Length Y mm</span>
              <input
                className="cal__input"
                type="number"
                min={0.1}
                step={1}
                value={stock.lengthMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchStock({
                    lengthMm: parsePositive(e.target.value, stock.lengthMm),
                  })
                }
              />
            </label>
          </div>
          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Thickness mm</span>
              <input
                className="cal__input"
                type="number"
                min={0.1}
                step={0.5}
                value={stock.thicknessMm}
                disabled={!canAct}
                onChange={(e) =>
                  patchStock({
                    thicknessMm: parsePositive(
                      e.target.value,
                      stock.thicknessMm,
                    ),
                  })
                }
              />
            </label>
            <div className="cal__field">
              <span className="cal__field-label">Corner on bed</span>
              <div className="prep__corners">
                {CORNERS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cal__btn cal__btn--ghost${activeCorner === c.id ? " is-active" : ""}`}
                    title={c.title}
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
          </div>
          <WizardStepConfirm
            id="prep-confirm-stock"
            checked={stockConfirmed}
            disabled={!canAct}
            label="Stock is clamped and matches these numbers"
            onChange={(v) => setStepConfirmed(v, stockStep)}
          />
        </div>
      )}

      {step.id === "tool" && (
        <div className="cal__body" role="group" aria-labelledby="prep-tool">
          <h3 id="prep-tool" className="cal__step-title">
            Confirm tool / bit
          </h3>
          <p className="cal__hint">
            Install the bit you will cut with. Diameter drives the tool marker
            and SVG defaults — it does not change G-code depths by itself.
          </p>
          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Type</span>
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
              <span className="cal__field-label">Diameter Ø mm</span>
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
          {tool.type === "vbit" && (
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
          )}
          <WizardStepConfirm
            id="prep-confirm-tool"
            checked={toolConfirmed}
            disabled={!canAct}
            label="Bit is tight and diameter matches"
            onChange={(v) => setStepConfirmed(v, toolStep)}
          />
        </div>
      )}

      {step.id === "xy" && (
        <div className="cal__body" role="group" aria-labelledby="prep-xy">
          <h3 id="prep-xy" className="cal__step-title">
            Set work XY zero
          </h3>
          <ul className="prep__callouts" aria-label="XY zero steps">
            <li>
              <span className="prep__callout-label">No plate</span>
              Jog tip to job origin on stock → <strong>Zero XY</strong>. Does
              not move the machine. Keep Z clear of clamps.
            </li>
            <li>
              <span className="prep__callout-label">Not homing</span>
              Homing (<code>$H</code>) uses limit switches — the touch plate
              is not for XY or home.
            </li>
          </ul>
          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!jogEnabled || busy}
              onClick={onZeroXy}
              title="G10 L20 P1 X0 Y0"
            >
              Zero XY
            </button>
            {xyZeroed ? (
              <span className="cal__meta prep__ok">
                XY zero set — Next unlocked
              </span>
            ) : (
              <span className="cal__meta">
                XY not set yet — Next stays locked
              </span>
            )}
          </div>
          <div className="prep__jog">
            <JogPanel
              enabled={jogEnabled && canAct}
              mode={jogMode}
              stepMm={stepMm}
              feedMmMin={feedMmMin}
              softLimitHint={softLimitHint}
              onModeChange={onJogModeChange}
              onStepChange={onStepChange}
              onFeedChange={onFeedChange}
              onJog={onJog}
              onJogEnd={onJogEnd}
            />
          </div>
        </div>
      )}

      {step.id === "probe" && (
        <div className="cal__body" role="group" aria-labelledby="prep-probe">
          <h3 id="prep-probe" className="cal__step-title">
            Z probe (touch plate)
          </h3>
          <ul className="prep__callouts" aria-label="Z probe steps">
            <li>
              <span className="prep__callout-label">Setup</span>
              Clip on the bit · put the conductive plate on the{" "}
              <strong>stock top</strong> under the tip — not the bare bed.
            </li>
            <li>
              <span className="prep__callout-label">Thickness</span>
              Enter plate thickness (~15–20&nbsp;mm for Chris’s plate). App
              offsets so the stock face = work Z0.
            </li>
            <li>
              <span className="prep__callout-label">Why stock</span>
              Plate on the bed would zero the bed, not the stock top — wrong
              for top-of-stock cuts.
            </li>
            <li>
              <span className="prep__callout-label">Fallback</span>
              <strong>Manual Zero Z</strong> = paper-feel at the tip if the
              plate is unavailable.
            </li>
          </ul>
          <div className="cal__row">
            <label className="cal__field">
              <span className="cal__field-label">Plate thickness mm</span>
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
              <span className="cal__field-label">Seek mm (down)</span>
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
              <span className="cal__field-label">Probe feed mm/min</span>
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
          </div>
          <p className="cal__hint">
            Runs <code>G38.2</code> down · {softMaxHint}. Refuse probe in Alarm
            / while busy. Probe pin already ON → clear contact first (Alarm 5).
            E-Stop still works.
          </p>
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
            {zProbed ? (
              <span className="cal__meta prep__ok">
                Z zero set — Next unlocked
              </span>
            ) : (
              <span className="cal__meta">
                Probe or manual Z zero required — Next stays locked
              </span>
            )}
          </div>
        </div>
      )}

      {step.id === "safez" && (
        <div className="cal__body" role="group" aria-labelledby="prep-safez">
          <h3 id="prep-safez" className="cal__step-title">
            Safe Z / remove plate
          </h3>
          <ul className="prep__callouts" aria-label="Safe Z steps">
            <li>
              <span className="prep__callout-label">Remove plate</span>
              Take the plate and clip off <strong>before cutting</strong> —
              leaving them on the stock is unsafe.
            </li>
            <li>
              <span className="prep__callout-label">Retract</span>
              Optional jog to work Z {probe.retractWorkZMm} mm (above stock
              top). Clear clamps from the path.
            </li>
          </ul>
          <label className="cal__field">
            <span className="cal__field-label">Retract work Z mm</span>
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
          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={!jogEnabled || busy || !zProbed}
              onClick={onRetract}
            >
              Retract to Z{probe.retractWorkZMm}
            </button>
            <span className="cal__meta">
              Feed {DEFAULT_JOG_FEED_MM_MIN} mm/min · steps{" "}
              {JOG_STEP_OPTIONS_MM.join("/")} · feeds{" "}
              {JOG_FEED_OPTIONS_MM_MIN.slice(0, 3).join("/")}…
            </span>
          </div>
          <WizardStepConfirm
            id="prep-confirm-safez"
            checked={safeZConfirmed}
            disabled={!canAct}
            label="Plate removed · clamps clear · Z looks safe"
            onChange={(v) => setStepConfirmed(v, safeZStep)}
          />
        </div>
      )}

      {step.id === "ready" && (
        <div className="cal__body" role="group" aria-labelledby="prep-ready">
          <h3 id="prep-ready" className="cal__step-title">
            Ready to Start
          </h3>
          <p className="cal__hint">
            Confirming marks work zero as ready for this session so{" "}
            <strong>Start</strong> unlocks. Simulate the path first if you have
            not already. Stay at the machine while cutting.
          </p>
          <ul className="prep__checklist">
            <li className={stockConfirmed ? "is-ok" : ""}>
              Stock confirmed
            </li>
            <li className={toolConfirmed ? "is-ok" : ""}>Tool confirmed</li>
            <li className={xyZeroed ? "is-ok" : ""}>XY work zero</li>
            <li className={zProbed ? "is-ok" : ""}>Z probed / zeroed</li>
            <li className={safeZConfirmed ? "is-ok" : ""}>Safe Z / clear</li>
          </ul>
          <div className="cal__actions">
            <button
              type="button"
              className="cal__btn"
              disabled={
                !stockConfirmed ||
                !toolConfirmed ||
                !xyZeroed ||
                !zProbed ||
                !safeZConfirmed ||
                busy
              }
              onClick={() => {
                onConfirmReady();
                onClose?.();
              }}
            >
              Mark ready &amp; close
            </button>
          </div>
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
            className="cal__btn cal__btn--ghost"
            onClick={onClose}
            disabled={!onClose}
          >
            Close
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
              : step.id === "tool"
                ? "Tool looks good — Next"
                : step.id === "xy"
                  ? "XY set — Next"
                  : step.id === "probe"
                    ? "Z set — Next"
                    : "Safe — Next"}
          </button>
        )}
      </footer>
    </section>
  );
}
