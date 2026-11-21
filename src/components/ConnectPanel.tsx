interface ConnectPanelProps {
  connected: boolean;
  portLabel: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectPanel({
  connected,
  portLabel,
  onConnect,
  onDisconnect,
}: ConnectPanelProps) {
  return (
    <section className="connect" aria-label="Machine connection">
      <div className="connect__status">
        <span
          className={`connect__dot ${connected ? "is-live" : ""}`}
          aria-hidden
        />
        <div>
          <p className="connect__label">
            {connected ? "Linked" : "Standing by"}
          </p>
          <p className="connect__port">{portLabel}</p>
        </div>
      </div>
      <button
        type="button"
        className="connect__btn"
        onClick={connected ? onDisconnect : onConnect}
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
    </section>
  );
}
