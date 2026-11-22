import { useMemo, useState } from "react";
import {
  STOCK_PERIMETER_APPROACH_FEED_MM_MIN,
  STOCK_PERIMETER_APPROACH_MM,
  STOCK_PERIMETER_CRUISE_FEED_MM_MIN,
  STOCK_PERIMETER_PROXIMITY_MM,
  canStartStockPerimeterTest,
  describeStockPerimeterProgress,
  planStockPerimeterTest,
  type StockPerimeterPlan,
} from "../grbl/stockPerimeterTest";
import type { GrblStatus, SoftTravelLimits, StockConfig } from "../grbl";
import { WizardStepConfirm } from "./wizardStepGate";

export type StockPerimeterRunPhase =
  | "idle"
  | "running"
  | "paused"
  | "aborted"
  | "done";

interface StockPerimeterTestPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  softTravel: SoftTravelLimits;
  softLimitsOn: boolean;
  stock: StockConfig;
  wco: { x: number; y: number; z: number };
  status: GrblStatus;
  machinePos: { x: number; y: number; z: number };
  runPhase: StockPerimeterRunPhase;
  segmentIndex: number;
  plan: StockPerimeterPlan | null;
  message?: string | null;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onStart: (plan: StockPerimeterPlan) => void;
  onStop: () => void;
  onAbort: () => void;
  onClose?: () => void;
}

function formatMm(value: number): string {
  return value.toFixed(3);
}

export function StockPerimeterTestPanel({
  enabled,
  blockedReason,
  softTravel,
  softLimitsOn,
  stock,
  wco,
  status,
  machinePos,
  runPhase,
  segmentIndex,
  plan,
  message,
  soundEnabled,
  onSoundEnabledChange,
  onStart,
  onStop,
  onAbort,
  onClose,
}: StockPerimeterTestPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const gate = canStartStockPerimeterTest(
    softTravel,
    softLimitsOn,
    stock,
    wco,
  );
  const busy = runPhase === "running" || runPhase === "paused";
  const preview = useMemo(() => {
    if (busy && plan) return plan;
    return planStockPerimeterTest({
      machine: machinePos,
      softTravel,
      softLimitsOn,
      stock,
      wco,
    });
  }, [busy, plan, machinePos, softTravel, softLimitsOn, stock, wco]);

  const activePlan = plan ?? preview;
  const progress = activePlan
    ? describeStockPerimeterProgress(segmentIndex, activePlan)
    : { current: "—", next: "—", percent: 0 };
  const currentSeg =
    plan && segmentIndex < plan.segments.length
      ? plan.segments[segmentIndex]
      : null;
  const canAct = enabled && !busy && gate.ok && !blockedReason;
  const canStart = canAct && confirmed && preview.ok;
  const uniqueCorners = preview.ok
    ? preview.corners.filter((c, i, a) => a.indexOf(c) === i)
    : [];

  const start = () => {
    if (!canStart || !preview.ok) return;
    onStart(preview);
  };

  return (
    <section className="bedtravel" aria-label="Trace stock perimeter">
      <p className="bedtravel__lead">
        After stock origin and size are set, SharpCNC can jog the toolhead
        around the blank rectangle so you can see the machine knows the
        boundaries. Safe Z retract first, then cancelable XY jogs ($J=) at
        the four corners — no cutting.
      </p>

      <div className="bedtravel__safety" role="note">
        <strong>Safety</strong>
        <ul>
          <li>
            Clear clamps and tools from the perimeter path. Touch plate
            removed. Spindle off recommended.
          </li>
          <li>
            XY only at safe Z — does not plunge or spin. Stand ready at Abort
            / E-Stop.
          </li>
          <li>
            Soft limits must be on ($20=1). Stock corners must fit inside max
            X/Y travel.
          </li>
        </ul>
      </div>

      {!gate.ok ? (
        <p className="bedtravel__warn" role="alert">
          {gate.reason}
        </p>
      ) : null}
      {blockedReason ? (
        <p className="bedtravel__warn" role="alert">
          {blockedReason}
        </p>
      ) : null}
      {preview.ok && preview.warnings.length > 0 ? (
        <p className="bedtravel__hint" role="status">
          {preview.warnings.join(" ")}
        </p>
      ) : null}
      {preview.blocked && gate.ok ? (
        <p className="bedtravel__warn" role="alert">
          {preview.blocked}
        </p>
      ) : null}

      <div className="bedtravel__meta" aria-label="Stock blank">
        <span>
          Stock:{" "}
          <strong>
            {stock.widthMm} × {stock.lengthMm}
          </strong>{" "}
          mm
        </span>
        <span>
          Origin:{" "}
          <strong>{(stock.originCorner ?? "—").toString().toUpperCase()}</strong>
        </span>
        <span>
          Offset:{" "}
          <strong>
            {stock.offsetXMm}, {stock.offsetYMm}
          </strong>{" "}
          mm
        </span>
        <span>
          Soft limits: <strong>{softLimitsOn ? "ON" : "off"}</strong>
        </span>
      </div>

      <div className="bedtravel__pos" aria-live="polite">
        <div className="bedtravel__pos-row">
          <span className="bedtravel__pos-axis">X</span>
          <span className="bedtravel__pos-val">{formatMm(machinePos.x)}</span>
          <span className="bedtravel__pos-axis">Y</span>
          <span className="bedtravel__pos-val">{formatMm(machinePos.y)}</span>
          <span className="bedtravel__pos-axis">Z</span>
          <span className="bedtravel__pos-val">{formatMm(machinePos.z)}</span>
          <span className="bedtravel__pos-state">
            State <strong>{status.state}</strong>
          </span>
        </div>
      </div>

      <div className="bedtravel__progress" aria-live="polite">
        <div className="bedtravel__progress-bar" aria-hidden="true">
          <div
            className="bedtravel__progress-fill"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="bedtravel__progress-text">
          {runPhase === "done"
            ? "Stock perimeter complete — all corners visited."
            : runPhase === "aborted"
              ? "Aborted — motion canceled."
              : busy
                ? `${progress.current} · next: ${progress.next} · ${progress.percent}%`
                : preview.ok
                  ? `Ready · ${preview.segments.length} jog segments · corners ${uniqueCorners.join(" → ")}`
                  : "Not ready"}
        </p>
        {currentSeg ? (
          <p className="bedtravel__seg">
            Segment: {currentSeg.label} · {currentSeg.phase} @{" "}
            {currentSeg.feedMmMin} mm/min
            {currentSeg.corner ? ` · corner ${currentSeg.corner}` : ""}
          </p>
        ) : null}
      </div>

      <p className="bedtravel__hint">
        Profile: cruise {STOCK_PERIMETER_CRUISE_FEED_MM_MIN} mm/min → approach{" "}
        {STOCK_PERIMETER_APPROACH_FEED_MM_MIN} mm/min within about{" "}
        {STOCK_PERIMETER_APPROACH_MM} mm of each corner (scaled down on small
        blanks). Proximity tone within {STOCK_PERIMETER_PROXIMITY_MM} mm of a
        soft edge (pulse once per crossing).
      </p>

      <label className="bedtravel__check">
        <input
          type="checkbox"
          checked={soundEnabled}
          disabled={busy}
          onChange={(e) => onSoundEnabledChange(e.target.checked)}
        />
        <span>Proximity sound near soft edges (default on)</span>
      </label>

      <WizardStepConfirm
        id="stock-perimeter-confirm"
        checked={confirmed}
        disabled={!canAct}
        label="Path clear, plate removed, spindle off — I confirm it is safe to start XY motion at safe Z"
        onChange={setConfirmed}
      />

      <div className="bedtravel__actions">
        <button
          type="button"
          className="bedtravel__btn bedtravel__btn--primary"
          disabled={!canStart}
          onClick={start}
        >
          Trace stock perimeter
        </button>
        <button
          type="button"
          className="bedtravel__btn"
          disabled={runPhase !== "running"}
          onClick={onStop}
          title="Cancel jog (0x85) — Feed Hold path"
        >
          Stop
        </button>
        <button
          type="button"
          className="bedtravel__btn bedtravel__btn--danger"
          disabled={!busy}
          onClick={onAbort}
          title="Abort: cancel jog + soft reset path"
        >
          Abort
        </button>
        {onClose ? (
          <button
            type="button"
            className="bedtravel__btn bedtravel__btn--ghost"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="bedtravel__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
