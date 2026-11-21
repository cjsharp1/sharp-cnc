import type { Position3, SavedWorkOffset, WcsId } from "../grbl";
import { WCS_OPTIONS } from "../grbl";

interface WorkOffsetsPanelProps {
  enabled: boolean;
  active: WcsId;
  slots: Partial<Record<WcsId, SavedWorkOffset>>;
  currentWco: Position3;
  message?: string | null;
  onSelect: (id: WcsId) => void;
  onSave: (id: WcsId) => void;
  onRecall: (id: WcsId) => void;
}

function fmt(n: number): string {
  return n.toFixed(3);
}

export function WorkOffsetsPanel({
  enabled,
  active,
  slots,
  currentWco,
  message,
  onSelect,
  onSave,
  onRecall,
}: WorkOffsetsPanelProps) {
  const activeSlot = slots[active];

  return (
    <section className="offsets" aria-label="Work offsets">
      <header className="offsets__head">
        <h2 className="offsets__title">Work offsets</h2>
        <span className="offsets__meta">G54–G59</span>
      </header>

      <p className="offsets__hint">
        Select a coordinate system, save the current WCO into that slot, or
        recall a saved slot into GRBL (<code>G10 L2</code>).
      </p>

      <div className="offsets__wcs" role="group" aria-label="Active WCS">
        {WCS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`offsets__chip${active === opt.id ? " is-active" : ""}${slots[opt.id] ? " has-save" : ""}`}
            disabled={!enabled}
            onClick={() => onSelect(opt.id)}
            title={
              slots[opt.id]
                ? `${opt.id} — saved ${slots[opt.id]!.name}`
                : `Select ${opt.id}`
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="offsets__readout" aria-live="polite">
        <p className="offsets__readout-label">
          Current WCO (mm) · active {active}
        </p>
        <p className="offsets__readout-vals">
          X{fmt(currentWco.x)} · Y{fmt(currentWco.y)} · Z{fmt(currentWco.z)}
        </p>
        {activeSlot ? (
          <p className="offsets__saved">
            Saved {activeSlot.name}: X{fmt(activeSlot.wco.x)} · Y
            {fmt(activeSlot.wco.y)} · Z{fmt(activeSlot.wco.z)}
          </p>
        ) : (
          <p className="offsets__saved offsets__saved--empty">
            No save in {active} yet
          </p>
        )}
      </div>

      <div className="offsets__actions" role="group" aria-label="Offset actions">
        <button
          type="button"
          className="offsets__btn"
          disabled={!enabled}
          onClick={() => onSave(active)}
          title={`Save current WCO into ${active}`}
        >
          Save {active}
        </button>
        <button
          type="button"
          className="offsets__btn offsets__btn--ghost"
          disabled={!enabled || !activeSlot}
          onClick={() => onRecall(active)}
          title={`Recall ${active} into GRBL`}
        >
          Recall
        </button>
      </div>

      {message ? (
        <p className="offsets__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
