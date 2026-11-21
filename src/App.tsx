import { useState } from "react";
import { ConnectPanel } from "./components/ConnectPanel";
import { CoordinateReadout } from "./components/CoordinateReadout";
import { JobLoad } from "./components/JobLoad";
import { MachineView } from "./components/MachineView";
import { OFFLINE_STATUS, type GrblStatus } from "./grbl";
import "./App.css";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<GrblStatus>(OFFLINE_STATUS);
  const [jobName, setJobName] = useState<string | null>(null);

  const handleConnect = () => {
    // Scaffold only — real serial open lands in a later milestone.
    setConnected(true);
    setStatus({
      ...OFFLINE_STATUS,
      state: "Idle",
    });
  };

  const handleDisconnect = () => {
    setConnected(false);
    setStatus(OFFLINE_STATUS);
  };

  const handleLoadJob = () => {
    setJobName("untitled.nc");
  };

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
            connected={connected}
            portLabel={connected ? "Stub · awaiting serial" : "No port"}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
          <CoordinateReadout status={status} />
          <JobLoad jobName={jobName} onLoadClick={handleLoadJob} />
        </aside>
      </div>
    </div>
  );
}
