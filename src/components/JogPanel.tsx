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
  variant = "cardinal",
}: {
  label: string;
  ariaLabel: string;
  disabled: boolean;
  mode: JogMode;
  onJog: (axes: JogAxisMap) => void;
  onJogEnd: () => void;
  axes: JogAxisMap;
  variant?: "cardinal" | "diagonal" | "axis";
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
      className={`jog__btn jog__btn--${variant}`}
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

const XY_PAD: {
  label: string;
  ariaLabel: string;
  axes: JogAxisMap | null;
  variant?: "cardinal" | "diagonal";
}[] = [
  {
    label: "↖",
    ariaLabel: "Jog diagonal X negative Y positive",
    axes: { X: -1, Y: 1 },
    variant: "diagonal",
  },
  {
    label: "Y+",
    ariaLabel: "Jog Y positive",
    axes: { Y: 1 },
  },
  {
    label: "↗",
    ariaLabel: "Jog diagonal X positive Y positive",
    axes: { X: 1, Y: 1 },
    variant: "diagonal",
  },
  {
    label: "X−",
    ariaLabel: "Jog X negative",
    axes: { X: -1 },
  },
  {
    label: "·",
    ariaLabel: "",
    axes: null,
  },
  {
    label: "X+",
    ariaLabel: "Jog X positive",
    axes: { X: 1 },
  },
  {
    label: "↙",
    ariaLabel: "Jog diagonal X negative Y negative",
    axes: { X: -1, Y: -1 },
    variant: "diagonal",
  },
  {
    label: "Y−",
    ariaLabel: "Jog Y negative",
    axes: { Y: -1 },
  },
  {
    label: "↘",
    ariaLabel: "Jog diagonal X positive Y negative",
    axes: { X: 1, Y: -1 },
    variant: "diagonal",
  },
];

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
      </header>

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

      <div className="jog__motion">
        <div className="jog__block">
          <p className="jog__block-label">XY pad · 8-way</p>
          <div className="jog__pad" aria-label="XY jog pad">
            {XY_PAD.map((cell, i) =>
              cell.axes ? (
                <JogButton
                  key={i}
                  label={cell.label}
                  ariaLabel={cell.ariaLabel}
                  disabled={!enabled}
                  mode={mode}
                  onJog={onJog}
                  onJogEnd={onJogEnd}
                  axes={cell.axes}
                  variant={cell.variant ?? "cardinal"}
                />
              ) : (
                <span
                  key={i}
                  className="jog__origin"
                  aria-hidden="true"
                  title="Pad center"
                >
                  ·
                </span>
              ),
            )}
          </div>
        </div>

        <div className="jog__block">
          <p className="jog__block-label">Z · cancel</p>
          <div className="jog__z" role="group" aria-label="Z jog">
            <JogButton
              label="Z+"
              ariaLabel="Jog Z positive"
              disabled={!enabled}
              mode={mode}
              onJog={onJog}
              onJogEnd={onJogEnd}
              axes={{ Z: 1 }}
              variant="axis"
            />
            <JogButton
              label="Z−"
              ariaLabel="Jog Z negative"
              disabled={!enabled}
              mode={mode}
              onJog={onJog}
              onJogEnd={onJogEnd}
              axes={{ Z: -1 }}
              variant="axis"
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
        </div>
      </div>

      <p className="jog__hint">
        {mode === "incremental"
          ? "Tap a direction for one step. Corners jog XY together."
          : "Hold a direction to move; release or Stop cancels the jog."}
      </p>
      {softLimitHint ? (
        <p className="jog__warn" role="status">
          {softLimitHint}
        </p>
      ) : null}
    </section>
  );
}
