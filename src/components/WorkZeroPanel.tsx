import type { Axis, ZeroAxisSelection } from "../grbl";

interface WorkZeroPanelProps {
  enabled: boolean;
  pendingGoTo: ZeroAxisSelection | null;
  message?: string | null;
  onZero: (axes: ZeroAxisSelection) => void;
  onRequestGoTo: (axes: ZeroAxisSelection) => void;
  onConfirmGoTo: () => void;
  onCancelGoTo: () => void;
}

const AXIS_BUTTONS: { id: ZeroAxisSelection; label: string }[] = [
  { id: "X", label: "Zero X" },
  { id: "Y", label: "Zero Y" },
  { id: "Z", label: "Zero Z" },
  { id: "XYZ", label: "Zero XYZ" },
];

function goToLabel(axes: ZeroAxisSelection): string {
  if (axes === "XYZ") return "Go to material zero (Z up, then XY, then Z)";
  return `Go to material ${axes}=0`;
}

export function WorkZeroPanel({
  enabled,
  pendingGoTo,
  message,
  onZero,
  onRequestGoTo,
  onConfirmGoTo,
  onCancelGoTo,
}: WorkZeroPanelProps) {
  return (
    <section className="zero" aria-label="Material zero">
      <header className="zero__head">
        <h2 className="zero__title">Material zero</h2>
        <span className="zero__meta">G10 L20 · G54</span>
      </header>

      <div className="zero__actions" role="group" aria-label="Set material zero">
        {AXIS_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            className="zero__btn"
            disabled={!enabled || pendingGoTo !== null}
            onClick={() => onZero(btn.id)}
            title={`Set current ${btn.id === "XYZ" ? "position" : `${btn.id} position`} as material zero`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="zero__goto" role="group" aria-label="Go to material zero">
        <p className="zero__goto-label">Go to zero</p>
        <div className="zero__goto-row">
          {(
            [
              { axes: "X" as const, label: "X" },
              { axes: "Y" as const, label: "Y" },
              { axes: "Z" as const, label: "Z" },
              { axes: "XYZ" as const, label: "All" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.axes}
              type="button"
              className="zero__btn zero__btn--goto"
              disabled={!enabled || pendingGoTo !== null}
              onClick={() => onRequestGoTo(btn.axes)}
              title={goToLabel(btn.axes)}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {pendingGoTo ? (
        <div className="zero__confirm" role="alertdialog" aria-labelledby="zero-confirm-title">
          <p id="zero-confirm-title" className="zero__confirm-title">
            Move to material {pendingGoTo === "XYZ" ? "XYZ" : pendingGoTo} zero?
          </p>
          <p className="zero__confirm-body">
            {pendingGoTo === "XYZ" || pendingGoTo === "X" || pendingGoTo === "Y"
              ? "Safe path: raise Z to material Z0, then XY, then finish Z if needed. Confirm to send."
              : "This jogs Z to material zero. Confirm to send."}
          </p>
          <div className="zero__confirm-actions">
            <button
              type="button"
              className="zero__btn zero__btn--ghost"
              onClick={onCancelGoTo}
            >
              Cancel
            </button>
            <button
              type="button"
              className="zero__btn zero__btn--danger"
              onClick={onConfirmGoTo}
            >
              Confirm move
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <p className="zero__message" role="status">
          {message}
        </p>
      ) : (
        <p className="zero__hint">
          Zeroing sets the current tool location as material origin — it does
          not move the machine. To also place stock, use{" "}
          <strong>Set XY zero + stock … at tip</strong> in Material &amp; tool
          or Prepare.
        </p>
      )}
    </section>
  );
}

/** Narrow Axis helper for callers that only zero one axis. */
export type WorkZeroAxis = Axis;
