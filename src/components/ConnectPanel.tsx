import type { DesktopPortInfo } from "../grbl";
import { DEFAULT_BAUD, isVirtualCncPath } from "../grbl";

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
  /** True when the active / selected path is Virtual CNC (simulator). */
  usingVirtualCnc?: boolean;
  onSelectPath: (path: string) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

function shortPortLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "No port";
  if (isVirtualCncPath(trimmed)) return "Virtual CNC";
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] || trimmed;
}

function optionLabel(port: DesktopPortInfo): string {
  if (isVirtualCncPath(port.path)) {
    return "Virtual CNC · in-app simulator (no USB)";
  }
  return `${port.path}${port.portType ? ` · ${port.portType}` : ""}`;
}

export function ConnectPanel({
  phase,
  ports,
  selectedPath,
  portLabel,
  errorMessage,
  usingVirtualCnc = false,
  onSelectPath,
  onRefreshPorts,
  onConnect,
  onDisconnect,
}: ConnectPanelProps) {
  const connected = phase === "connected";
  const busy = phase === "connecting";
  const canConnect = Boolean(selectedPath) && !busy;
  const statusText =
    phase === "connecting"
      ? "Connecting"
      : connected
        ? usingVirtualCnc
          ? "Virtual"
          : "Linked"
        : phase === "error"
          ? "Fault"
          : "Offline";
  const portShort = shortPortLabel(portLabel);
  const metaTitle = `${DEFAULT_BAUD.toLocaleString()} baud · ${
    usingVirtualCnc
      ? "Virtual CNC — simulated GRBL (no Demon Shield USB)"
      : "USB serial"
  }`;

  return (
    <section
      className={`connect connect--header${connected ? " is-live" : ""}${usingVirtualCnc && connected ? " is-virtual" : ""}${phase === "error" ? " is-error" : ""}`}
      aria-label="Machine connection"
      title={metaTitle}
    >
      <div className="connect__status">
        <span
          className={`connect__dot ${connected ? "is-live" : ""} ${usingVirtualCnc && connected ? "is-virtual" : ""} ${phase === "error" ? "is-error" : ""}`}
          aria-hidden
        />
        <span className="connect__label" aria-live="polite">
          {statusText}
        </span>
        {connected ? (
          <span className="connect__port" title={portLabel}>
            {portShort}
          </span>
        ) : null}
      </div>

      {!connected ? (
        <div className="connect__ports">
          <label className="connect__field">
            <span className="visually-hidden">Port</span>
            <select
              className="connect__select"
              value={selectedPath}
              disabled={busy}
              onChange={(e) => onSelectPath(e.target.value)}
              aria-label="Serial port or Virtual CNC"
            >
              <option value="">
                {ports.length === 0 ? "No ports" : "Port…"}
              </option>
              {ports.map((port) => (
                <option key={port.path} value={port.path}>
                  {optionLabel(port)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="connect__btn connect__btn--ghost"
            onClick={onRefreshPorts}
            disabled={busy}
            title="Refresh port list"
            aria-label="Refresh port list"
          >
            ↻
          </button>
          <button
            type="button"
            className="connect__btn"
            onClick={onConnect}
            disabled={!canConnect}
          >
            {busy ? "…" : "Connect"}
          </button>
        </div>
      ) : (
        <div className="connect__actions">
          <button type="button" className="connect__btn" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      )}

      {errorMessage ? (
        <p className="connect__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
