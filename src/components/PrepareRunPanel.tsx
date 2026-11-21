import { useMemo, useState } from "react";
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
  const [stepIndex, setStepIndex] = useState(0);
  const [stockConfirmed, setStockConfirmed] = useState(false);
  const [toolConfirmed, setToolConfirmed] = useState(false);
  const [safeZConfirmed, setSafeZConfirmed] = useState(false);
  const step = WIZARD_STEPS[stepIndex]!;

  const canAct = enabled && !busy;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === WIZARD_STEPS.length - 1;

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
    setStockConfirmed(false);
  };

  const patchTool = (partial: Partial<ToolConfig>) => {
    onToolChange({ ...tool, ...partial });
    setToolConfirmed(false);
  };

  const patchProbe = (partial: Partial<ProbeConfig>) => {
    onProbeChange({ ...probe, ...partial });
  };

  const goNext = () => {
    if (!isLast) setStepIndex((i) => Math.min(i + 1, WIZARD_STEPS.length - 1));
  };

  const goBack = () => {
    if (!isFirst) setStepIndex((i) => Math.max(i - 1, 0));
  };

  const nextDisabled =
    (step.id === "stock" && !stockConfirmed) ||
    (step.id === "tool" && !toolConfirmed) ||
    (step.id === "xy" && !xyZeroed) ||
    (step.id === "probe" && !zProbed) ||
    (step.id === "safez" && !safeZConfirmed);

  const softMaxHint =
    softTravel.maxZ !== null
      ? `Soft max Z ${softTravel.maxZ} mm`
      : "Soft max Z not set — probe seek carefully";

  return (
    <section className="cal prep" aria-label="Prepare to run wizard">
      <nav className="cal__steps" aria-label="Prepare steps">
        {WIZARD_STEPS.map((s, i) => {
          const state =
            i === stepIndex ? "current" : i < stepIndex ? "done" : "upcoming";
          return (
            <button
              key={s.id}
              type="button"
              className={`cal__step cal__step--${state}`}
              aria-current={i === stepIndex ? "step" : undefined}
              onClick={() => setStepIndex(i)}
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
                      setStockConfirmed(false);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="cal__check">
            <input
              type="checkbox"
              checked={stockConfirmed}
              disabled={!canAct}
              onChange={(e) => setStockConfirmed(e.target.checked)}
            />
            <span>Stock is clamped and matches these numbers</span>
          </label>
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
          <label className="cal__check">
            <input
              type="checkbox"
              checked={toolConfirmed}
              disabled={!canAct}
              onChange={(e) => setToolConfirmed(e.target.checked)}
            />
            <span>Bit is tight and diameter matches</span>
          </label>
        </div>
      )}

      {step.id === "xy" && (
        <div className="cal__body" role="group" aria-labelledby="prep-xy">
          <h3 id="prep-xy" className="cal__step-title">
            Set work XY zero
          </h3>
          <p className="cal__hint">
            Jog so the bit is over your job origin (usually a stock corner). Keep
            Z clear of clamps. Then Zero XY — this does not move the machine.
          </p>
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
              <span className="cal__meta prep__ok">XY zero set</span>
            ) : (
              <span className="cal__meta">XY not confirmed yet</span>
            )}
          </div>
        </div>
      )}

      {step.id === "probe" && (
        <div className="cal__body" role="group" aria-labelledby="prep-probe">
          <h3 id="prep-probe" className="cal__step-title">
            Z probe (touch plate)
          </h3>
          <p className="cal__hint">
            Clip the probe lead to the bit. Place the plate on the stock top
            under the bit. SharpCNC runs{" "}
            <code>G38.2</code> down, then sets work Z0 at the stock face
            (accounting for plate thickness). E-Stop still works.
          </p>
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
            {softMaxHint}. Refuse probe in Alarm / while busy. If the probe pin
            is already ON, clear contact first (Alarm 5).
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
              <span className="cal__meta prep__ok">Z zero set</span>
            ) : (
              <span className="cal__meta">Z not confirmed yet</span>
            )}
          </div>
        </div>
      )}

      {step.id === "safez" && (
        <div className="cal__body" role="group" aria-labelledby="prep-safez">
          <h3 id="prep-safez" className="cal__step-title">
            Safe Z / retract
          </h3>
          <p className="cal__hint">
            Raise clear of the plate and clamps before Start. Optional retract
            jogs to the work Z you choose (default {probe.retractWorkZMm} mm
            above stock top).
          </p>
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
          <label className="cal__check">
            <input
              type="checkbox"
              checked={safeZConfirmed}
              disabled={!canAct}
              onChange={(e) => setSafeZConfirmed(e.target.checked)}
            />
            <span>Plate removed · clamps clear · Z looks safe</span>
          </label>
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
