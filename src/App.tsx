import { useEffect, useRef, useState } from "react";
import { ConnectPanel, type ConnectionPhase } from "./components/ConnectPanel";
import { CoordinateReadout } from "./components/CoordinateReadout";
import { JobLoad } from "./components/JobLoad";
import { MachineView } from "./components/MachineView";
import {
  createSessionClient,
  isDesktopShell,
  listAvailablePorts,
  OFFLINE_STATUS,
  type DesktopPortInfo,
  type GrblClient,
  type GrblStatus,
} from "./grbl";
import "./App.css";

export default function App() {
  const clientRef = useRef<GrblClient | null>(null);
  const [phase, setPhase] = useState<ConnectionPhase>("disconnected");
  const [status, setStatus] = useState<GrblStatus>(OFFLINE_STATUS);
  const [ports, setPorts] = useState<DesktopPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);
  const usingMock = !isDesktopShell();

  useEffect(() => {
    const client = createSessionClient();
    clientRef.current = client;
    const unsub = client.onStatus((next) => {
      setStatus(next);
      if (next.state === "Offline" && client.transport.isOpen === false) {
        setPhase((prev) => (prev === "connecting" ? prev : "disconnected"));
      }
    });
    return () => {
      unsub();
      void client.disconnect().catch(() => undefined);
      clientRef.current = null;
    };
  }, []);

  const refreshPorts = async () => {
    try {
      const next = await listAvailablePorts();
      setPorts(next);
      setSelectedPath((current) => {
        if (current && next.some((p) => p.path === current)) return current;
        return next[0]?.path ?? "";
      });
      setErrorMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setPorts([]);
    }
  };

  useEffect(() => {
    void refreshPorts();
  }, []);

  const handleConnect = async () => {
    const client = clientRef.current;
    if (!client || !selectedPath) return;
    setPhase("connecting");
    setErrorMessage(null);
    try {
      await client.connect({ path: selectedPath });
      setPhase("connected");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase("error");
      setErrorMessage(message);
      setStatus(OFFLINE_STATUS);
    }
  };

  const handleDisconnect = async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.disconnect();
    } finally {
      setPhase("disconnected");
      setStatus(OFFLINE_STATUS);
      setErrorMessage(null);
    }
  };

  const handleSoftReset = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.softReset();
      setErrorMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleLoadJob = () => {
    setJobName("untitled.nc");
  };

  const portLabel =
    phase === "connected"
      ? selectedPath || "Connected"
      : phase === "connecting"
        ? "Opening…"
        : selectedPath || "No port";

  return (
    <div className="shell">
      <div className="shell__atmosphere" aria-hidden />

      <header className="brand">
        <p className="brand__mark">SharpCNC</p>
        <p className="brand__tag">One machine. Clear position. Run the job.</p>
      </header>

      <div className="shell__stage">
        <MachineView tool={status.work} />

        <aside className="shell__rail">
          <ConnectPanel
            phase={phase}
            ports={ports}
            selectedPath={selectedPath}
            portLabel={portLabel}
            errorMessage={errorMessage}
            usingMock={usingMock}
            onSelectPath={setSelectedPath}
            onRefreshPorts={() => {
              void refreshPorts();
            }}
            onConnect={() => {
              void handleConnect();
            }}
            onDisconnect={() => {
              void handleDisconnect();
            }}
            onSoftReset={() => {
              void handleSoftReset();
            }}
          />
          <CoordinateReadout status={status} />
          <JobLoad jobName={jobName} onLoadClick={handleLoadJob} />
        </aside>
      </div>
    </div>
  );
}
