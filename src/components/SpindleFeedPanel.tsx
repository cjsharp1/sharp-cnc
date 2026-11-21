import { useState } from "react";
import {
  DEFAULT_SPINDLE_RPM,
  MAX_SPINDLE_RPM,
  type OverrideStep,
} from "../grbl";

interface SpindleFeedPanelProps {
  connected: boolean;
  /** Reported feed mm/min from status (optional). */
  feedRate?: number;
  /** Reported spindle RPM from status (optional). */
  spindleSpeed?: number;
  feedOverridePercent: number;
  spindleOverridePercent: number;
  busyAlarm: boolean;
  onSpindleOn: (rpm: number) => void;
  onSpindleOff: () => void;
  onFeedOverride: (step: OverrideStep) => void;
  onSpindleOverride: (step: OverrideStep) => void;
}

const OVERRIDE_STEPS: { step: OverrideStep; label: string; title: string }[] = [
  { step: "coarse-", label: "−10", title: "Decrease 10%" },
  { step: "fine-", label: "−1", title: "Decrease 1%" },
  { step: "reset", label: "100%", title: "Reset to 100%" },
  { step: "fine+", label: "+1", title: "Increase 1%" },
  { step: "coarse+", label: "+10", title: "Increase 10%" },
];

export function SpindleFeedPanel({
  connected,
  feedRate,
  spindleSpeed,
  feedOverridePercent,
  spindleOverridePercent,
  busyAlarm,
  onSpindleOn,
  onSpindleOff,
  onFeedOverride,
  onSpindleOverride,
}: SpindleFeedPanelProps) {
  const [rpmDraft, setRpmDraft] = useState(String(DEFAULT_SPINDLE_RPM));
  const enabled = connected && !busyAlarm;

  const parseRpm = (): number | null => {
    const n = Number(rpmDraft);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SPINDLE_RPM) return null;
    return Math.round(n);
  };

  return (
    <section className="spindle" aria-label="Spindle and feed overrides">
      <div className="spindle__meta">
        <h2 className="spindle__title">Spindle &amp; feed</h2>
        <p className="spindle__hint">
          PWM spindle (M3/M5 · S) · GRBL realtime overrides during a run
        </p>
      </div>

      <div className="spindle__block">
        <p className="spindle__section">Spindle RPM</p>
        <div className="spindle__row">
          <label className="spindle__field">
            <span className="spindle__field-label">Set RPM</span>
            <input
              className="spindle__input"
              type="number"
              min={0}
              max={MAX_SPINDLE_RPM}
              step={100}
              value={rpmDraft}
              disabled={!enabled}
              onChange={(e) => setRpmDraft(e.target.value)}
            />
          </label>
          <div className="spindle__actions">
            <button
              type="button"
              className="spindle__btn"
              disabled={!enabled}
              onClick={() => {
                const rpm = parseRpm();
                if (rpm === null) return;
                onSpindleOn(rpm);
              }}
            >
              On (M3)
            </button>
            <button
              type="button"
              className="spindle__btn spindle__btn--ghost"
              disabled={!enabled}
              onClick={onSpindleOff}
            >
              Off (M5)
            </button>
          </div>
        </div>
        <p className="spindle__live">
          Live S{" "}
          {typeof spindleSpeed === "number" ? Math.round(spindleSpeed) : "—"}
          {typeof feedRate === "number"
            ? ` · F ${Math.round(feedRate)}`
            : ""}
        </p>
      </div>

      <div className="spindle__block">
        <div className="spindle__override-head">
          <p className="spindle__section">Feed override</p>
          <span className="spindle__pct" aria-live="polite">
            {feedOverridePercent}%
          </span>
        </div>
        <div className="spindle__override" role="group" aria-label="Feed override">
          {OVERRIDE_STEPS.map(({ step, label, title }) => (
            <button
              key={`feed-${step}`}
              type="button"
              className={`spindle__ov${step === "reset" ? " is-reset" : ""}`}
              title={title}
              disabled={!enabled}
              onClick={() => onFeedOverride(step)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="spindle__block">
        <div className="spindle__override-head">
          <p className="spindle__section">Spindle override</p>
          <span className="spindle__pct" aria-live="polite">
            {spindleOverridePercent}%
          </span>
        </div>
        <div
          className="spindle__override"
          role="group"
          aria-label="Spindle override"
        >
          {OVERRIDE_STEPS.map(({ step, label, title }) => (
            <button
              key={`spindle-${step}`}
              type="button"
              className={`spindle__ov${step === "reset" ? " is-reset" : ""}`}
              title={title}
              disabled={!enabled}
              onClick={() => onSpindleOverride(step)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="spindle__note">
          Overrides are realtime GRBL bytes (not G-code). Soft limits unchanged.
          Percent is tracked in-app; confirm with the machine sound / status.
        </p>
      </div>
    </section>
  );
}
