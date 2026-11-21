import { useEffect, useRef, useState } from "react";
import { ConnectPanel, type ConnectionPhase } from "./components/ConnectPanel";
import { CoordinateReadout } from "./components/CoordinateReadout";
import { JobLoad } from "./components/JobLoad";
import { JogPanel, type JogAxisMap } from "./components/JogPanel";
import { MachineView } from "./components/MachineView";
import { WorkZeroPanel } from "./components/WorkZeroPanel";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  DEFAULT_SOFT_TRAVEL,
  JOG_STEP_OPTIONS_MM,
  bedSizeFromLimits,
  buildJogCommand,
  buildSetWorkZeroCommand,
  checkSoftLimits,
  continuousJogDelta,
  createSessionClient,
  isDesktopShell,
  jogDeltaFromAxes,
  listAvailablePorts,
  OFFLINE_STATUS,
  planGoToWorkZero,
  type DesktopPortInfo,
  type GrblClient,
  type GrblStatus,
  type JogMode,
  type SoftTravelLimits,
  type ZeroAxisSelection,
} from "./grbl";
import "./App.css";

const CONTINUOUS_JOG_MS = 180;

export default function App() {
  const clientRef = useRef<GrblClient | null>(null);
  const continuousTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const continuousAxesRef = useRef<JogAxisMap | null>(null);
  const statusRef = useRef<GrblStatus>(OFFLINE_STATUS);

  const [phase, setPhase] = useState<ConnectionPhase>("disconnected");
  const [status, setStatus] = useState<GrblStatus>(OFFLINE_STATUS);
  const [ports, setPorts] = useState<DesktopPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string | null>(null);

  const [jogMode, setJogMode] = useState<JogMode>("incremental");
  const [stepMm, setStepMm] = useState<number>(JOG_STEP_OPTIONS_MM[1]);
  const [feedMmMin, setFeedMmMin] = useState(DEFAULT_JOG_FEED_MM_MIN);
  const [softLimitHint, setSoftLimitHint] = useState<string | null>(null);
  const [pendingGoTo, setPendingGoTo] = useState<ZeroAxisSelection | null>(null);
  const [zeroMessage, setZeroMessage] = useState<string | null>(null);

  /** Soft travel known to the app — defaults until calibration UI lands. */
  const [softTravel] = useState<SoftTravelLimits>(DEFAULT_SOFT_TRAVEL);

  const usingMock = !isDesktopShell();
  const connected = phase === "connected";
  const bedMm = bedSizeFromLimits(softTravel);

  useEffect(() => {
    const client = createSessionClient();
    clientRef.current = client;
    const unsub = client.onStatus((next) => {
      statusRef.current = next;
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

  useEffect(() => {
    return () => {
      if (continuousTimerRef.current) {
        clearInterval(continuousTimerRef.current);
        continuousTimerRef.current = null;
      }
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
    setSoftLimitHint(null);
    setZeroMessage(null);
    setPendingGoTo(null);
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

  const stopContinuousJog = async () => {
    continuousAxesRef.current = null;
    if (continuousTimerRef.current) {
      clearInterval(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
    const client = clientRef.current;
    if (client?.transport.isOpen) {
      try {
        await client.cancelJog();
      } catch {
        /* ignore */
      }
    }
  };

  const handleDisconnect = async () => {
    await stopContinuousJog();
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.disconnect();
    } finally {
      setPhase("disconnected");
      setStatus(OFFLINE_STATUS);
      setErrorMessage(null);
      setPendingGoTo(null);
    }
  };

  const handleSoftReset = async () => {
    await stopContinuousJog();
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.softReset();
      setErrorMessage(null);
      setSoftLimitHint(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const sendJogDelta = async (axes: JogAxisMap, continuous: boolean) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;

    const delta = continuous
      ? continuousJogDelta(axes, feedMmMin, CONTINUOUS_JOG_MS / 1000)
      : jogDeltaFromAxes(axes, stepMm);

    if (
      (delta.x === undefined || delta.x === 0) &&
      (delta.y === undefined || delta.y === 0) &&
      (delta.z === undefined || delta.z === 0)
    ) {
      return;
    }

    const check = checkSoftLimits(statusRef.current.machine, delta, softTravel);
    if (!check.ok) {
      setSoftLimitHint(check.reason ?? "Soft limit");
      if (continuous) await stopContinuousJog();
      return;
    }

    setSoftLimitHint(null);
    try {
      await client.sendLine(buildJogCommand(delta, feedMmMin));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      if (continuous) await stopContinuousJog();
    }
  };

  const handleJog = (axes: JogAxisMap) => {
    if (!connected) return;
    if (jogMode === "incremental") {
      void sendJogDelta(axes, false);
      return;
    }

    continuousAxesRef.current = axes;
    void sendJogDelta(axes, true);
    if (continuousTimerRef.current) clearInterval(continuousTimerRef.current);
    continuousTimerRef.current = setInterval(() => {
      const current = continuousAxesRef.current;
      if (!current) return;
      void sendJogDelta(current, true);
    }, CONTINUOUS_JOG_MS);
  };

  const handleJogEnd = () => {
    void stopContinuousJog();
  };

  const handleZero = async (axes: ZeroAxisSelection) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.sendLine(buildSetWorkZeroCommand(axes));
      setZeroMessage(
        axes === "XYZ"
          ? "Work XYZ zero set at current position (G10 L20)."
          : `Work ${axes} zero set at current position (G10 L20).`,
      );
      // Ask for a fresh status so WCO/WPos update promptly.
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleConfirmGoTo = async () => {
    const axes = pendingGoTo;
    setPendingGoTo(null);
    if (!axes) return;
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;

    const live = statusRef.current;
    const plan = planGoToWorkZero(axes, {
      softLimits: softTravel,
      machine: live.machine,
      wco: live.wco ?? {
        x: live.machine.x - live.work.x,
        y: live.machine.y - live.work.y,
        z: live.machine.z - live.work.z,
      },
      zFeedMmMin: Math.min(feedMmMin, 500),
      xyFeedMmMin: feedMmMin,
    });

    if (plan.blocked) {
      setZeroMessage(plan.blocked);
      return;
    }

    try {
      for (const cmd of plan.commands) {
        await client.sendLine(cmd);
        // Small gap so GRBL can accept the next jog after the previous finishes
        // in the mock; real GRBL buffers jog commands while planning.
        await new Promise((r) => setTimeout(r, usingMock ? 320 : 40));
      }
      setZeroMessage(
        plan.warnings.length
          ? `Go-to-zero sent. ${plan.warnings.join(" ")}`
          : "Go-to-zero jog sequence sent.",
      );
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
        <MachineView tool={status.work} bedMm={bedMm} />

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
          <JogPanel
            enabled={connected}
            mode={jogMode}
            stepMm={stepMm}
            feedMmMin={feedMmMin}
            softLimitHint={softLimitHint}
            onModeChange={setJogMode}
            onStepChange={setStepMm}
            onFeedChange={setFeedMmMin}
            onJog={handleJog}
            onJogEnd={handleJogEnd}
          />
          <WorkZeroPanel
            enabled={connected}
            pendingGoTo={pendingGoTo}
            message={zeroMessage}
            onZero={(axes) => {
              void handleZero(axes);
            }}
            onRequestGoTo={setPendingGoTo}
            onConfirmGoTo={() => {
              void handleConfirmGoTo();
            }}
            onCancelGoTo={() => setPendingGoTo(null)}
          />
          <JobLoad jobName={jobName} onLoadClick={handleLoadJob} />
        </aside>
      </div>
    </div>
  );
}
