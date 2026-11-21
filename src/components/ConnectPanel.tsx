import type { DesktopPortInfo } from "../grbl";
import { DEFAULT_BAUD } from "../grbl";

export type ConnectionPhase =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface ConnectPanelProps {
  phase: ConnectionPhase;
  ports: DesktopPortInfo[];
  selectedPath: string;
  portLabel: string;
  errorMessage?: string | null;
  usingMock?: boolean;
  onSelectPath: (path: string) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSoftReset: () => void;
}

export function ConnectPanel({
  phase,
  ports,
  selectedPath,
  portLabel,
  errorMessage,
  usingMock = false,
  onSelectPath,
  onRefreshPorts,
  onConnect,
  onDisconnect,
  onSoftReset,
}: ConnectPanelProps) {
  const connected = phase === "connected";
  const busy = phase === "connecting";
  const canConnect = Boolean(selectedPath) && !busy;

  return (
    <section className="connect" aria-label="Machine connection">
      <div className="connect__row">
        <div className="connect__status">
          <span
            className={`connect__dot ${connected ? "is-live" : ""} ${phase === "error" ? "is-error" : ""}`}
            aria-hidden
          />
          <div>
            <p className="connect__label">
              {phase === "connecting"
                ? "Connecting"
                : connected
                  ? "Linked"
                  : phase === "error"
                    ? "Fault"
                    : "Standing by"}
            </p>
            <p className="connect__port">{portLabel}</p>
          </div>
        </div>
        <div className="connect__actions">
          {connected ? (
            <>
              <button
                type="button"
                className="connect__btn connect__btn--ghost"
                onClick={onSoftReset}
                title="Soft reset (Ctrl-X)"
              >
                Reset
              </button>
              <button
                type="button"
                className="connect__btn"
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="connect__btn"
              onClick={onConnect}
              disabled={!canConnect}
            >
              {busy ? "…" : "Connect"}
            </button>
          )}
        </div>
      </div>

      <div className="connect__ports">
        <label className="connect__field">
          <span className="connect__field-label">Port</span>
          <select
            className="connect__select"
            value={selectedPath}
            disabled={connected || busy}
            onChange={(e) => onSelectPath(e.target.value)}
          >
            <option value="">
              {ports.length === 0 ? "No ports found" : "Select port…"}
            </option>
            {ports.map((port) => (
              <option key={port.path} value={port.path}>
                {port.path}
                {port.portType ? ` · ${port.portType}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="connect__btn connect__btn--ghost"
          onClick={onRefreshPorts}
          disabled={connected || busy}
          title="Refresh port list"
        >
          Refresh
        </button>
      </div>

      <p className="connect__meta">
        {DEFAULT_BAUD.toLocaleString()} baud
        {usingMock ? " · mock GRBL (no USB in this shell)" : " · USB serial"}
      </p>
      {errorMessage ? (
        <p className="connect__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
