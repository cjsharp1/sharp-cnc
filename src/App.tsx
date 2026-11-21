import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityLogPanel } from "./components/ActivityLogPanel";
import { ConnectPanel, type ConnectionPhase } from "./components/ConnectPanel";
import { CoordinateReadout } from "./components/CoordinateReadout";
import { JobLoad } from "./components/JobLoad";
import { JogPanel, type JogAxisMap } from "./components/JogPanel";
import { MachineView } from "./components/MachineView";
import { SafetyControls } from "./components/SafetyControls";
import { WorkZeroPanel } from "./components/WorkZeroPanel";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  DEFAULT_SOFT_TRAVEL,
  JOG_STEP_OPTIONS_MM,
  UNLOCK_COMMAND,
  bedSizeFromLimits,
  buildJogCommand,
  buildSetWorkZeroCommand,
  canJogOrZero,
  canStartJob,
  checkJobSoftLimits,
  checkSoftLimits,
  continuousJogDelta,
  createActivityLog,
  createGcodeStreamer,
  createSessionClient,
  isDesktopShell,
  jogDeltaFromAxes,
  listAvailablePorts,
  loadJobFromText,
  OFFLINE_STATUS,
  parseAlarmLine,
  planGoToWorkZero,
  type DesktopPortInfo,
  type GcodeStreamer,
  type GrblClient,
  type GrblStatus,
  type JogMode,
  type LoadedJob,
  type SoftTravelLimits,
  type StreamProgress,
  type ZeroAxisSelection,
} from "./grbl";
import "./App.css";

const CONTINUOUS_JOG_MS = 180;

export default function App() {
  const activityLog = useMemo(() => createActivityLog(), []);
  const clientRef = useRef<GrblClient | null>(null);
  const streamerRef = useRef<GcodeStreamer | null>(null);
  const continuousTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const continuousAxesRef = useRef<JogAxisMap | null>(null);
  const statusRef = useRef<GrblStatus>(OFFLINE_STATUS);

  const [phase, setPhase] = useState<ConnectionPhase>("disconnected");
  const [status, setStatus] = useState<GrblStatus>(OFFLINE_STATUS);
  const [ports, setPorts] = useState<DesktopPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alarmMessage, setAlarmMessage] = useState<string | null>(null);

  const [jogMode, setJogMode] = useState<JogMode>("incremental");
  const [stepMm, setStepMm] = useState<number>(JOG_STEP_OPTIONS_MM[1]);
  const [feedMmMin, setFeedMmMin] = useState(DEFAULT_JOG_FEED_MM_MIN);
  const [softLimitHint, setSoftLimitHint] = useState<string | null>(null);
  const [pendingGoTo, setPendingGoTo] = useState<ZeroAxisSelection | null>(null);
  const [zeroMessage, setZeroMessage] = useState<string | null>(null);

  const [job, setJob] = useState<LoadedJob | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(
    null,
  );

  /** Soft travel known to the app — defaults until calibration UI lands. */
  const [softTravel] = useState<SoftTravelLimits>(DEFAULT_SOFT_TRAVEL);

  const usingMock = !isDesktopShell();
  const connected = phase === "connected";
  const bedMm = bedSizeFromLimits(softTravel);

  const streaming =
    streamProgress?.phase === "running" ||
    streamProgress?.phase === "paused" ||
    streamProgress?.phase === "stopping";

  const jobSoftCheck =
    job && connected
      ? checkJobSoftLimits(
          job.bounds,
          status.wco ?? {
            x: status.machine.x - status.work.x,
            y: status.machine.y - status.work.y,
            z: status.machine.z - status.work.z,
          },
          softTravel,
        )
      : null;

  const startGate = canStartJob(status.state, connected);
  const startBlockedReason = !job
    ? null
    : !startGate.ok
      ? (startGate.reason ?? "Cannot start")
      : streaming
        ? "Job already running"
        : jobSoftCheck && !jobSoftCheck.ok
          ? (jobSoftCheck.reason ?? "Job outside soft limits")
          : null;

  /** Estimate completed path segments from acked line ratio. */
  const pathProgress =
    job && streamProgress && job.lines.length > 0
      ? Math.round(
          (streamProgress.ackedLines / job.lines.length) * job.path.length,
        )
      : 0;

  useEffect(() => {
    const client = createSessionClient({ activityLog });
    clientRef.current = client;
    const unsub = client.onStatus((next) => {
      statusRef.current = next;
      setStatus(next);
      if (next.state === "Alarm" && next.raw) {
        const parsed = parseAlarmLine(next.raw);
        if (parsed) setAlarmMessage(parsed.message);
      } else if (next.state !== "Alarm") {
        setAlarmMessage(null);
      }
      if (next.state === "Offline" && client.transport.isOpen === false) {
        setPhase((prev) => (prev === "connecting" ? prev : "disconnected"));
      }
    });

    // Also catch ALARM / error:Alarm lines that may not change status raw.
    const unsubLines = client.transport.onLine((line) => {
      const parsed = parseAlarmLine(line);
      if (parsed) setAlarmMessage(parsed.message);
    });

    streamerRef.current = createGcodeStreamer(client.transport, {
      onProgress: (p) => setStreamProgress({ ...p }),
    });

    return () => {
      unsub();
      unsubLines();
      streamerRef.current?.dispose();
      streamerRef.current = null;
      void client.disconnect().catch(() => undefined);
      clientRef.current = null;
    };
  }, [activityLog]);

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
    setAlarmMessage(null);
    try {
      await client.connect({ path: selectedPath });
      setPhase("connected");
      activityLog.append("event", `Connected ${selectedPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase("error");
      setErrorMessage(message);
      setStatus(OFFLINE_STATUS);
      activityLog.append("event", `Connect failed: ${message}`);
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
    if (streaming) {
      await streamerRef.current?.stop();
    }
    await stopContinuousJog();
    const client = clientRef.current;
    if (!client) return;
    try {
      await client.disconnect();
      activityLog.append("event", "Disconnected");
    } finally {
      setPhase("disconnected");
      setStatus(OFFLINE_STATUS);
      setErrorMessage(null);
      setAlarmMessage(null);
      setPendingGoTo(null);
      setStreamProgress(null);
    }
  };

  const handleSoftReset = async () => {
    await stopContinuousJog();
    if (streaming) {
      await streamerRef.current?.stop();
    }
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.softReset();
      setErrorMessage(null);
      setSoftLimitHint(null);
      activityLog.append("event", "Soft reset");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleEstop = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    activityLog.append("event", "E-Stop");
    await stopContinuousJog();
    try {
      await client.feedHold();
    } catch {
      /* best-effort */
    }
    // Brief pause so hold latches before soft reset clears the buffer.
    await new Promise((r) => setTimeout(r, 40));
    try {
      const streamPhase = streamerRef.current?.getProgress().phase;
      if (
        streamPhase === "running" ||
        streamPhase === "paused" ||
        streamPhase === "stopping" ||
        streamPhase === "error"
      ) {
        await streamerRef.current?.stop();
      } else {
        await client.softReset();
      }
      setErrorMessage(null);
      setSoftLimitHint(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleHold = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    if (statusRef.current.state === "Alarm") {
      setErrorMessage("Alarm lock — unlock before hold/resume.");
      return;
    }
    try {
      if (streamProgress?.phase === "running") {
        await streamerRef.current?.pause();
      } else {
        await client.feedHold();
      }
      activityLog.append("event", "Feed hold");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleResume = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    if (statusRef.current.state === "Alarm") {
      setErrorMessage("Alarm lock — unlock before resume.");
      return;
    }
    try {
      if (streamProgress?.phase === "paused") {
        await streamerRef.current?.resume();
      } else {
        await client.cycleStart();
      }
      activityLog.append("event", "Cycle start / resume");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleUnlock = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.sendLine(UNLOCK_COMMAND);
      activityLog.append("event", "Unlock ($X)");
      setErrorMessage(null);
      setAlarmMessage(null);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleSimulateAlarm = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await stopContinuousJog();
      if (streaming) await streamerRef.current?.stop();
      await client.sendLine("$Alarm");
      activityLog.append("event", "Simulated alarm (mock)");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const sendJogDelta = async (axes: JogAxisMap, continuous: boolean) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    if (streaming) return;

    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setSoftLimitHint(gate.reason ?? "Cannot jog");
      if (continuous) await stopContinuousJog();
      return;
    }

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
      const cmd = buildJogCommand(delta, feedMmMin);
      await client.sendLine(cmd);
      if (!continuous) {
        activityLog.append("event", `Jog ${cmd.replace(/^\$J=/, "")}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      if (continuous) await stopContinuousJog();
    }
  };

  const handleJog = (axes: JogAxisMap) => {
    if (!connected || streaming) return;
    if (statusRef.current.state === "Alarm") {
      setSoftLimitHint("Alarm lock — unlock before jogging.");
      return;
    }
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
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setZeroMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine(buildSetWorkZeroCommand(axes));
      setZeroMessage(
        axes === "XYZ"
          ? "Work XYZ zero set at current position (G10 L20)."
          : `Work ${axes} zero set at current position (G10 L20).`,
      );
      activityLog.append("event", `Work zero ${axes}`);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleConfirmGoTo = async () => {
    const axes = pendingGoTo;
    setPendingGoTo(null);
    if (!axes || streaming) return;
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;

    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setZeroMessage(gate.reason ?? "Cannot go to zero");
      return;
    }

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
        await new Promise((r) => setTimeout(r, usingMock ? 320 : 40));
      }
      activityLog.append("event", `Go-to-zero ${axes}`);
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

  const handleLoadFile = (file: File) => {
    if (streaming) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const loaded = loadJobFromText(file.name, text);
      setJob(loaded);
      setStreamProgress({
        phase: "idle",
        sentLines: 0,
        ackedLines: 0,
        totalLines: loaded.lines.length,
        percent: 0,
      });
      activityLog.append(
        "event",
        `Loaded ${file.name} (${loaded.lines.length} lines)`,
      );
    };
    reader.onerror = () => {
      setErrorMessage(`Failed to read ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleClearJob = () => {
    if (streaming) return;
    setJob(null);
    setStreamProgress(null);
    activityLog.append("event", "Job cleared");
  };

  const handleStartJob = async () => {
    const streamer = streamerRef.current;
    const client = clientRef.current;
    if (!streamer || !client || !job) return;

    if (statusRef.current.state === "Alarm") {
      setErrorMessage("Clear alarm (unlock) before starting.");
      return;
    }

    const gate = canStartJob(statusRef.current.state, connected);
    if (!gate.ok) {
      setErrorMessage(gate.reason ?? "Cannot start");
      return;
    }

    const soft = checkJobSoftLimits(
      job.bounds,
      statusRef.current.wco ?? {
        x: statusRef.current.machine.x - statusRef.current.work.x,
        y: statusRef.current.machine.y - statusRef.current.work.y,
        z: statusRef.current.machine.z - statusRef.current.work.z,
      },
      softTravel,
    );
    if (!soft.ok) {
      setErrorMessage(soft.reason ?? "Job outside soft limits");
      return;
    }

    await stopContinuousJog();
    setErrorMessage(null);
    activityLog.append("event", `Job start: ${job.name}`);
    try {
      await streamer.start(job.lines);
      activityLog.append("event", `Job completed: ${job.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      activityLog.append("event", `Job error: ${message}`);
    }
  };

  const handlePauseJob = async () => {
    try {
      await streamerRef.current?.pause();
      activityLog.append("event", "Job pause");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleResumeJob = async () => {
    if (statusRef.current.state === "Alarm") {
      setErrorMessage("Alarm lock — unlock before resume.");
      return;
    }
    try {
      await streamerRef.current?.resume();
      activityLog.append("event", "Job resume");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleStopJob = async () => {
    try {
      await streamerRef.current?.stop();
      activityLog.append("event", "Job stop");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const portLabel =
    phase === "connected"
      ? selectedPath || "Connected"
      : phase === "connecting"
        ? "Opening…"
        : selectedPath || "No port";

  const jogGate = canJogOrZero(status.state, connected, streaming);
  const jogEnabled = jogGate.ok;

  return (
    <div className="shell">
      <div className="shell__atmosphere" aria-hidden />

      <header className="brand">
        <p className="brand__mark">SharpCNC</p>
        <p className="brand__tag">One machine. Clear position. Run the job.</p>
      </header>

      <div className="shell__stage">
        <div className="shell__main">
          <MachineView
            tool={status.work}
            bedMm={bedMm}
            path={job?.path}
            pathProgress={pathProgress}
          />
          <ActivityLogPanel log={activityLog} />
        </div>

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
          <SafetyControls
            connected={connected}
            machineState={status.state}
            alarmMessage={alarmMessage}
            usingMock={usingMock}
            onEstop={() => {
              void handleEstop();
            }}
            onHold={() => {
              void handleHold();
            }}
            onResume={() => {
              void handleResume();
            }}
            onReset={() => {
              void handleSoftReset();
            }}
            onUnlock={() => {
              void handleUnlock();
            }}
            onSimulateAlarm={() => {
              void handleSimulateAlarm();
            }}
          />
          <CoordinateReadout status={status} />
          <JogPanel
            enabled={jogEnabled}
            mode={jogMode}
            stepMm={stepMm}
            feedMmMin={feedMmMin}
            softLimitHint={
              softLimitHint ??
              (!jogGate.ok && connected ? jogGate.reason : null)
            }
            onModeChange={setJogMode}
            onStepChange={setStepMm}
            onFeedChange={setFeedMmMin}
            onJog={handleJog}
            onJogEnd={handleJogEnd}
          />
          <WorkZeroPanel
            enabled={jogEnabled}
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
          <JobLoad
            job={job}
            progress={streamProgress}
            connected={connected}
            machineState={status.state}
            startBlockedReason={startBlockedReason}
            onLoadFile={handleLoadFile}
            onClear={handleClearJob}
            onStart={() => {
              void handleStartJob();
            }}
            onPause={() => {
              void handlePauseJob();
            }}
            onResume={() => {
              void handleResumeJob();
            }}
            onStop={() => {
              void handleStopJob();
            }}
          />
        </aside>
      </div>
    </div>
  );
}
