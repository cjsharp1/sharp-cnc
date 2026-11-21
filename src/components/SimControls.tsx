import type { SimPhase } from "../grbl";

interface SimControlsProps {
  /** Compact overlay on the visualizer vs full Job-tab strip. */
  variant?: "overlay" | "panel";
  phase: SimPhase;
  /** 0..1 when a sim has been started. */
  progress: number;
  disabled?: boolean;
  disabledReason?: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

function phaseLabel(phase: SimPhase): string {
  switch (phase) {
    case "playing":
      return "Preview playing";
    case "paused":
      return "Preview paused";
    case "done":
      return "Preview done";
    default:
      return "Preview";
  }
}

export function SimControls({
  variant = "panel",
  phase,
  progress,
  disabled = false,
  disabledReason = null,
  onPlay,
  onPause,
  onStop,
}: SimControlsProps) {
  const active = phase === "playing" || phase === "paused" || phase === "done";
  const showPause = phase === "playing";
  const showPlay = phase === "idle" || phase === "paused" || phase === "done";
  const showStop = phase === "playing" || phase === "paused" || phase === "done";
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <section
      className={`sim sim--${variant}${active ? " is-active" : ""}`}
      aria-label="Pre-run path simulation"
    >
      <div className="sim__meta">
        <p className="sim__title">Simulate</p>
        <p className="sim__hint">
          Visualizer preview only — does not move the CNC
        </p>
      </div>

      <div className="sim__status" aria-live="polite">
        <span className={`sim__phase is-${phase}`}>{phaseLabel(phase)}</span>
        {active && <span className="sim__pct">{percent}%</span>}
      </div>

      {active && (
        <div
          className="sim__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="sim__bar-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      {disabled && disabledReason && (
        <p className="sim__warn">{disabledReason}</p>
      )}

      <div className="sim__actions">
        {showPlay && (
          <button
            type="button"
            className="sim__btn"
            disabled={disabled}
            title={disabledReason ?? "Play path preview"}
            onClick={onPlay}
          >
            {phase === "paused" ? "Resume" : phase === "done" ? "Replay" : "Play"}
          </button>
        )}
        {showPause && (
          <button
            type="button"
            className="sim__btn sim__btn--hold"
            onClick={onPause}
          >
            Pause
          </button>
        )}
        {showStop && (
          <button
            type="button"
            className="sim__btn sim__btn--ghost"
            onClick={onStop}
          >
            Stop
          </button>
        )}
      </div>
    </section>
  );
}
