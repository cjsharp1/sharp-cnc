import {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_FEED_OPTIONS_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  type Axis,
  type JogMode,
} from "../grbl";

export type JogAxisMap = Partial<Record<Axis, 1 | -1>>;

interface JogPanelProps {
  enabled: boolean;
  mode: JogMode;
  stepMm: number;
  feedMmMin: number;
  softLimitHint?: string | null;
  onModeChange: (mode: JogMode) => void;
  onStepChange: (stepMm: number) => void;
  onFeedChange: (feedMmMin: number) => void;
  /** Incremental click or continuous press start. */
  onJog: (axes: JogAxisMap) => void;
  /** Continuous mode: release / cancel. */
  onJogEnd: () => void;
}

function JogButton({
  label,
  ariaLabel,
  disabled,
  mode,
  onJog,
  onJogEnd,
  axes,
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  mode: JogMode;
  onJog: (axes: JogAxisMap) => void;
  onJogEnd: () => void;
  axes: JogAxisMap;
}) {
  const start = () => {
    if (disabled) return;
    onJog(axes);
  };
  const end = () => {
    if (mode === "continuous") onJogEnd();
  };

  return (
    <button
      type="button"
      className="jog__btn"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={mode === "incremental" ? start : undefined}
      onPointerDown={(e) => {
        if (mode !== "continuous" || disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={(e) => {
        if (mode === "continuous" && e.buttons === 0) end();
      }}
    >
      {label}
    </button>
  );
}

export function JogPanel({
  enabled,
  mode,
  stepMm,
  feedMmMin,
  softLimitHint,
  onModeChange,
  onStepChange,
  onFeedChange,
  onJog,
  onJogEnd,
}: JogPanelProps) {
  return (
    <section className="jog" aria-label="Jog controls">
      <header className="jog__head">
        <h2 className="jog__title">Jog</h2>
        <div className="jog__modes" role="group" aria-label="Jog mode">
          <button
            type="button"
            className={`jog__mode ${mode === "incremental" ? "is-active" : ""}`}
            disabled={!enabled}
            onClick={() => onModeChange("incremental")}
          >
            Step
          </button>
          <button
            type="button"
            className={`jog__mode ${mode === "continuous" ? "is-active" : ""}`}
            disabled={!enabled}
            onClick={() => onModeChange("continuous")}
            title="Hold to move; release cancels jog"
          >
            Hold
          </button>
        </div>
      </header>

      <div className="jog__pad" aria-label="Axis jog pad">
        <span className="jog__spacer" />
        <JogButton
          label="Y+"
          ariaLabel="Jog Y positive"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ Y: 1 }}
        />
        <span className="jog__spacer" />

        <JogButton
          label="X−"
          ariaLabel="Jog X negative"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ X: -1 }}
        />
        <JogButton
          label="XY+"
          ariaLabel="Jog diagonal X positive Y positive"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ X: 1, Y: 1 }}
        />
        <JogButton
          label="X+"
          ariaLabel="Jog X positive"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ X: 1 }}
        />

        <span className="jog__spacer" />
        <JogButton
          label="Y−"
          ariaLabel="Jog Y negative"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ Y: -1 }}
        />
        <span className="jog__spacer" />
      </div>

      <div className="jog__z" role="group" aria-label="Z jog">
        <JogButton
          label="Z+"
          ariaLabel="Jog Z positive"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ Z: 1 }}
        />
        <JogButton
          label="Z−"
          ariaLabel="Jog Z negative"
          disabled={!enabled}
          mode={mode}
          onJog={onJog}
          onJogEnd={onJogEnd}
          axes={{ Z: -1 }}
        />
        <button
          type="button"
          className="jog__btn jog__btn--stop"
          disabled={!enabled}
          onClick={onJogEnd}
          title="Cancel jog (0x85)"
        >
          Stop
        </button>
      </div>

      <div className="jog__settings">
        <label className="jog__field">
          <span className="jog__field-label">Step mm</span>
          <select
            className="jog__select"
            value={stepMm}
            disabled={!enabled || mode === "continuous"}
            onChange={(e) => onStepChange(Number(e.target.value))}
          >
            {JOG_STEP_OPTIONS_MM.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="jog__field">
          <span className="jog__field-label">Feed mm/min</span>
          <select
            className="jog__select"
            value={feedMmMin}
            disabled={!enabled}
            onChange={(e) => onFeedChange(Number(e.target.value))}
          >
            {JOG_FEED_OPTIONS_MM_MIN.map((f) => (
              <option key={f} value={f}>
                {f}
                {f === DEFAULT_JOG_FEED_MM_MIN ? " · default" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="jog__hint">
        {mode === "incremental"
          ? "Tap an axis for one step. Diagonal XY+ is the center pad."
          : "Hold an axis to move; release or Stop cancels the jog."}
      </p>
      {softLimitHint ? (
        <p className="jog__warn" role="status">
          {softLimitHint}
        </p>
      ) : null}
    </section>
  );
}
