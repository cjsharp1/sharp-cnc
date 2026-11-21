import type { OverrideStep, RapidOverrideStep } from "../grbl";

interface OverridesStripProps {
  visible: boolean;
  feedPercent: number;
  rapidPercent: number;
  spindlePercent: number;
  feedRate?: number;
  spindleSpeed?: number;
  connected: boolean;
  onFeedOverride: (step: OverrideStep) => void;
  onSpindleOverride: (step: OverrideStep) => void;
  onRapidOverride: (step: RapidOverrideStep) => void;
}

export function OverridesStrip({
  visible,
  feedPercent,
  rapidPercent,
  spindlePercent,
  feedRate,
  spindleSpeed,
  connected,
  onFeedOverride,
  onSpindleOverride,
  onRapidOverride,
}: OverridesStripProps) {
  if (!visible) return null;

  return (
    <section
      className="overrides-strip"
      aria-label="Live feed rapid spindle overrides"
    >
      <div className="overrides-strip__group">
        <span className="overrides-strip__label">Feed</span>
        <strong className="overrides-strip__pct">{feedPercent}%</strong>
        {feedRate != null ? (
          <span className="overrides-strip__live">{Math.round(feedRate)} mm/min</span>
        ) : null}
        <div className="overrides-strip__btns" role="group" aria-label="Feed override">
          <button type="button" disabled={!connected} onClick={() => onFeedOverride("coarse-")}>
            −10
          </button>
          <button type="button" disabled={!connected} onClick={() => onFeedOverride("reset")}>
            100%
          </button>
          <button type="button" disabled={!connected} onClick={() => onFeedOverride("coarse+")}>
            +10
          </button>
        </div>
      </div>

      <div className="overrides-strip__group">
        <span className="overrides-strip__label">Rapid</span>
        <strong className="overrides-strip__pct">{rapidPercent}%</strong>
        <div className="overrides-strip__btns" role="group" aria-label="Rapid override">
          <button type="button" disabled={!connected} onClick={() => onRapidOverride("25")}>
            25%
          </button>
          <button type="button" disabled={!connected} onClick={() => onRapidOverride("50")}>
            50%
          </button>
          <button type="button" disabled={!connected} onClick={() => onRapidOverride("100")}>
            100%
          </button>
        </div>
      </div>

      <div className="overrides-strip__group">
        <span className="overrides-strip__label">Spindle</span>
        <strong className="overrides-strip__pct">{spindlePercent}%</strong>
        {spindleSpeed != null ? (
          <span className="overrides-strip__live">{Math.round(spindleSpeed)} RPM</span>
        ) : null}
        <div className="overrides-strip__btns" role="group" aria-label="Spindle override">
          <button
            type="button"
            disabled={!connected}
            onClick={() => onSpindleOverride("coarse-")}
          >
            −10
          </button>
          <button
            type="button"
            disabled={!connected}
            onClick={() => onSpindleOverride("reset")}
          >
            100%
          </button>
          <button
            type="button"
            disabled={!connected}
            onClick={() => onSpindleOverride("coarse+")}
          >
            +10
          </button>
        </div>
      </div>
    </section>
  );
}
