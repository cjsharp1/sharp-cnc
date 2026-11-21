import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityLogPanel } from "./components/ActivityLogPanel";
import { AppMenu } from "./components/AppMenu";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { ConnectPanel, type ConnectionPhase } from "./components/ConnectPanel";
import { CoordinateReadout } from "./components/CoordinateReadout";
import {
  ExternalJobsPanel,
  type ExternalJobKind,
} from "./components/ExternalJobsPanel";
import { JobLoad } from "./components/JobLoad";
import { JogPanel, type JogAxisMap } from "./components/JogPanel";
import { MachineView, type TrailPoint } from "./components/MachineView";
import { MaterialToolPanel } from "./components/MaterialToolPanel";
import { SafetyControls } from "./components/SafetyControls";
import { SimControls } from "./components/SimControls";
import { SvgJobPanel } from "./components/SvgJobPanel";
import {
  WorkspaceTabs,
  type WorkspaceTabId,
} from "./components/WorkspaceTabs";
import { WorkZeroPanel } from "./components/WorkZeroPanel";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  SETTING_SOFT_LIMITS,
  STEPS_SETTING_FOR_AXIS,
  UNLOCK_COMMAND,
  advanceSim,
  bedSizeFromLimits,
  buildJobFromSvg,
  buildJogCommand,
  buildSetWorkZeroCommand,
  canJogOrZero,
  canStartJob,
  canWriteSettings,
  checkJobSoftLimits,
  checkSoftLimits,
  continuousJogDelta,
  buildDebugSnapshot,
  createActivityLog,
  createDemonShieldExternalControlAdapter,
  createGcodeStreamer,
  createIdleSim,
  createSessionClient,
  fetchGrblSettings,
  importSvg,
  isDesktopShell,
  isGrblResetBanner,
  jogDeltaFromAxes,
  listAvailablePorts,
  loadDebugMode,
  loadDriveConfig,
  loadJobFromText,
  loadJobsFolderConfig,
  loadSoftTravel,
  loadStock,
  loadTool,
  OFFLINE_STATUS,
  parseAlarmLine,
  pauseSim,
  planGoToWorkZero,
  publishDebugSnapshot,
  resumeSim,
  saveDebugMode,
  saveDriveConfig,
  saveJobsFolderConfig,
  saveSoftTravel,
  saveStock,
  saveTool,
  softTravelFromSettings,
  startDebugBridge,
  startSim,
  stopDebugBridge,
  stopSim,
  stockOffsetForCorner,
  writeGrblSetting,
  writeGrblSettings,
  type Axis,
  type DebugBridgeStatus,
  type DesktopPortInfo,
  type DriveConfig,
  type ExternalControlAdapter,
  type GcodeStreamer,
  type GrblClient,
  type GrblSetting,
  type GrblStatus,
  type JobsFolderConfig,
  type JogMode,
  type LoadedJob,
  type PathSimSnapshot,
  type SoftTravelLimits,
  type StockConfig,
  type StockCorner,
  type StreamPhase,
  type StreamProgress,
  type SvgImportResult,
  type SvgToolpathParams,
  type ToolConfig,
  type ZeroAxisSelection,
} from "./grbl";
import "./App.css";

const CONTINUOUS_JOG_MS = 180;
/** Smooth display toward live WPos (ms time constant). */
const TOOL_SMOOTH_MS = 70;
/** Keep a short trail of recent work-mm points. */
const TRAIL_MAX_POINTS = 48;
const TRAIL_MIN_STEP_MM = 0.35;

export default function App() {
  const activityLog = useMemo(() => createActivityLog(), []);
  const clientRef = useRef<GrblClient | null>(null);
  const streamerRef = useRef<GcodeStreamer | null>(null);
  const continuousTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const continuousAxesRef = useRef<JogAxisMap | null>(null);
  const statusRef = useRef<GrblStatus>(OFFLINE_STATUS);
  const streamPhaseRef = useRef<StreamPhase>("idle");
  const externalControlsRef = useRef<ExternalControlAdapter>(
    createDemonShieldExternalControlAdapter(),
  );
  const startJobRef = useRef<() => Promise<void>>(async () => undefined);

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
  const [svgDraft, setSvgDraft] = useState<SvgImportResult | null>(null);
  const [sim, setSim] = useState<PathSimSnapshot>(() => createIdleSim([]));
  const [displayTool, setDisplayTool] = useState(() => OFFLINE_STATUS.work);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const displayToolRef = useRef(OFFLINE_STATUS.work);
  const trailRef = useRef<TrailPoint[]>([]);
  const simRef = useRef<PathSimSnapshot>(createIdleSim([]));
  const jobPathRef = useRef<LoadedJob["path"]>([]);

  /** Soft travel / bed size — persisted for the visualizer. */
  const [softTravel, setSoftTravel] = useState<SoftTravelLimits>(() =>
    loadSoftTravel(),
  );
  /** Workpiece size / placement — persisted for the visualizer. */
  const [stock, setStock] = useState<StockConfig>(() => loadStock());
  /** Tool / bit profile — persisted for visualizer + SVG defaults. */
  const [tool, setTool] = useState<ToolConfig>(() => loadTool());
  /** Watched local jobs folder — persisted path + auto-refresh. */
  const [jobsFolder, setJobsFolder] = useState<JobsFolderConfig>(() =>
    loadJobsFolderConfig(),
  );
  /** Google Drive prefs (account/folder hints; OAuth when client ID set). */
  const [driveConfig, setDriveConfig] = useState<DriveConfig>(() =>
    loadDriveConfig(),
  );
  const [grblSettings, setGrblSettings] = useState<Map<
    number,
    GrblSetting
  > | null>(null);
  const [calMessage, setCalMessage] = useState<string | null>(null);
  const [calBusy, setCalBusy] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabId>("move");
  const [calOpen, setCalOpen] = useState(false);
  const [matToolHighlight, setMatToolHighlight] = useState(false);
  const [extJobsHighlight, setExtJobsHighlight] = useState(false);
  /** Debug mode chrome (Export / Copy / bridge) — persisted; default off. */
  const [debugMode, setDebugMode] = useState(() => loadDebugMode());
  const [bridgeEnabled, setBridgeEnabled] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<DebugBridgeStatus | null>(
    null,
  );
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const handleDebugModeChange = (enabled: boolean) => {
    setDebugMode(enabled);
    saveDebugMode(enabled);
    if (!enabled) {
      setBridgeEnabled(false);
    }
  };

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

  const simulating =
    sim.phase === "playing" || sim.phase === "paused" || sim.phase === "done";
  const liveMoving =
    !simulating &&
    (status.state === "Jog" ||
      status.state === "Run" ||
      status.state === "Home" ||
      streaming);

  /** Estimate completed path segments from acked line ratio or sim. */
  const pathProgress = simulating
    ? sim.completedSegments
    : job && streamProgress && job.lines.length > 0
      ? Math.round(
          (streamProgress.ackedLines / job.lines.length) * job.path.length,
        )
      : 0;

  const resetSimForPath = (path: LoadedJob["path"]) => {
    const next = createIdleSim(path);
    simRef.current = next;
    setSim(next);
    trailRef.current = [];
    setTrail([]);
  };

  useEffect(() => {
    jobPathRef.current = job?.path ?? [];
  }, [job]);

  useEffect(() => {
    simRef.current = sim;
  }, [sim]);

  useEffect(() => {
    streamPhaseRef.current = streamProgress?.phase ?? "idle";
  }, [streamProgress]);

  // Smooth live WPos + optional motion trail; drive pre-run sim on rAF.
  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();
    let lastPublish = 0;
    let trailFadeAcc = 0;
    let published = { ...displayToolRef.current };

    const publishTool = (next: typeof published, force = false) => {
      displayToolRef.current = next;
      const moved =
        Math.hypot(next.x - published.x, next.y - published.y) > 0.04 ||
        Math.abs(next.z - published.z) > 0.04;
      if (force || moved) {
        published = next;
        setDisplayTool(next);
      }
    };

    const pushTrail = (x: number, y: number) => {
      const prev = trailRef.current;
      const last = prev[prev.length - 1];
      if (last && Math.hypot(x - last.x, y - last.y) < TRAIL_MIN_STEP_MM) {
        return;
      }
      const next = [...prev, { x, y }];
      if (next.length > TRAIL_MAX_POINTS) {
        next.splice(0, next.length - TRAIL_MAX_POINTS);
      }
      trailRef.current = next;
      setTrail(next);
    };

    const tick = (ts: number) => {
      const dt = Math.min(48, Math.max(0, ts - lastTs));
      lastTs = ts;
      const snap = simRef.current;
      const path = jobPathRef.current;

      if (snap.phase === "playing" && path.length > 0) {
        const advanced = advanceSim(snap, path, dt);
        simRef.current = advanced;
        if (
          advanced.phase !== snap.phase ||
          advanced.completedSegments !== snap.completedSegments ||
          Math.abs(advanced.progress - snap.progress) > 0.002
        ) {
          setSim(advanced);
        }
        const pos = advanced.position;
        publishTool({
          x: pos.x,
          y: pos.y,
          z: displayToolRef.current.z,
        });
        pushTrail(pos.x, pos.y);
      } else if (snap.phase === "paused" || snap.phase === "done") {
        const pos = snap.position;
        publishTool({
          x: pos.x,
          y: pos.y,
          z: displayToolRef.current.z,
        });
      } else {
        const target = statusRef.current.work;
        const cur = displayToolRef.current;
        const alpha = 1 - Math.exp(-dt / TOOL_SMOOTH_MS);
        const next = {
          x: cur.x + (target.x - cur.x) * alpha,
          y: cur.y + (target.y - cur.y) * alpha,
          z: cur.z + (target.z - cur.z) * alpha,
        };
        // Snap when nearly there to avoid endless micro-updates.
        const err = Math.hypot(target.x - next.x, target.y - next.y);
        const snapped =
          err < 0.02
            ? { x: target.x, y: target.y, z: target.z }
            : next;
        publishTool(snapped);

        const moving =
          statusRef.current.state === "Jog" ||
          statusRef.current.state === "Run" ||
          statusRef.current.state === "Home";
        if (moving) {
          pushTrail(snapped.x, snapped.y);
          trailFadeAcc = 0;
        } else if (trailRef.current.length > 0) {
          trailFadeAcc += dt;
          if (trailFadeAcc >= 40) {
            trailFadeAcc = 0;
            const faded = trailRef.current.slice(1);
            trailRef.current = faded;
            setTrail(faded);
          }
        }
      }

      // Keep a soft publish cadence so React stays responsive under load.
      if (ts - lastPublish > 32) lastPublish = ts;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const client = createSessionClient({ activityLog });
    clientRef.current = client;
    const controls = externalControlsRef.current;

    const applyExternalEvents = (
      events: ReturnType<ExternalControlAdapter["observe"]>,
    ) => {
      for (const ev of events) {
        activityLog.append("event", ev.message);
        if (ev.action === "hold") {
          streamerRef.current?.syncFromExternalHold();
        } else if (ev.action === "resume") {
          void streamerRef.current?.syncFromExternalResume();
        } else if (ev.action === "abort") {
          streamerRef.current?.syncFromExternalAbort();
          setErrorMessage(null);
          setSoftLimitHint(null);
        } else if (ev.action === "cycle-start-idle") {
          // Demon Shield RESUME while Idle → start loaded job (confirm on HW).
          void startJobRef.current();
        }
      }
    };

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
      applyExternalEvents(
        controls.observe({
          status: next,
          streamPhase: streamPhaseRef.current,
        }),
      );
    });

    // Also catch ALARM / error:Alarm lines that may not change status raw,
    // plus GRBL soft-reset banners from the external Abort button.
    const unsubLines = client.transport.onLine((line) => {
      const parsed = parseAlarmLine(line);
      if (parsed) setAlarmMessage(parsed.message);
      if (isGrblResetBanner(line)) {
        applyExternalEvents(
          controls.observe({
            status: statusRef.current,
            streamPhase: streamPhaseRef.current,
            rawLine: line,
          }),
        );
      }
    });

    streamerRef.current = createGcodeStreamer(client.transport, {
      onProgress: (p) => {
        streamPhaseRef.current = p.phase;
        setStreamProgress({ ...p });
      },
    });

    return () => {
      unsub();
      unsubLines();
      controls.reset();
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

  useEffect(() => {
    if (!calOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [calOpen]);

  useEffect(() => {
    if (!matToolHighlight) return;
    const t = window.setTimeout(() => setMatToolHighlight(false), 2200);
    return () => window.clearTimeout(t);
  }, [matToolHighlight]);

  useEffect(() => {
    if (!extJobsHighlight) return;
    const t = window.setTimeout(() => setExtJobsHighlight(false), 2200);
    return () => window.clearTimeout(t);
  }, [extJobsHighlight]);

  // Keep latest UI fields for the debug bridge without restarting the server.
  const bridgeContextRef = useRef({
    phase,
    selectedPath,
    connected,
    alarmMessage,
    jobName: job?.name ?? null,
    streamProgress,
    softTravel,
  });
  bridgeContextRef.current = {
    phase,
    selectedPath,
    connected,
    alarmMessage,
    jobName: job?.name ?? null,
    streamProgress,
    softTravel,
  };

  useEffect(() => {
    if (!debugMode || !bridgeEnabled) {
      setBridgeError(null);
      void stopDebugBridge()
        .then((status) => setBridgeStatus(status))
        .catch(() => setBridgeStatus(null));
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let unsubLog: (() => void) | null = null;

    const pushSnapshot = () => {
      const ctx = bridgeContextRef.current;
      const snapshot = buildDebugSnapshot({
        connection: {
          phase: ctx.phase,
          port: ctx.selectedPath || null,
          shell: isDesktopShell() ? "tauri" : "browser",
          connected: ctx.connected,
        },
        machine: {
          state: statusRef.current.state,
          mpos: { ...statusRef.current.machine },
          wpos: { ...statusRef.current.work },
          wco: statusRef.current.wco
            ? { ...statusRef.current.wco }
            : undefined,
          feedRate: statusRef.current.feedRate,
          spindleSpeed: statusRef.current.spindleSpeed,
          alarm: ctx.alarmMessage,
        },
        job: {
          name: ctx.jobName,
          phase: ctx.streamProgress?.phase ?? null,
          progress: ctx.streamProgress ? { ...ctx.streamProgress } : null,
        },
        softTravel: ctx.softTravel,
        log: activityLog,
        logLimit: 250,
      });
      void publishDebugSnapshot(snapshot).catch(() => undefined);
    };

    void (async () => {
      try {
        const status = await startDebugBridge();
        if (cancelled) {
          await stopDebugBridge().catch(() => undefined);
          return;
        }
        setBridgeStatus(status);
        setBridgeError(null);
        pushSnapshot();
        timer = setInterval(pushSnapshot, 400);
        unsubLog = activityLog.onChange(() => pushSnapshot());
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setBridgeError(message);
        setBridgeEnabled(false);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      unsubLog?.();
      void stopDebugBridge().catch(() => undefined);
    };
  }, [debugMode, bridgeEnabled, activityLog]);

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
    externalControlsRef.current.reset();
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
      setGrblSettings(null);
      setCalMessage(null);
      setCalBusy(false);
    }
  };

  const handleSoftReset = async () => {
    await stopContinuousJog();
    externalControlsRef.current.noteSoftwareAction("abort");
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
    externalControlsRef.current.noteSoftwareAction("abort");
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
      externalControlsRef.current.noteSoftwareAction("hold");
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
      externalControlsRef.current.noteSoftwareAction("resume");
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

  const settingsGate = canWriteSettings(status.state, connected, streaming);

  const updateSoftTravel = (next: SoftTravelLimits) => {
    setSoftTravel(next);
    saveSoftTravel(next);
  };

  const handleRefreshSettings = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot read settings");
      return;
    }
    setCalBusy(true);
    setCalMessage(null);
    try {
      const map = await fetchGrblSettings(client, {
        timeoutMs: usingMock ? 1500 : 5000,
      });
      setGrblSettings(map);
      const fromGrbl = softTravelFromSettings(map, softTravel);
      updateSoftTravel(fromGrbl);
      activityLog.append("event", `Read $$ (${map.size} settings)`);
      setCalMessage(`Loaded ${map.size} settings from $$`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleCalibrateMove = async (axis: Axis, distanceMm: number) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot move for calibration");
      return;
    }
    setCalBusy(true);
    setCalMessage(null);
    try {
      await stopContinuousJog();
      const delta =
        axis === "X"
          ? { x: distanceMm }
          : axis === "Y"
            ? { y: distanceMm }
            : { z: distanceMm };
      const check = checkSoftLimits(
        statusRef.current.machine,
        delta,
        softTravel,
      );
      if (!check.ok) {
        setCalMessage(check.reason ?? "Soft limit blocks calibration move");
        return;
      }
      const cmd = buildJogCommand(delta, feedMmMin);
      await client.sendLine(cmd);
      activityLog.append(
        "event",
        `Calibration move ${axis}${distanceMm > 0 ? "+" : ""}${distanceMm}`,
      );
      setCalMessage(
        `Moving ${axis} by ${distanceMm} mm — measure the real distance when Idle.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleWriteSteps = async (
    axis: Axis,
    before: number,
    after: number,
  ) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot write settings");
      return;
    }
    const id = STEPS_SETTING_FOR_AXIS[axis];
    setCalBusy(true);
    setCalMessage(null);
    try {
      await writeGrblSetting(client, id, after, {
        timeoutMs: usingMock ? 1500 : 4000,
      });
      setGrblSettings((prev) => {
        const next = new Map(prev ?? []);
        next.set(id, { id, value: after });
        return next;
      });
      activityLog.append(
        "event",
        `Wrote $${id}=${after} (was ${before}) steps/mm ${axis}`,
      );
      setCalMessage(
        `${axis} steps/mm: ${before.toFixed(3)} → ${after.toFixed(3)} ($${id})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleApplySoftTravel = async (
    limits: SoftTravelLimits,
    enableSoft: boolean,
  ) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot write settings");
      return;
    }
    if (limits.maxX === null && limits.maxY === null && limits.maxZ === null) {
      setCalMessage("Enter at least one max travel value.");
      return;
    }
    setCalBusy(true);
    setCalMessage(null);
    try {
      const entries: Array<{ id: number; value: number }> = [];
      if (limits.maxX !== null) entries.push({ id: 130, value: limits.maxX });
      if (limits.maxY !== null) entries.push({ id: 131, value: limits.maxY });
      if (limits.maxZ !== null) entries.push({ id: 132, value: limits.maxZ });
      if (enableSoft) entries.push({ id: SETTING_SOFT_LIMITS, value: 1 });

      await writeGrblSettings(client, entries, {
        timeoutMs: usingMock ? 1500 : 4000,
      });

      const merged: SoftTravelLimits = {
        maxX: limits.maxX ?? softTravel.maxX,
        maxY: limits.maxY ?? softTravel.maxY,
        maxZ: limits.maxZ ?? softTravel.maxZ,
        min: softTravel.min,
      };
      updateSoftTravel(merged);

      setGrblSettings((prev) => {
        const next = new Map(prev ?? []);
        for (const e of entries) next.set(e.id, { id: e.id, value: e.value });
        return next;
      });

      activityLog.append(
        "event",
        `Soft travel X${merged.maxX ?? "—"} Y${merged.maxY ?? "—"} Z${merged.maxZ ?? "—"} · $20=${enableSoft ? 1 : "unchanged"}`,
      );
      setCalMessage(
        `Wrote max travel${enableSoft ? " and enabled soft limits ($20=1)" : ""}. Bed updated.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleWriteManual = async (id: number, value: number) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot write settings");
      return;
    }
    setCalBusy(true);
    setCalMessage(null);
    try {
      await writeGrblSetting(client, id, value, {
        timeoutMs: usingMock ? 1500 : 4000,
      });
      setGrblSettings((prev) => {
        const next = new Map(prev ?? []);
        next.set(id, { id, value });
        return next;
      });
      if (id === 130 || id === 131 || id === 132) {
        const patched = { ...softTravel, min: { ...softTravel.min } };
        if (id === 130) patched.maxX = value;
        if (id === 131) patched.maxY = value;
        if (id === 132) patched.maxZ = value;
        updateSoftTravel(patched);
      }
      activityLog.append("event", `Wrote $${id}=${value}`);
      setCalMessage(`Wrote $${id}=${value}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
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

  const handleSimPlay = () => {
    if (!job || job.path.length === 0 || streaming) return;
    const current = simRef.current;
    const next =
      current.phase === "paused"
        ? resumeSim(current)
        : startSim(job.path);
    simRef.current = next;
    setSim(next);
    trailRef.current = [];
    setTrail([]);
    activityLog.append("event", "Path preview started (visualizer only)");
  };

  const handleSimPause = () => {
    const next = pauseSim(simRef.current);
    simRef.current = next;
    setSim(next);
  };

  const handleSimStop = () => {
    const next = stopSim(jobPathRef.current);
    simRef.current = next;
    setSim(next);
    trailRef.current = [];
    setTrail([]);
    // Snap display back toward live WPos on the next rAF ticks.
    activityLog.append("event", "Path preview stopped");
  };

  const applyGcodeText = (name: string, text: string) => {
    const loaded = loadJobFromText(name, text);
    setJob(loaded);
    setSvgDraft(null);
    resetSimForPath(loaded.path);
    setStreamProgress({
      phase: "idle",
      sentLines: 0,
      ackedLines: 0,
      totalLines: loaded.lines.length,
      percent: 0,
    });
    activityLog.append(
      "event",
      `Loaded ${name} (${loaded.lines.length} lines)`,
    );
  };

  const applySvgText = (name: string, text: string) => {
    try {
      const imported = importSvg(name, text);
      setSvgDraft(imported);
      activityLog.append(
        "event",
        `SVG ${name}: ${imported.polylines.length} path(s)` +
          (imported.bounds
            ? ` · ${imported.bounds.maxX.toFixed(1)}×${imported.bounds.maxY.toFixed(1)} mm`
            : ""),
      );
      if (imported.polylines.length === 0) {
        setErrorMessage("SVG had no drawable paths.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(`SVG parse failed: ${message}`);
      setSvgDraft(null);
    }
  };

  const handleLoadFile = (file: File) => {
    if (streaming || simulating) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      applyGcodeText(file.name, text);
    };
    reader.onerror = () => {
      setErrorMessage(`Failed to read ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleLoadSvg = (file: File) => {
    if (streaming) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      applySvgText(file.name, text);
    };
    reader.onerror = () => {
      setErrorMessage(`Failed to read ${file.name}`);
    };
    reader.readAsText(file);
  };

  const handleOpenExternal = (
    name: string,
    text: string,
    kind: ExternalJobKind,
  ) => {
    if (streaming || simulating) return;
    if (kind === "svg") {
      applySvgText(name, text);
    } else {
      applyGcodeText(name, text);
    }
  };

  const handleClearSvg = () => {
    if (streaming) return;
    setSvgDraft(null);
    activityLog.append("event", "SVG cleared");
  };

  const handleGenerateFromSvg = (params: SvgToolpathParams) => {
    if (!svgDraft || streaming || simulating) return;
    if (svgDraft.polylines.length === 0) {
      setErrorMessage("SVG has no paths to convert.");
      return;
    }
    const loaded = buildJobFromSvg(svgDraft.name, svgDraft.polylines, params);
    setJob(loaded);
    resetSimForPath(loaded.path);
    setStreamProgress({
      phase: "idle",
      sentLines: 0,
      ackedLines: 0,
      totalLines: loaded.lines.length,
      percent: 0,
    });
    activityLog.append(
      "event",
      `SVG→G-code ${loaded.name} (${loaded.lines.length} lines, ${params.mode})`,
    );
  };

  const handleClearJob = () => {
    if (streaming || simulating) return;
    setJob(null);
    resetSimForPath([]);
    setStreamProgress(null);
    activityLog.append("event", "Job cleared");
  };

  const handleStartJob = async () => {
    const streamer = streamerRef.current;
    const client = clientRef.current;
    if (!streamer || !client || !job) return;
    if (simulating) {
      setErrorMessage("Stop the path preview before starting the job.");
      return;
    }

    if (statusRef.current.state === "Alarm") {
      setErrorMessage("Clear alarm (unlock) before starting.");
      return;
    }

    const gate = canStartJob(statusRef.current.state, connected);
    if (!gate.ok) {
      setErrorMessage(gate.reason ?? "Cannot start");
      return;
    }

    resetSimForPath(job.path);

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
    externalControlsRef.current.noteSoftwareAction("start");
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
  startJobRef.current = handleStartJob;

  const handlePauseJob = async () => {
    try {
      externalControlsRef.current.noteSoftwareAction("hold");
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
      externalControlsRef.current.noteSoftwareAction("resume");
      await streamerRef.current?.resume();
      activityLog.append("event", "Job resume");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleStopJob = async () => {
    try {
      externalControlsRef.current.noteSoftwareAction("abort");
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

  const jobBadge = streaming
    ? streamProgress?.phase === "paused"
      ? "Held"
      : "Run"
    : job
      ? "Ready"
      : svgDraft
        ? "SVG"
        : null;

  const openCalibration = () => {
    setCalOpen(true);
    if (connected && settingsGate.ok && !grblSettings) {
      void handleRefreshSettings();
    }
  };

  const openMaterialTool = () => {
    setWorkspaceTab("job");
    setMatToolHighlight(true);
  };

  const openExternalJobs = () => {
    setWorkspaceTab("job");
    setExtJobsHighlight(true);
  };

  const handleJobsFolderChange = (next: JobsFolderConfig) => {
    setJobsFolder(next);
    saveJobsFolderConfig(next);
  };

  const handleDriveConfigChange = (next: DriveConfig) => {
    setDriveConfig(next);
    saveDriveConfig(next);
  };

  const handleStockChange = (next: StockConfig) => {
    setStock(next);
    saveStock(next);
  };

  const handleToolChange = (next: ToolConfig) => {
    setTool(next);
    saveTool(next);
  };

  const handlePlaceStockCorner = (corner: StockCorner) => {
    const offsets = stockOffsetForCorner(
      stock,
      corner,
      bedMm.width,
      bedMm.depth,
    );
    handleStockChange({ ...stock, ...offsets });
  };

  return (
    <div className="shell">
      <div className="shell__atmosphere" aria-hidden />

      <header className="brand">
        <div className="brand__text">
          <p className="brand__mark">SharpCNC</p>
          <p className="brand__tag">
            One machine. Clear position. Run the job.
          </p>
        </div>
        <AppMenu
          onOpenCalibration={openCalibration}
          onOpenMaterialTool={openMaterialTool}
          onOpenExternalJobs={openExternalJobs}
          debugMode={debugMode}
          onDebugModeChange={handleDebugModeChange}
        />
      </header>

      <section className="shell__essentials" aria-label="Machine essentials">
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
      </section>

      <div className="shell__stage">
        <div className="shell__main">
          <MachineView
            tool={displayTool}
            bedMm={bedMm}
            path={job?.path ?? svgDraft?.preview}
            pathProgress={job ? pathProgress : 0}
            pathLabel={
              simulating
                ? "preview"
                : job
                  ? "job"
                  : svgDraft
                    ? "SVG preview"
                    : null
            }
            stock={stock}
            toolDiameterMm={tool.diameterMm}
            trail={trail}
            liveMoving={liveMoving}
            simulating={simulating}
            overlay={
              job && job.path.length > 0 ? (
                <div className="machine__overlay">
                  <SimControls
                    variant="overlay"
                    phase={sim.phase}
                    progress={sim.progress}
                    disabled={streaming}
                    disabledReason={
                      streaming
                        ? "Stop the running job before simulating."
                        : null
                    }
                    onPlay={handleSimPlay}
                    onPause={handleSimPause}
                    onStop={handleSimStop}
                  />
                </div>
              ) : null
            }
          />
        </div>

        <aside className="shell__rail">
          <section className="workspace" aria-label="Secondary controls">
            <WorkspaceTabs
              active={workspaceTab}
              onChange={setWorkspaceTab}
              jobBadge={jobBadge}
            />

            <div className="workspace__body">
              {workspaceTab === "move" && (
                <div
                  className="workspace__panel"
                  role="tabpanel"
                  id="workspace-panel-move"
                  aria-labelledby="workspace-tab-move"
                >
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
                </div>
              )}

              {workspaceTab === "job" && (
                <div
                  className="workspace__panel"
                  role="tabpanel"
                  id="workspace-panel-job"
                  aria-labelledby="workspace-tab-job"
                >
                  <div
                    className={`mattool-anchor${matToolHighlight ? " is-flash" : ""}`}
                    id="material-tool-settings"
                  >
                    <MaterialToolPanel
                      stock={stock}
                      tool={tool}
                      bedMm={bedMm}
                      onStockChange={handleStockChange}
                      onToolChange={handleToolChange}
                      onPlaceCorner={handlePlaceStockCorner}
                    />
                  </div>
                  <ExternalJobsPanel
                    folder={jobsFolder}
                    drive={driveConfig}
                    busy={streaming || simulating}
                    highlight={extJobsHighlight}
                    onFolderChange={handleJobsFolderChange}
                    onDriveChange={handleDriveConfigChange}
                    onOpenExternal={handleOpenExternal}
                  />
                  <SvgJobPanel
                    draft={svgDraft}
                    busy={streaming}
                    toolDiameterMm={tool.diameterMm}
                    onLoadSvg={handleLoadSvg}
                    onClear={handleClearSvg}
                    onGenerate={handleGenerateFromSvg}
                  />
                  <JobLoad
                    job={job}
                    progress={streamProgress}
                    connected={connected}
                    machineState={status.state}
                    startBlockedReason={startBlockedReason}
                    simPhase={sim.phase}
                    simProgress={sim.progress}
                    simDisabled={streaming}
                    simDisabledReason={
                      streaming
                        ? "Stop the running job before simulating."
                        : null
                    }
                    onSimPlay={handleSimPlay}
                    onSimPause={handleSimPause}
                    onSimStop={handleSimStop}
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
                </div>
              )}

              {workspaceTab === "log" && (
                <div
                  className="workspace__panel workspace__panel--log"
                  role="tabpanel"
                  id="workspace-panel-log"
                  aria-labelledby="workspace-tab-log"
                >
                  <ActivityLogPanel
                    log={activityLog}
                    debugMode={debugMode}
                    bridgeEnabled={bridgeEnabled}
                    bridgeStatus={bridgeStatus}
                    bridgeError={bridgeError}
                    onBridgeEnabledChange={setBridgeEnabled}
                  />
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {calOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Calibration"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close calibration"
            onClick={() => setCalOpen(false)}
          />
          <div className="cal-modal__sheet">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">Settings · Wizard</p>
                <h2 className="cal-modal__title">Calibration</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                onClick={() => setCalOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <CalibrationPanel
                enabled={settingsGate.ok && !calBusy}
                blockedReason={
                  !connected
                    ? "Connect first."
                    : !settingsGate.ok
                      ? (settingsGate.reason ?? "Settings locked")
                      : calBusy
                        ? "Settings operation in progress…"
                        : null
                }
                settings={grblSettings}
                softTravel={softTravel}
                status={status}
                machinePos={status.machine}
                busy={calBusy}
                message={calMessage}
                zeroEnabled={jogEnabled}
                zeroMessage={zeroMessage}
                onRefreshSettings={() => {
                  void handleRefreshSettings();
                }}
                onCalibrateMove={(axis, distanceMm) => {
                  void handleCalibrateMove(axis, distanceMm);
                }}
                onWriteSteps={(axis, before, after) => {
                  void handleWriteSteps(axis, before, after);
                }}
                onApplySoftTravel={(limits, enableSoft) => {
                  void handleApplySoftTravel(limits, enableSoft);
                }}
                onWriteManual={(id, value) => {
                  void handleWriteManual(id, value);
                }}
                onZero={(axes) => {
                  void handleZero(axes);
                }}
                onClose={() => setCalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
