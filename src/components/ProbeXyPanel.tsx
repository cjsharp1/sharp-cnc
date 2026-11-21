import type { EdgeDirection } from "../grbl";

interface ProbeXyPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  busy?: boolean;
  bitDiameterMm: number;
  seekMm: number;
  feedMmMin: number;
  plateThicknessMm: number;
  message?: string | null;
  onSeekChange: (mm: number) => void;
  onFeedChange: (mmMin: number) => void;
  onEdge: (axis: "X" | "Y", direction: EdgeDirection) => void;
  onCorner: (mode: "outside" | "inside") => void;
  onToolLength: () => void;
}

export function ProbeXyPanel({
  enabled,
  blockedReason = null,
  busy = false,
  bitDiameterMm,
  seekMm,
  feedMmMin,
  plateThicknessMm,
  message,
  onSeekChange,
  onFeedChange,
  onEdge,
  onCorner,
  onToolLength,
}: ProbeXyPanelProps) {
  const can = enabled && !busy;

  return (
    <section className="probexy" aria-label="XY probe and tool length">
      <header className="probexy__head">
        <h2 className="probexy__title">XY probe</h2>
        <span className="probexy__meta">G38.2 · edges / corner</span>
      </header>

      <p className="probexy__hint">
        Jog near the stock edge, then probe. Outside corner applies bit-radius
        compensation (Ø {bitDiameterMm.toFixed(2)} mm). Tool length re-zeros Z
        on the plate after a bit change (thickness {plateThicknessMm} mm).
      </p>

      <div className="probexy__fields">
        <label className="probexy__field">
          Seek mm
          <input
            type="number"
            min={1}
            step={1}
            value={seekMm}
            disabled={busy}
            onChange={(e) => onSeekChange(Number(e.target.value) || 1)}
          />
        </label>
        <label className="probexy__field">
          Feed mm/min
          <input
            type="number"
            min={10}
            step={10}
            value={feedMmMin}
            disabled={busy}
            onChange={(e) => onFeedChange(Number(e.target.value) || 10)}
          />
        </label>
      </div>

      <div className="probexy__edges" role="group" aria-label="Edge probe">
        <button
          type="button"
          className="probexy__btn"
          disabled={!can}
          onClick={() => onEdge("X", "positive")}
          title="Probe +X"
        >
          Edge +X
        </button>
        <button
          type="button"
          className="probexy__btn"
          disabled={!can}
          onClick={() => onEdge("X", "negative")}
          title="Probe −X"
        >
          Edge −X
        </button>
        <button
          type="button"
          className="probexy__btn"
          disabled={!can}
          onClick={() => onEdge("Y", "positive")}
          title="Probe +Y"
        >
          Edge +Y
        </button>
        <button
          type="button"
          className="probexy__btn"
          disabled={!can}
          onClick={() => onEdge("Y", "negative")}
          title="Probe −Y"
        >
          Edge −Y
        </button>
      </div>

      <div className="probexy__corners" role="group" aria-label="Corner probe">
        <button
          type="button"
          className="probexy__btn"
          disabled={!can}
          onClick={() => onCorner("outside")}
        >
          Outside corner
        </button>
        <button
          type="button"
          className="probexy__btn probexy__btn--ghost"
          disabled={!can}
          onClick={() => onCorner("inside")}
        >
          Inside corner
        </button>
      </div>

      <button
        type="button"
        className="probexy__btn probexy__btn--tool"
        disabled={!can}
        onClick={onToolLength}
        title="Z probe plate after bit change"
      >
        {busy ? "Probing…" : "Tool length (Z)"}
      </button>

      {blockedReason ? (
        <p className="probexy__warn" role="status">
          {blockedReason}
        </p>
      ) : null}
      {message ? (
        <p className="probexy__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
