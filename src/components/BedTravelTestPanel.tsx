import { useMemo, useState } from "react";
import {
  BED_TRAVEL_APPROACH_FEED_MM_MIN,
  BED_TRAVEL_APPROACH_MM,
  BED_TRAVEL_CRUISE_FEED_MM_MIN,
  BED_TRAVEL_PROXIMITY_MM,
  canStartBedTravelTest,
  describeBedTravelProgress,
  planBedTravelTest,
  type BedTravelPlan,
} from "../grbl/bedTravelTest";
import type { GrblStatus, SoftTravelLimits } from "../grbl";
import { WizardStepConfirm } from "./wizardStepGate";

export type BedTravelRunPhase =
  | "idle"
  | "running"
  | "paused"
  | "aborted"
  | "done";

interface BedTravelTestPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  softTravel: SoftTravelLimits;
  softLimitsOn: boolean;
  status: GrblStatus;
  machinePos: { x: number; y: number; z: number };
  runPhase: BedTravelRunPhase;
  segmentIndex: number;
  plan: BedTravelPlan | null;
  message?: string | null;
  soundEnabled: boolean;
  onSoundEnabledChange: (enabled: boolean) => void;
  onStart: (plan: BedTravelPlan) => void;
  onStop: () => void;
  onAbort: () => void;
  onClose?: () => void;
}

function formatMm(value: number): string {
  return value.toFixed(3);
}

export function BedTravelTestPanel({
  enabled,
  blockedReason,
  softTravel,
  softLimitsOn,
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
}: BedTravelTestPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const gate = canStartBedTravelTest(softTravel, softLimitsOn);
  const busy = runPhase === "running" || runPhase === "paused";
  const preview = useMemo(() => {
    if (busy && plan) return plan;
    return planBedTravelTest({
      machine: machinePos,
      softTravel,
      softLimitsOn,
    });
  }, [busy, plan, machinePos, softTravel, softLimitsOn]);

  const activePlan = plan ?? preview;
  const progress = activePlan
    ? describeBedTravelProgress(segmentIndex, activePlan)
    : { current: "—", next: "—", percent: 0 };
  const currentSeg =
    plan && segmentIndex < plan.segments.length
      ? plan.segments[segmentIndex]
      : null;
  const canAct = enabled && !busy && gate.ok && !blockedReason;
  const canStart = canAct && confirmed && preview.ok;
  const startBlockedReason = !enabled
    ? (blockedReason ?? "Connect and clear alarms first")
    : busy
      ? "Already running — Stop or Abort first"
      : blockedReason
        ? blockedReason
        : !gate.ok
          ? (gate.reason ?? "Soft travel not ready")
          : preview.blocked
            ? preview.blocked
            : !confirmed
              ? "Confirm the safety checkbox first"
              : !preview.ok
                ? "Travel plan is not ready"
                : null;

  const start = () => {
    if (!canStart || !preview.ok) return;
    onStart(preview);
  };

  return (
    <section className="bedtravel" aria-label="Bed travel test">
      <p className="bedtravel__lead">
        After calibration, SharpCNC walks the full work bed from soft limits
        ($130–$132): safe Z retract, then every XY corner. Cruise in the open
        bed; slow approach near each edge. Motion uses cancelable GRBL jogs
        ($J=).
      </p>

      <div className="bedtravel__safety" role="note">
        <strong>Safety</strong>
        <ul>
          <li>Clear the bed — no stock, clamps, or tools in the travel envelope.</li>
          <li>Stand ready at Abort / E-Stop. Feed Hold and soft reset cancel motion.</li>
          <li>Soft limits must be on ($20=1) with measured max X/Y travel set.</li>
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

      <div className="bedtravel__meta" aria-label="Travel extents">
        <span>
          Soft limits: <strong>{softLimitsOn ? "ON" : "off"}</strong>
        </span>
        <span>
          Max X: <strong>{softTravel.maxX ?? "—"}</strong> mm
        </span>
        <span>
          Max Y: <strong>{softTravel.maxY ?? "—"}</strong> mm
        </span>
        <span>
          Max Z: <strong>{softTravel.maxZ ?? "—"}</strong> mm
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
            ? "Bed travel test complete."
            : runPhase === "aborted"
              ? "Aborted — motion canceled."
              : busy
                ? `${progress.current} · next: ${progress.next} · ${progress.percent}%`
                : preview.ok
                  ? `Ready · ${preview.segments.length} jog segments · corners ${preview.corners.filter((c, i, a) => a.indexOf(c) === i).join(" → ")}`
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
        Profile: cruise {BED_TRAVEL_CRUISE_FEED_MM_MIN} mm/min → approach{" "}
        {BED_TRAVEL_APPROACH_FEED_MM_MIN} mm/min within {BED_TRAVEL_APPROACH_MM}{" "}
        mm of each corner. Proximity tone within {BED_TRAVEL_PROXIMITY_MM} mm of
        an edge (pulse once per crossing).
      </p>

      <label className="bedtravel__check">
        <input
          type="checkbox"
          checked={soundEnabled}
          disabled={busy}
          onChange={(e) => onSoundEnabledChange(e.target.checked)}
        />
        <span>Proximity sound near edges (default on)</span>
      </label>

      <WizardStepConfirm
        id="bedtravel-confirm"
        checked={confirmed}
        disabled={!canAct}
        label="Bed clear, Abort ready — I confirm it is safe to start motion"
        onChange={setConfirmed}
      />

      {/* Confirm-only hint — gate/blocked reasons already render above as warns. */}
      {canAct && !confirmed ? (
        <p className="bedtravel__hint" role="status">
          Confirm the safety checkbox before Start.
        </p>
      ) : null}

      <div className="bedtravel__actions">
        <button
          type="button"
          className="bedtravel__btn bedtravel__btn--primary"
          disabled={!canStart}
          title={startBlockedReason ?? undefined}
          onClick={start}
        >
          Start bed travel
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
