interface HomingPanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  homed: boolean;
  busy?: boolean;
  message?: string | null;
  onHome: () => void;
  onClearHome: () => void;
}

export function HomingPanel({
  enabled,
  blockedReason = null,
  homed,
  busy = false,
  message,
  onHome,
  onClearHome,
}: HomingPanelProps) {
  return (
    <section className="homing" aria-label="Homing">
      <header className="homing__head">
        <h2 className="homing__title">Homing</h2>
        <span
          className={`homing__badge${homed ? " is-homed" : ""}`}
          title={
            homed
              ? "SharpCNC recorded a successful $H this session"
              : "Not marked homed this session"
          }
        >
          {homed ? "Homed" : "Not homed"}
        </span>
      </header>

      <p className="homing__hint">
        Sends GRBL <code>$H</code> to the zero-side <strong>limit switches</strong>{" "}
        (needs <code>$22=1</code>) — not the touch plate. Clear only drops
        SharpCNC’s session flag — it does not wipe EEPROM.
      </p>

      <div className="homing__actions" role="group" aria-label="Home controls">
        <button
          type="button"
          className="homing__btn"
          disabled={!enabled || busy}
          title={blockedReason ?? "Cycle home ($H)"}
          onClick={onHome}
        >
          {busy ? "Homing…" : "Home ($H)"}
        </button>
        <button
          type="button"
          className="homing__btn homing__btn--ghost"
          disabled={!homed || busy}
          title="Clear SharpCNC home flag"
          onClick={onClearHome}
        >
          Clear home
        </button>
      </div>

      {blockedReason && enabled === false ? (
        <p className="homing__warn" role="status">
          {blockedReason}
        </p>
      ) : null}
      {message ? (
        <p className="homing__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
