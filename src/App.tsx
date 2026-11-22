import { useEffect, useMemo, useRef, useState } from "react";
import { AboutUpdatePanel } from "./components/AboutUpdatePanel";
import { ActivityLogPanel } from "./components/ActivityLogPanel";
import { AppMenu } from "./components/AppMenu";
import {
  BedTravelTestPanel,
  type BedTravelRunPhase,
} from "./components/BedTravelTestPanel";
import {
  StockPerimeterTestPanel,
  type StockPerimeterRunPhase,
} from "./components/StockPerimeterTestPanel";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { ConnectPanel, type ConnectionPhase } from "./components/ConnectPanel";
import { ConsolePanel } from "./components/ConsolePanel";
import { CoordinateReadout } from "./components/CoordinateReadout";
import { CrashRecoveryPanel } from "./components/CrashRecoveryPanel";
import {
  FirstRunWizard,
  type FirstRunStepId,
} from "./components/FirstRunWizard";
import {
  ExternalJobsPanel,
  type ExternalJobKind,
} from "./components/ExternalJobsPanel";
import { HomingPanel } from "./components/HomingPanel";
import { JobLoad } from "./components/JobLoad";
import { JogPanel, type JogAxisMap } from "./components/JogPanel";
import { MachineView, type TrailPoint } from "./components/MachineView";
import { MaterialToolPanel } from "./components/MaterialToolPanel";
import { OverridesStrip } from "./components/OverridesStrip";
import { PrepareRunPanel } from "./components/PrepareRunPanel";
import { ProbeXyPanel } from "./components/ProbeXyPanel";
import { RecentJobsPanel } from "./components/RecentJobsPanel";
import { SafetyControls } from "./components/SafetyControls";
import { SimControls } from "./components/SimControls";
import { SpindleFeedPanel } from "./components/SpindleFeedPanel";
import { SvgJobPanel } from "./components/SvgJobPanel";
import {
  WorkspaceTabs,
  type WorkspaceTabId,
} from "./components/WorkspaceTabs";
import { WorkOffsetsPanel } from "./components/WorkOffsetsPanel";
import { WorkZeroPanel } from "./components/WorkZeroPanel";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  SETTING_DIR_PORT_INVERT,
  SETTING_SOFT_LIMITS,
  STEPS_SETTING_FOR_AXIS,
  describeDirInvertMask,
  HOME_COMMAND,
  UNLOCK_COMMAND,
  advanceSim,
  applyOverrideStep,
  applyRapidOverrideStep,
  bedSizeFromLimits,
  bitRadiusMm,
  buildDryRunLines,
  buildJobFromSvg,
  buildJogCommand,
  buildProbeRetractCommand,
  buildRecallOffsetCommands,
  buildSelectWcsCommand,
  buildSetWorkZeroCommand,
  buildSpindleOffCommand,
  buildSpindleOnCommand,
  canHome,
  canJogOrZero,
  canProbe,
  canSendConsole,
  canStartJob,
  canWriteSettings,
  checkJobSoftLimits,
  checkLatestRelease,
  checkSoftLimits,
  clampScrubIndex,
  clearJobRecoveryCheckpoint,
  continuousJogDelta,
  createActivityLog,
  createDemonShieldExternalControlAdapter,
  createGcodeStreamer,
  createIdleSim,
  createMacro,
  DEFAULT_SIM_SPEED,
  createSessionClient,
  currentWcoFromStatus,
  describeClearHomeState,
  estimateJobTimeFromJob,
  feedOverrideByte,
  fetchGrblSettings,
  formatVersionLabel,
  guideForAlarm,
  importSvg,
  isDesktopShell,
  isGrblResetBanner,
  isIncompleteRecovery,
  jogDeltaFromAxes,
  listAvailablePorts,
  loadDebugMode,
  loadDriveConfig,
  loadFeedsSpeedsSelection,
  loadFirstRunState,
  loadJobFromText,
  loadJobRecoveryCheckpoint,
  loadJobsFolderConfig,
  loadMacros,
  loadOverridePercents,
  loadProbeConfig,
  loadRecentJobs,
  loadSoftTravel,
  loadStock,
  loadTool,
  loadUiTheme,
  loadWorkOffsets,
  packagedAppVersion,
  resolveAppVersion,
  saveFirstRunCompleted,
  OFFLINE_STATUS,
  parseAlarmLine,
  parseConsoleLines,
  pauseSim,
  planGoToWorkZero,
  playProximityBeep,
  publishDebugSnapshot,
  rapidOverrideByte,
  softLimitsEnabled,
  rememberRecentJob,
  removeRecentJob,
  resumeSim,
  runCornerProbeCycle,
  runEdgeProbeCycle,
  runToolLengthProbeCycle,
  runZProbeCycle,
  saveDebugMode,
  saveDriveConfig,
  saveFeedsSpeedsSelection,
  saveJobRecoveryCheckpoint,
  saveJobsFolderConfig,
  saveMacros,
  saveOverridePercents,
  saveProbeConfig,
  saveSoftTravel,
  saveStock,
  saveTool,
  saveUiTheme,
  applyUiTheme,
  saveWorkOffsets,
  softTravelFromSettings,
  snapshotOffset,
  spindleOverrideByte,
  startDebugBridge,
  startSim,
  stopDebugBridge,
  stopSim,
  stockOffsetForCorner,
  stockOffsetForWorkOriginCorner,
  writeGrblSetting,
  writeGrblSettings,
  buildDebugSnapshot,
  type Axis,
  type DebugBridgeStatus,
  type DesktopPortInfo,
  type DriveConfig,
  type EdgeDirection,
  type ExternalControlAdapter,
  type FeedsSpeedsSelection,
  type GcodeMacro,
  type GcodeStreamer,
  type GrblClient,
  type GrblSetting,
  type GrblStatus,
  type JobRecoveryCheckpoint,
  type JobsFolderConfig,
  type JogMode,
  type LoadedJob,
  type OverrideStep,
  type PathSimSnapshot,
  type ProbeConfig,
  type RapidOverrideStep,
  type RecentJobEntry,
  type SimSpeedRate,
  type BedTravelPlan,
  type StockPerimeterPlan,
  type SoftTravelLimits,
  type StockConfig,
  type StockCorner,
  type StreamPhase,
  type StreamProgress,
  type SvgImportResult,
  type SvgToolpathParams,
  type ToolConfig,
  type UiTheme,
  type WcsId,
  type WorkOffsetsStore,
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
  const jobRef = useRef<LoadedJob | null>(null);
  const dryRunRef = useRef(false);

  const [phase, setPhase] = useState<ConnectionPhase>("disconnected");
  const [status, setStatus] = useState<GrblStatus>(OFFLINE_STATUS);
  const [ports, setPorts] = useState<DesktopPortInfo[]>([]);
  const [selectedPath, setSelectedPath] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alarmMessage, setAlarmMessage] = useState<string | null>(null);
  const [alarmCode, setAlarmCode] = useState<number | null>(null);

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
  const [simSpeed, setSimSpeed] = useState<SimSpeedRate>(DEFAULT_SIM_SPEED);
  const [displayTool, setDisplayTool] = useState(() => OFFLINE_STATUS.work);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const displayToolRef = useRef(OFFLINE_STATUS.work);
  const trailRef = useRef<TrailPoint[]>([]);
  const simRef = useRef<PathSimSnapshot>(createIdleSim([]));
  const simSpeedRef = useRef<SimSpeedRate>(DEFAULT_SIM_SPEED);
  const jobPathRef = useRef<LoadedJob["path"]>([]);

  /** Soft travel / bed size — persisted for the visualizer. */
  const [softTravel, setSoftTravel] = useState<SoftTravelLimits>(() =>
    loadSoftTravel(),
  );
  /** Workpiece size / placement — persisted for the visualizer. */
  const [stock, setStock] = useState<StockConfig>(() => loadStock());
  /** Tool / bit profile — persisted for visualizer + SVG defaults. */
  const [tool, setTool] = useState<ToolConfig>(() => loadTool());
  /** Material presets + suggested F/S — persisted. */
  const [feeds, setFeeds] = useState<FeedsSpeedsSelection>(() =>
    loadFeedsSpeedsSelection(),
  );
  const [feedsApplyToken, setFeedsApplyToken] = useState(0);
  const [feedOverridePercent, setFeedOverridePercent] = useState(
    () => loadOverridePercents().feed,
  );
  const [rapidOverridePercent, setRapidOverridePercent] = useState(
    () => loadOverridePercents().rapid,
  );
  const [spindleOverridePercent, setSpindleOverridePercent] = useState(
    () => loadOverridePercents().spindle,
  );
  const [homed, setHomed] = useState(false);
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeMessage, setHomeMessage] = useState<string | null>(null);
  const [workOffsets, setWorkOffsets] = useState<WorkOffsetsStore>(() =>
    loadWorkOffsets(),
  );
  const [offsetsMessage, setOffsetsMessage] = useState<string | null>(null);
  const [macros, setMacros] = useState<GcodeMacro[]>(() => loadMacros());
  const [consoleResult, setConsoleResult] = useState<string | null>(null);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [dryRun, setDryRun] = useState(false);
  const [recovery, setRecovery] = useState<JobRecoveryCheckpoint | null>(() => {
    const cp = loadJobRecoveryCheckpoint();
    return isIncompleteRecovery(cp) ? cp : null;
  });
  const [recoveryVisible, setRecoveryVisible] = useState(
    () => isIncompleteRecovery(loadJobRecoveryCheckpoint()),
  );
  const [xyProbeBusy, setXyProbeBusy] = useState(false);
  const [xyProbeMessage, setXyProbeMessage] = useState<string | null>(null);
  const [xySeekMm, setXySeekMm] = useState(20);
  const [xyFeedMmMin, setXyFeedMmMin] = useState(80);
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
  const [bedTravelOpen, setBedTravelOpen] = useState(false);
  const [bedTravelPhase, setBedTravelPhase] =
    useState<BedTravelRunPhase>("idle");
  const [bedTravelPlan, setBedTravelPlan] = useState<BedTravelPlan | null>(
    null,
  );
  const [bedTravelSegmentIndex, setBedTravelSegmentIndex] = useState(0);
  const [bedTravelMessage, setBedTravelMessage] = useState<string | null>(null);
  const [bedTravelSound, setBedTravelSound] = useState(true);
  const bedTravelAbortRef = useRef(false);
  const bedTravelRunningRef = useRef(false);
  const [stockPerimeterOpen, setStockPerimeterOpen] = useState(false);
  const [stockPerimeterPhase, setStockPerimeterPhase] =
    useState<StockPerimeterRunPhase>("idle");
  const [stockPerimeterPlan, setStockPerimeterPlan] =
    useState<StockPerimeterPlan | null>(null);
  const [stockPerimeterSegmentIndex, setStockPerimeterSegmentIndex] =
    useState(0);
  const [stockPerimeterMessage, setStockPerimeterMessage] = useState<
    string | null
  >(null);
  const [stockPerimeterSound, setStockPerimeterSound] = useState(true);
  const stockPerimeterAbortRef = useRef(false);
  const stockPerimeterRunningRef = useRef(false);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState(() =>
    packagedAppVersion(),
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [firstRunOpen, setFirstRunOpen] = useState(
    () => !loadFirstRunState().completed,
  );
  const [firstRunStep, setFirstRunStep] = useState<FirstRunStepId>("connect");
  const [firstRunMessage, setFirstRunMessage] = useState<string | null>(null);
  const [probeConfig, setProbeConfig] = useState<ProbeConfig>(() =>
    loadProbeConfig(),
  );
  /** Session flags from Prepare wizard (reset on disconnect / new job). */
  const [prepareXyZeroed, setPrepareXyZeroed] = useState(false);
  const [prepareZProbed, setPrepareZProbed] = useState(false);
  const [prepareReady, setPrepareReady] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState<string | null>(null);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [matToolHighlight, setMatToolHighlight] = useState(false);
  const [extJobsHighlight, setExtJobsHighlight] = useState(false);
  const [recentJobs, setRecentJobs] = useState<RecentJobEntry[]>(() =>
    loadRecentJobs(),
  );
  /** Debug mode chrome (Export / Copy / bridge) — persisted; default off. */
  const [debugMode, setDebugMode] = useState(() => loadDebugMode());
  /** Color theme — persisted; default dark workshop. */
  const [theme, setTheme] = useState<UiTheme>(() => loadUiTheme());
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

  const handleThemeChange = (next: UiTheme) => {
    setTheme(next);
    saveUiTheme(next);
    applyUiTheme(next);
  };

  const usingMock = !isDesktopShell();
  const connected = phase === "connected";
  const bedMm = bedSizeFromLimits(softTravel);

  const streaming =
    streamProgress?.phase === "running" ||
    streamProgress?.phase === "paused" ||
    streamProgress?.phase === "tool-change" ||
    streamProgress?.phase === "stopping";

  const currentWco = currentWcoFromStatus(
    status.machine,
    status.work,
    status.wco,
  );

  const alarmGuide =
    status.state === "Alarm"
      ? guideForAlarm(
          alarmMessage
            ? { code: alarmCode, message: alarmMessage, raw: alarmMessage }
            : null,
        )
      : null;

  const jobTimeEstimate = job ? estimateJobTimeFromJob(job) : null;

  const liveFeedPercent =
    status.overrides?.feed ?? feedOverridePercent;
  const liveRapidPercent =
    status.overrides?.rapid ?? rapidOverridePercent;
  const liveSpindlePercent =
    status.overrides?.spindle ?? spindleOverridePercent;

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
          : !prepareReady
            ? "Prepare to run (Menu or Prepare…) — confirm work zero first"
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
    simSpeedRef.current = simSpeed;
  }, [simSpeed]);

  useEffect(() => {
    streamPhaseRef.current = streamProgress?.phase ?? "idle";
  }, [streamProgress]);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    dryRunRef.current = dryRun;
  }, [dryRun]);

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

    const pushTrail = (
      x: number,
      y: number,
      z?: number,
      activity?: TrailPoint["activity"],
    ) => {
      const prev = trailRef.current;
      const last = prev[prev.length - 1];
      if (last && Math.hypot(x - last.x, y - last.y) < TRAIL_MIN_STEP_MM) {
        // Still update activity/z on the tip so pure-Z moves refresh cues.
        if (
          last &&
          (last.activity !== activity ||
            (z != null && Math.abs((last.z ?? 0) - z) > 0.02))
        ) {
          const tip = { ...last, x, y, z, activity };
          const next = [...prev.slice(0, -1), tip];
          trailRef.current = next;
          setTrail(next);
        }
        return;
      }
      const next = [...prev, { x, y, z, activity }];
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
        const advanced = advanceSim(snap, path, dt, {
          rate: simSpeedRef.current,
        });
        simRef.current = advanced;
        if (
          advanced.phase !== snap.phase ||
          advanced.completedSegments !== snap.completedSegments ||
          advanced.activity !== snap.activity ||
          Math.abs(advanced.progress - snap.progress) > 0.002 ||
          Math.abs(advanced.position.z - snap.position.z) > 0.02
        ) {
          setSim(advanced);
        }
        const pos = advanced.position;
        publishTool({
          x: pos.x,
          y: pos.y,
          z: pos.z,
        });
        pushTrail(pos.x, pos.y, pos.z, advanced.activity ?? undefined);
      } else if (snap.phase === "paused" || snap.phase === "done") {
        const pos = snap.position;
        publishTool({
          x: pos.x,
          y: pos.y,
          z: pos.z,
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
        if (parsed) {
          setAlarmMessage(parsed.message);
          setAlarmCode(parsed.code);
        }
      } else if (next.state !== "Alarm") {
        setAlarmMessage(null);
        setAlarmCode(null);
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
      if (parsed) {
        setAlarmMessage(parsed.message);
        setAlarmCode(parsed.code);
      }
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
        const currentJob = jobRef.current;
        if (!currentJob) return;
        if (
          p.phase === "running" ||
          p.phase === "paused" ||
          p.phase === "tool-change" ||
          p.phase === "stopping" ||
          p.phase === "error"
        ) {
          const nextLine =
            typeof p.absoluteLine === "number"
              ? p.absoluteLine
              : p.ackedLines;
          const checkpoint = {
            jobName: currentJob.name,
            totalLines: currentJob.lines.length,
            nextLine: Math.min(nextLine, currentJob.lines.length),
            absoluteLine:
              typeof p.absoluteLine === "number" ? p.absoluteLine : null,
            work: { ...statusRef.current.work },
            machine: { ...statusRef.current.machine },
            phase: p.phase,
            savedAt: Date.now(),
            dryRun: dryRunRef.current,
          };
          saveJobRecoveryCheckpoint(checkpoint);
          setRecovery(checkpoint);
          setRecoveryVisible(true);
        } else if (p.phase === "completed") {
          clearJobRecoveryCheckpoint();
          setRecovery(null);
          setRecoveryVisible(false);
        }
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
    let cancelled = false;
    void (async () => {
      const version = await resolveAppVersion();
      if (cancelled) return;
      setAppVersion(version);
      // Quiet background check — never installs; only lights the version chip.
      try {
        const result = await checkLatestRelease(version);
        if (!cancelled && result.status === "update-available") {
          setUpdateAvailable(true);
        }
      } catch {
        // Offline / rate-limit: leave chip quiet; About panel shows detail.
      }
    })();
    return () => {
      cancelled = true;
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
    if (!aboutOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAboutOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aboutOpen]);

  useEffect(() => {
    if (!bedTravelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (
          bedTravelPhase === "running" ||
          bedTravelPhase === "paused"
        ) {
          return;
        }
        setBedTravelOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bedTravelOpen, bedTravelPhase]);

  useEffect(() => {
    if (!stockPerimeterOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (
          stockPerimeterPhase === "running" ||
          stockPerimeterPhase === "paused"
        ) {
          return;
        }
        setStockPerimeterOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stockPerimeterOpen, stockPerimeterPhase]);

  useEffect(() => {
    if (!prepareOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPrepareOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prepareOpen]);

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
      setAlarmCode(null);
      setPendingGoTo(null);
      setStreamProgress(null);
      setGrblSettings(null);
      setCalMessage(null);
      setCalBusy(false);
      setHomed(false);
      setHomeMessage(null);
      resetPrepareSession();
    }
  };

  const handleSoftReset = async () => {
    bedTravelAbortRef.current = true;
    stockPerimeterAbortRef.current = true;
    await stopContinuousJog();
    externalControlsRef.current.noteSoftwareAction("abort");
    if (streaming) {
      await streamerRef.current?.stop();
    }
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.softReset();
      setFeedOverridePercent(100);
      setRapidOverridePercent(100);
      setSpindleOverridePercent(100);
      setHomed(false);
      setErrorMessage(null);
      setSoftLimitHint(null);
      if (bedTravelRunningRef.current) {
        bedTravelRunningRef.current = false;
        setBedTravelPhase("aborted");
        setBedTravelMessage("Aborted by soft reset / E-Stop.");
      }
      if (stockPerimeterRunningRef.current) {
        stockPerimeterRunningRef.current = false;
        setStockPerimeterPhase("aborted");
        setStockPerimeterMessage("Aborted by soft reset / E-Stop.");
      }
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
        streamPhase === "tool-change" ||
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
      setAlarmCode(null);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const simulateMockAlarm = async (cmd: string, label: string) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await stopContinuousJog();
      if (streaming) await streamerRef.current?.stop();
      await client.sendLine(cmd);
      activityLog.append("event", label);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleSimulateAlarm = async () => {
    await simulateMockAlarm("$Alarm", "Simulated hard-limit alarm (mock)");
  };

  const handleSimulateSoftLimit = async () => {
    await simulateMockAlarm("$Alarm2", "Simulated soft-limit alarm (mock)");
  };

  const handleSimulateProbeFail = async () => {
    await simulateMockAlarm("$Alarm4", "Simulated probe-fail alarm (mock)");
  };

  const handleHome = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canHome(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setHomeMessage(gate.reason ?? "Cannot home");
      return;
    }
    setHomeBusy(true);
    setHomeMessage(null);
    try {
      await stopContinuousJog();
      await client.sendLine(HOME_COMMAND);
      // Allow the controller to enter Home before we treat Idle as “done”.
      await new Promise((r) => setTimeout(r, usingMock ? 120 : 400));
      const deadline = Date.now() + (usingMock ? 4000 : 120_000);
      let sawHome = statusRef.current.state === "Home";
      while (Date.now() < deadline) {
        await client.requestStatus();
        const st = statusRef.current.state;
        if (st === "Home") sawHome = true;
        if (st === "Alarm") {
          throw new Error(alarmMessage ?? "Homing failed (Alarm)");
        }
        if (st === "Idle" && (sawHome || usingMock)) break;
        await new Promise((r) => setTimeout(r, usingMock ? 80 : 250));
      }
      if (statusRef.current.state === "Alarm") {
        throw new Error(alarmMessage ?? "Homing failed (Alarm)");
      }
      setHomed(true);
      setHomeMessage("Homed — machine coordinates at home switches.");
      activityLog.append("event", "Homing ($H) complete");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setHomeMessage(message);
      setErrorMessage(message);
      setHomed(false);
    } finally {
      setHomeBusy(false);
    }
  };

  const handleClearHome = () => {
    setHomed(false);
    setHomeMessage(describeClearHomeState());
    activityLog.append("event", "Cleared SharpCNC home flag");
  };

  const updateWorkOffsets = (next: WorkOffsetsStore) => {
    setWorkOffsets(next);
    saveWorkOffsets(next);
  };

  const handleSelectWcs = async (id: WcsId) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.sendLine(buildSelectWcsCommand(id));
      updateWorkOffsets({ ...workOffsets, active: id });
      setOffsetsMessage(`Active ${id}`);
      activityLog.append("event", `WCS ${id}`);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOffsetsMessage(message);
    }
  };

  const handleSaveOffset = (id: WcsId) => {
    const slot = snapshotOffset(id, currentWco, id);
    updateWorkOffsets({
      ...workOffsets,
      active: id,
      slots: { ...workOffsets.slots, [id]: slot },
    });
    setOffsetsMessage(`Saved ${id} WCO`);
    activityLog.append("event", `Saved work offset ${id}`);
  };

  const handleRecallOffset = async (id: WcsId) => {
    const client = clientRef.current;
    const slot = workOffsets.slots[id];
    if (!client || !client.transport.isOpen || !slot) return;
    try {
      for (const line of buildRecallOffsetCommands(slot)) {
        await client.sendLine(line);
      }
      updateWorkOffsets({ ...workOffsets, active: id });
      setOffsetsMessage(`Recalled ${id}`);
      activityLog.append("event", `Recalled work offset ${id}`);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOffsetsMessage(message);
    }
  };

  const sendConsoleText = async (text: string) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canSendConsole(connected, streaming, statusRef.current.state);
    if (!gate.ok) {
      setConsoleResult(gate.reason ?? "Cannot send");
      return;
    }
    const parsed = parseConsoleLines(text);
    if (parsed.blocked) {
      setConsoleResult(parsed.blocked);
      return;
    }
    try {
      for (const line of parsed.lines) {
        await client.sendLine(line);
      }
      setConsoleResult(`Sent ${parsed.lines.length} line(s)`);
      activityLog.append("event", `Console: ${parsed.lines.length} line(s)`);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setConsoleResult(message);
    }
  };

  const handleSaveMacro = (name: string, body: string) => {
    const next = [...macros, createMacro(name, body)];
    setMacros(next);
    saveMacros(next);
    setConsoleResult(`Saved macro “${name}”`);
  };

  const handleDeleteMacro = (id: string) => {
    const next = macros.filter((m) => m.id !== id);
    setMacros(next);
    saveMacros(next);
  };

  const handleXyEdgeProbe = async (
    axis: "X" | "Y",
    direction: EdgeDirection,
  ) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canProbe(statusRef.current.state, connected, streaming, {
      probePinActive: !!statusRef.current.pins?.probe,
    });
    if (!gate.ok) {
      setXyProbeMessage(gate.reason ?? "Cannot probe");
      return;
    }
    setXyProbeBusy(true);
    setXyProbeMessage(null);
    try {
      const result = await runEdgeProbeCycle(client, {
        axis,
        direction,
        seekMm: xySeekMm,
        feedMmMin: xyFeedMmMin,
        workOffsetMm: 0,
        timeoutMs: usingMock ? 5000 : 20_000,
      });
      setXyProbeMessage(
        `Edge ${axis} set · ${result.workZeroCommand}`,
      );
      activityLog.append("event", `XY edge probe ${axis}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setXyProbeMessage(message);
      setErrorMessage(message);
    } finally {
      setXyProbeBusy(false);
    }
  };

  const handleXyCornerProbe = async (mode: "outside" | "inside") => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canProbe(statusRef.current.state, connected, streaming, {
      probePinActive: !!statusRef.current.pins?.probe,
    });
    if (!gate.ok) {
      setXyProbeMessage(gate.reason ?? "Cannot probe");
      return;
    }
    setXyProbeBusy(true);
    setXyProbeMessage(null);
    try {
      await runCornerProbeCycle(client, {
        mode,
        seekMm: xySeekMm,
        feedMmMin: xyFeedMmMin,
        bitRadiusMm: bitRadiusMm(tool.diameterMm),
        timeoutMs: usingMock ? 8000 : 30_000,
      });
      setXyProbeMessage(`Corner (${mode}) work XY set`);
      activityLog.append("event", `XY corner probe (${mode})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setXyProbeMessage(message);
      setErrorMessage(message);
    } finally {
      setXyProbeBusy(false);
    }
  };

  const handleToolLengthProbe = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canProbe(statusRef.current.state, connected, streaming, {
      probePinActive: !!statusRef.current.pins?.probe,
    });
    if (!gate.ok) {
      setXyProbeMessage(gate.reason ?? "Cannot probe");
      return;
    }
    setXyProbeBusy(true);
    setXyProbeMessage(null);
    try {
      const result = await runToolLengthProbeCycle(client, {
        plateThicknessMm: probeConfig.plateThicknessMm,
        seekMm: probeConfig.seekMm,
        feedMmMin: probeConfig.feedMmMin,
        timeoutMs: usingMock ? 5000 : 20_000,
      });
      setXyProbeMessage(`Tool length Z · ${result.workZeroCommand}`);
      activityLog.append("event", "Tool-length Z probe");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setXyProbeMessage(message);
      setErrorMessage(message);
    } finally {
      setXyProbeBusy(false);
    }
  };

  const handleRapidOverride = async (step: RapidOverrideStep) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.rapidOverride(rapidOverrideByte(step));
      const next = applyRapidOverrideStep(step);
      setRapidOverridePercent(next);
      persistOverrides(feedOverridePercent, next, spindleOverridePercent);
      activityLog.append("event", `Rapid override ${step}%`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleResumeToolChange = async () => {
    try {
      await streamerRef.current?.resumeAfterToolChange();
      activityLog.append("event", "Resumed after M6 tool change");
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
        `Moving ${axis} by ${distanceMm > 0 ? "+" : ""}${distanceMm} mm — watch direction / measure when Idle.`,
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

  const handleWriteDirInvert = async (mask: number) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot write settings");
      return;
    }
    const value = Math.trunc(mask) & 0b111;
    setCalBusy(true);
    setCalMessage(null);
    try {
      await writeGrblSetting(client, SETTING_DIR_PORT_INVERT, value, {
        timeoutMs: usingMock ? 1500 : 4000,
      });
      setGrblSettings((prev) => {
        const next = new Map(prev ?? []);
        next.set(SETTING_DIR_PORT_INVERT, {
          id: SETTING_DIR_PORT_INVERT,
          value,
        });
        return next;
      });
      const summary = describeDirInvertMask(value);
      activityLog.append(
        "event",
        `Wrote $${SETTING_DIR_PORT_INVERT}=${value} (invert ${summary})`,
      );
      setCalMessage(
        `Direction mask $${SETTING_DIR_PORT_INVERT}=${value} (${summary} inverted). Test jog to confirm.`,
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
      if (axes === "XYZ") {
        setPrepareXyZeroed(true);
        setPrepareZProbed(true);
        setPrepareReady(false);
      } else if (axes === "Z") {
        setPrepareZProbed(true);
        setPrepareReady(false);
      }
      activityLog.append("event", `Work zero ${axes}`);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handlePrepareZeroXy = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine("G10 L20 P1 X0 Y0");
      setPrepareXyZeroed(true);
      setPrepareReady(false);
      setPrepareMessage("Work XY zero set at current position (G10 L20).");
      setZeroMessage("Work XY zero set at current position (G10 L20).");
      activityLog.append("event", "Work zero XY (prepare)");
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
      setErrorMessage(message);
    }
  };

  /**
   * Primary stock placement: jog tip to a stock corner, then set work XY zero
   * and stock origin together so that corner sits at work (0,0).
   */
  const handleSetStockCornerFromToolhead = async (corner: StockCorner) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) {
      setPrepareMessage(
        !connected ? "Connect first." : "Stop the job before setting zero.",
      );
      return;
    }
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot set zero");
      setZeroMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine("G10 L20 P1 X0 Y0");
      const offsets = stockOffsetForWorkOriginCorner(stock, corner);
      handleStockChange({
        ...stock,
        ...offsets,
        originCorner: corner,
      });
      setPrepareXyZeroed(true);
      setPrepareReady(false);
      const label = corner.toUpperCase();
      const msg = `Work XY zero + stock ${label} at toolhead (G10 L20). Enter width / length from that corner.`;
      setPrepareMessage(msg);
      setZeroMessage(msg);
      activityLog.append(
        "event",
        `Work zero XY + stock origin ${label} (toolhead)`,
      );
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
      setZeroMessage(message);
      setErrorMessage(message);
    }
  };

  const handleRunZProbe = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canProbe(
      statusRef.current.state,
      connected,
      streaming,
      { probePinActive: !!statusRef.current.pins?.probe },
    );
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot probe");
      return;
    }
    setPrepareBusy(true);
    setPrepareMessage("Probing Z…");
    try {
      await stopContinuousJog();
      const outcome = await runZProbeCycle(client, {
        plateThicknessMm: probeConfig.plateThicknessMm,
        seekMm: probeConfig.seekMm,
        feedMmMin: probeConfig.feedMmMin,
      });
      setPrepareZProbed(true);
      setPrepareReady(false);
      const z = outcome.probe.machine.z.toFixed(3);
      setPrepareMessage(
        `Probe contact at machine Z=${z}. Work Z0 = stock top (plate ${probeConfig.plateThicknessMm} mm).`,
      );
      activityLog.append(
        "event",
        `Z probe OK [PRB:…:${outcome.probe.success ? 1 : 0}] → ${outcome.workZeroCommand ?? "no G10"}`,
      );
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
      setErrorMessage(message);
      activityLog.append("event", `Z probe failed: ${message}`);
      await client.requestStatus();
    } finally {
      setPrepareBusy(false);
    }
  };

  const handlePrepareManualZZero = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine(buildSetWorkZeroCommand("Z"));
      setPrepareZProbed(true);
      setPrepareReady(false);
      setPrepareMessage(
        "Manual work Z zero at current tip (paper feel / G10 L20).",
      );
      activityLog.append("event", "Work zero Z (manual prepare)");
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
    }
  };

  const handlePrepareRetract = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot retract");
      return;
    }
    setPrepareBusy(true);
    try {
      await stopContinuousJog();
      const cmd = buildProbeRetractCommand(
        probeConfig.retractWorkZMm,
        DEFAULT_JOG_FEED_MM_MIN,
      );
      await client.sendLine(cmd);
      setPrepareMessage(
        `Retracting to work Z=${probeConfig.retractWorkZMm} mm.`,
      );
      activityLog.append("event", `Probe retract ${cmd}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
    } finally {
      setPrepareBusy(false);
    }
  };

  const resetPrepareSession = () => {
    setPrepareXyZeroed(false);
    setPrepareZProbed(false);
    setPrepareReady(false);
    setPrepareMessage(null);
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
    setScrubIndex(0);
    setDryRun(false);
    setStreamProgress({
      phase: "idle",
      sentLines: 0,
      ackedLines: 0,
      totalLines: loaded.lines.length,
      percent: 0,
    });
    // New job → require Prepare again before Start.
    setPrepareReady(false);
    setRecentJobs(
      rememberRecentJob({
        name: loaded.name,
        text,
        kind: "gcode",
        lineCount: loaded.lines.length,
        path: loaded.path,
        bounds: loaded.bounds,
      }),
    );
    activityLog.append(
      "event",
      `Loaded ${name} (${loaded.lines.length} lines)`,
    );
  };

  const handleOpenRecent = (entry: RecentJobEntry) => {
    if (streaming || simulating) return;
    if (entry.kind === "svg") {
      applySvgText(entry.name, entry.text);
      return;
    }
    applyGcodeText(entry.name, entry.text);
  };

  const applySvgText = (name: string, text: string) => {
    try {
      const imported = importSvg(name, text);
      setSvgDraft(imported);
      setRecentJobs(
        rememberRecentJob({
          name,
          text,
          kind: "svg",
          lineCount: imported.polylines.length,
          path: [],
          bounds: imported.bounds
            ? {
                minX: imported.bounds.minX,
                minY: imported.bounds.minY,
                maxX: imported.bounds.maxX,
                maxY: imported.bounds.maxY,
              }
            : null,
        }),
      );
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
    setRecentJobs(
      rememberRecentJob({
        name: loaded.name,
        text: loaded.text,
        kind: "gcode",
        lineCount: loaded.lines.length,
        path: loaded.path,
        bounds: loaded.bounds,
      }),
    );
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
    setScrubIndex(0);
    setDryRun(false);
    resetPrepareSession();
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

    if (!prepareReady) {
      setErrorMessage(
        "Prepare to run first — confirm stock, zeros, and Z probe.",
      );
      setPrepareOpen(true);
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

    const startAt = clampScrubIndex(scrubIndex, job.lines.length);
    const sliced = job.lines.slice(startAt);
    const sourceLines = dryRun
      ? buildDryRunLines(sliced, { spindleOff: true })
      : sliced;

    await stopContinuousJog();
    setErrorMessage(null);
    externalControlsRef.current.noteSoftwareAction("start");
    activityLog.append(
      "event",
      `Job start: ${job.name}${dryRun ? " (dry run)" : ""}${startAt > 0 ? ` @ line ${startAt + 1}` : ""}`,
    );
    try {
      await streamer.start(sourceLines);
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

  const dismissRecovery = (clear = true) => {
    if (clear) clearJobRecoveryCheckpoint();
    setRecovery(null);
    setRecoveryVisible(false);
  };

  const handleRecoveryResume = () => {
    if (!recovery || !job) return;
    if (job.name !== recovery.jobName) {
      setErrorMessage(
        `Load job “${recovery.jobName}” before resuming from checkpoint.`,
      );
      return;
    }
    const line = clampScrubIndex(
      recovery.absoluteLine ?? recovery.nextLine,
      job.lines.length,
    );
    setScrubIndex(line);
    setDryRun(recovery.dryRun);
    setWorkspaceTab("job");
    setRecoveryVisible(true);
    activityLog.append(
      "event",
      `Recovery: scrub set to line ${line + 1} of ${job.lines.length}`,
    );
    setErrorMessage(
      `Checkpoint ready at line ${line + 1}. Confirm clear path, then Start.`,
    );
  };

  const handleSafeAbortRecovery = async () => {
    try {
      externalControlsRef.current.noteSoftwareAction("abort");
      await streamerRef.current?.stop();
    } catch {
      /* ignore — may already be idle */
    }
    const client = clientRef.current;
    if (client?.transport.isOpen) {
      try {
        await client.sendLine(buildSpindleOffCommand());
      } catch {
        /* ignore */
      }
    }
    dismissRecovery(true);
    setPrepareReady(false);
    activityLog.append("event", "Recovery: safe abort — checkpoint cleared");
  };

  const portLabel =
    phase === "connected"
      ? selectedPath || "Connected"
      : phase === "connecting"
        ? "Opening…"
        : selectedPath || "No port";

  const jogGate = canJogOrZero(status.state, connected, streaming);
  const jogEnabled = jogGate.ok;
  const softLimitsOn = grblSettings
    ? softLimitsEnabled(grblSettings)
    : false;

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

  const openBedTravelTest = () => {
    setCalOpen(false);
    setBedTravelOpen(true);
    setBedTravelMessage(null);
    if (bedTravelPhase === "done" || bedTravelPhase === "aborted") {
      setBedTravelPhase("idle");
      setBedTravelPlan(null);
      setBedTravelSegmentIndex(0);
    }
    if (connected && settingsGate.ok) {
      void handleRefreshSettings();
    }
  };

  const waitBedTravelIdle = async (client: GrblClient) => {
    const deadline = Date.now() + (usingMock ? 8000 : 180_000);
    await new Promise((r) => setTimeout(r, usingMock ? 40 : 80));
    while (Date.now() < deadline) {
      if (bedTravelAbortRef.current) return;
      await client.requestStatus().catch(() => undefined);
      const st = statusRef.current.state;
      if (st === "Alarm") {
        throw new Error(alarmMessage ?? "Alarm during bed travel test");
      }
      if (st === "Hold") {
        // Feed Hold — wait until resumed or abort.
        await new Promise((r) => setTimeout(r, usingMock ? 80 : 200));
        continue;
      }
      if (st === "Idle" || st === "Check") return;
      await new Promise((r) => setTimeout(r, usingMock ? 50 : 120));
    }
  };

  const handleBedTravelStart = async (plan: BedTravelPlan) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setBedTravelMessage(gate.reason ?? "Cannot start bed travel");
      return;
    }
    if (!plan.ok || plan.segments.length === 0) {
      setBedTravelMessage(plan.blocked ?? "No bed travel plan");
      return;
    }

    bedTravelAbortRef.current = false;
    bedTravelRunningRef.current = true;
    setBedTravelPlan(plan);
    setBedTravelSegmentIndex(0);
    setBedTravelPhase("running");
    setBedTravelMessage(
      plan.warnings.length
        ? `Running… ${plan.warnings.join(" ")}`
        : "Running bed travel test…",
    );
    activityLog.append(
      "event",
      `Bed travel test start (${plan.segments.length} segments)`,
    );

    try {
      await stopContinuousJog();
      for (let i = 0; i < plan.segments.length; i++) {
        if (bedTravelAbortRef.current || !bedTravelRunningRef.current) break;
        const seg = plan.segments[i]!;
        setBedTravelSegmentIndex(i);
        if (bedTravelSound && seg.proximityPulse) {
          playProximityBeep();
        }
        const check = checkSoftLimits(
          statusRef.current.machine,
          seg.delta,
          softTravel,
        );
        if (!check.ok) {
          throw new Error(check.reason ?? "Soft-limit gate blocked segment");
        }
        await client.sendLine(seg.command);
        activityLog.append(
          "event",
          `Bed travel ${seg.label} (${seg.phase} F${seg.feedMmMin})`,
        );
        await waitBedTravelIdle(client);
        if (bedTravelAbortRef.current || !bedTravelRunningRef.current) break;
        if (statusRef.current.state === "Alarm") {
          throw new Error(alarmMessage ?? "Alarm during bed travel test");
        }
      }

      if (bedTravelAbortRef.current || !bedTravelRunningRef.current) {
        setBedTravelPhase("aborted");
        setBedTravelMessage("Bed travel test aborted.");
        activityLog.append("event", "Bed travel test aborted");
      } else {
        setBedTravelSegmentIndex(plan.segments.length);
        setBedTravelPhase("done");
        setBedTravelMessage("Bed travel test complete — all corners visited.");
        activityLog.append("event", "Bed travel test complete");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBedTravelPhase("aborted");
      setBedTravelMessage(message);
      setErrorMessage(message);
      activityLog.append("event", `Bed travel test failed: ${message}`);
      try {
        await client.cancelJog();
      } catch {
        /* ignore */
      }
    } finally {
      bedTravelRunningRef.current = false;
    }
  };

  const handleBedTravelStop = async () => {
    bedTravelAbortRef.current = true;
    bedTravelRunningRef.current = false;
    setBedTravelPhase("paused");
    setBedTravelMessage("Stop — canceling jog…");
    activityLog.append("event", "Bed travel stop (cancel jog)");
    externalControlsRef.current.noteSoftwareAction("hold");
    await stopContinuousJog();
    const client = clientRef.current;
    if (client?.transport.isOpen) {
      try {
        await client.feedHold();
      } catch {
        /* ignore */
      }
      try {
        await client.cancelJog();
      } catch {
        /* ignore */
      }
    }
    setBedTravelPhase("aborted");
    setBedTravelMessage("Stopped — jog canceled. Re-confirm to restart.");
  };

  const handleBedTravelAbort = async () => {
    bedTravelAbortRef.current = true;
    bedTravelRunningRef.current = false;
    setBedTravelPhase("aborted");
    setBedTravelMessage("Abort — soft reset…");
    activityLog.append("event", "Bed travel abort");
    await handleEstop();
    setBedTravelMessage("Aborted. Unlock / re-home if needed, then re-confirm.");
  };

  const openStockPerimeterTest = () => {
    setPrepareOpen(false);
    setCalOpen(false);
    setBedTravelOpen(false);
    setStockPerimeterOpen(true);
    setStockPerimeterMessage(null);
    if (
      stockPerimeterPhase === "done" ||
      stockPerimeterPhase === "aborted"
    ) {
      setStockPerimeterPhase("idle");
      setStockPerimeterPlan(null);
      setStockPerimeterSegmentIndex(0);
    }
    if (connected && settingsGate.ok) {
      void handleRefreshSettings();
    }
  };

  const waitStockPerimeterIdle = async (client: GrblClient) => {
    const deadline = Date.now() + (usingMock ? 8000 : 180_000);
    await new Promise((r) => setTimeout(r, usingMock ? 40 : 80));
    while (Date.now() < deadline) {
      if (stockPerimeterAbortRef.current) return;
      await client.requestStatus().catch(() => undefined);
      const st = statusRef.current.state;
      if (st === "Alarm") {
        throw new Error(alarmMessage ?? "Alarm during stock perimeter");
      }
      if (st === "Hold") {
        await new Promise((r) => setTimeout(r, usingMock ? 80 : 200));
        continue;
      }
      if (st === "Idle" || st === "Check") return;
      await new Promise((r) => setTimeout(r, usingMock ? 50 : 120));
    }
  };

  const handleStockPerimeterStart = async (plan: StockPerimeterPlan) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setStockPerimeterMessage(gate.reason ?? "Cannot start stock perimeter");
      return;
    }
    if (!plan.ok || plan.segments.length === 0) {
      setStockPerimeterMessage(plan.blocked ?? "No stock perimeter plan");
      return;
    }

    stockPerimeterAbortRef.current = false;
    stockPerimeterRunningRef.current = true;
    setStockPerimeterPlan(plan);
    setStockPerimeterSegmentIndex(0);
    setStockPerimeterPhase("running");
    setStockPerimeterMessage(
      plan.warnings.length
        ? `Running… ${plan.warnings.join(" ")}`
        : "Tracing stock perimeter…",
    );
    activityLog.append(
      "event",
      `Stock perimeter start (${plan.segments.length} segments)`,
    );

    try {
      await stopContinuousJog();
      for (let i = 0; i < plan.segments.length; i++) {
        if (
          stockPerimeterAbortRef.current ||
          !stockPerimeterRunningRef.current
        ) {
          break;
        }
        const seg = plan.segments[i]!;
        setStockPerimeterSegmentIndex(i);
        if (stockPerimeterSound && seg.proximityPulse) {
          playProximityBeep();
        }
        const check = checkSoftLimits(
          statusRef.current.machine,
          seg.delta,
          softTravel,
        );
        if (!check.ok) {
          throw new Error(check.reason ?? "Soft-limit gate blocked segment");
        }
        await client.sendLine(seg.command);
        activityLog.append(
          "event",
          `Stock perimeter ${seg.label} (${seg.phase} F${seg.feedMmMin})`,
        );
        await waitStockPerimeterIdle(client);
        if (
          stockPerimeterAbortRef.current ||
          !stockPerimeterRunningRef.current
        ) {
          break;
        }
        if (statusRef.current.state === "Alarm") {
          throw new Error(alarmMessage ?? "Alarm during stock perimeter");
        }
      }

      if (
        stockPerimeterAbortRef.current ||
        !stockPerimeterRunningRef.current
      ) {
        setStockPerimeterPhase("aborted");
        setStockPerimeterMessage("Stock perimeter aborted.");
        activityLog.append("event", "Stock perimeter aborted");
      } else {
        setStockPerimeterSegmentIndex(plan.segments.length);
        setStockPerimeterPhase("done");
        setStockPerimeterMessage(
          "Stock perimeter complete — all blank corners visited.",
        );
        activityLog.append("event", "Stock perimeter complete");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStockPerimeterPhase("aborted");
      setStockPerimeterMessage(message);
      setErrorMessage(message);
      activityLog.append("event", `Stock perimeter failed: ${message}`);
      try {
        await client.cancelJog();
      } catch {
        /* ignore */
      }
    } finally {
      stockPerimeterRunningRef.current = false;
    }
  };

  const handleStockPerimeterStop = async () => {
    stockPerimeterAbortRef.current = true;
    stockPerimeterRunningRef.current = false;
    setStockPerimeterPhase("paused");
    setStockPerimeterMessage("Stop — canceling jog…");
    activityLog.append("event", "Stock perimeter stop (cancel jog)");
    externalControlsRef.current.noteSoftwareAction("hold");
    await stopContinuousJog();
    const client = clientRef.current;
    if (client?.transport.isOpen) {
      try {
        await client.feedHold();
      } catch {
        /* ignore */
      }
      try {
        await client.cancelJog();
      } catch {
        /* ignore */
      }
    }
    setStockPerimeterPhase("aborted");
    setStockPerimeterMessage("Stopped — jog canceled. Re-confirm to restart.");
  };

  const handleStockPerimeterAbort = async () => {
    stockPerimeterAbortRef.current = true;
    stockPerimeterRunningRef.current = false;
    setStockPerimeterPhase("aborted");
    setStockPerimeterMessage("Abort — soft reset…");
    activityLog.append("event", "Stock perimeter abort");
    await handleEstop();
    setStockPerimeterMessage(
      "Aborted. Unlock / re-home if needed, then re-confirm.",
    );
  };

  const openFirstRun = () => {
    setFirstRunStep("connect");
    setFirstRunMessage(null);
    setFirstRunOpen(true);
  };

  const finishFirstRun = (skipped: boolean) => {
    saveFirstRunCompleted(true);
    setFirstRunOpen(false);
    setFirstRunMessage(null);
    activityLog.append(
      "event",
      skipped ? "First-run setup skipped" : "First-run setup finished",
    );
  };

  const handleFirstRunSoftTravel = async () => {
    updateSoftTravel(softTravel);
    setFirstRunMessage(
      `Saved local soft travel X${softTravel.maxX ?? "—"} Y${softTravel.maxY ?? "—"} Z${softTravel.maxZ ?? "—"}`,
    );
    if (connected) {
      await handleApplySoftTravel(softTravel, true);
      setFirstRunMessage(
        (prev) => `${prev ?? "Saved"} · wrote GRBL max travel + $20=1`,
      );
    }
  };

  const openPrepareRun = () => {
    setPrepareOpen(true);
    setWorkspaceTab("job");
  };

  const handleProbeConfigChange = (next: ProbeConfig) => {
    setProbeConfig(next);
    saveProbeConfig(next);
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

  const handleFeedsChange = (next: FeedsSpeedsSelection) => {
    setFeeds(next);
    saveFeedsSpeedsSelection(next);
  };

  const handleApplyFeedsToSvg = () => {
    setFeedsApplyToken((n) => n + 1);
    activityLog.append(
      "event",
      `Applied feeds to SVG: F${feeds.feedMmMin} S${feeds.spindleRpm} (${feeds.material}/${feeds.cutStyle})`,
    );
  };

  const handleSpindleOn = async (rpm: number) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      const cmd = buildSpindleOnCommand(rpm);
      await client.sendLine(cmd);
      activityLog.append("event", `Spindle ${cmd}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleSpindleOff = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      const cmd = buildSpindleOffCommand();
      await client.sendLine(cmd);
      activityLog.append("event", "Spindle M5");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const persistOverrides = (
    feed: number,
    rapid: number,
    spindle: number,
  ) => {
    saveOverridePercents({ feed, rapid, spindle });
  };

  const handleFeedOverride = async (step: OverrideStep) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.feedOverride(feedOverrideByte(step));
      setFeedOverridePercent((p) => {
        const next = applyOverrideStep(p, step);
        persistOverrides(next, rapidOverridePercent, spindleOverridePercent);
        return next;
      });
      activityLog.append("event", `Feed override ${step}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleSpindleOverride = async (step: OverrideStep) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.spindleOverride(spindleOverrideByte(step));
      setSpindleOverridePercent((p) => {
        const next = applyOverrideStep(p, step);
        persistOverrides(feedOverridePercent, rapidOverridePercent, next);
        return next;
      });
      activityLog.append("event", `Spindle override ${step}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handlePlaceStockCorner = (corner: StockCorner) => {
    const offsets = stockOffsetForCorner(
      stock,
      corner,
      bedMm.width,
      bedMm.depth,
    );
    const { originCorner: _drop, ...rest } = stock;
    void _drop;
    handleStockChange({ ...rest, ...offsets });
  };

  return (
    <div className="shell">
      <div className="shell__atmosphere" aria-hidden />

      <header className="brand">
        <div className="brand__lead">
          <div className="brand__text">
            <p className="brand__mark">SharpCNC</p>
            <p className="brand__tag">
              One machine. Clear position. Run the job.
            </p>
          </div>
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
        </div>
        <div className="brand__actions">
          <button
            type="button"
            className={`brand__version${updateAvailable ? " is-update" : ""}`}
            data-testid="app-version-chip"
            title={
              updateAvailable
                ? "Update available — open About & updates"
                : "About SharpCNC & updates"
            }
            onClick={() => setAboutOpen(true)}
          >
            {formatVersionLabel(appVersion)}
            {updateAvailable ? (
              <span className="brand__version-badge">Update</span>
            ) : null}
          </button>
          <AppMenu
            onOpenCalibration={openCalibration}
            onOpenBedTravelTest={openBedTravelTest}
            onOpenStockPerimeter={openStockPerimeterTest}
            onOpenPrepareRun={openPrepareRun}
            onOpenMaterialTool={openMaterialTool}
            onOpenExternalJobs={openExternalJobs}
            onOpenFirstRun={openFirstRun}
            onOpenAbout={() => setAboutOpen(true)}
            debugMode={debugMode}
            onDebugModeChange={handleDebugModeChange}
            theme={theme}
            onThemeChange={handleThemeChange}
            versionLabel={formatVersionLabel(appVersion)}
            updateAvailable={updateAvailable}
          />
        </div>
      </header>

      <div className="shell__stage">
        <div className="shell__main">
          <section className="shell__chrome" aria-label="Position and safety">
            <div className="shell__chrome-row">
              <CoordinateReadout status={status} />
              <SafetyControls
                connected={connected}
                machineState={status.state}
                alarmMessage={alarmMessage}
                alarmGuide={alarmGuide}
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
                onSimulateSoftLimit={() => {
                  void handleSimulateSoftLimit();
                }}
                onSimulateProbeFail={() => {
                  void handleSimulateProbeFail();
                }}
              />
            </div>
            <OverridesStrip
              visible={
                streaming || status.state === "Run" || status.state === "Hold"
              }
              feedPercent={liveFeedPercent}
              rapidPercent={liveRapidPercent}
              spindlePercent={liveSpindlePercent}
              feedRate={status.feedRate}
              spindleSpeed={status.spindleSpeed}
              connected={connected}
              onFeedOverride={(step) => {
                void handleFeedOverride(step);
              }}
              onSpindleOverride={(step) => {
                void handleSpindleOverride(step);
              }}
              onRapidOverride={(step) => {
                void handleRapidOverride(step);
              }}
            />
            {recoveryVisible && recovery ? (
              <div className="recovery-banner" role="status">
                <span>
                  Interrupted job <strong>{recovery.jobName}</strong> — open Job
                  for recovery (where am I / unlock / resume / abort).
                </span>
                <button
                  type="button"
                  className="recovery-banner__btn"
                  onClick={() => setWorkspaceTab("job")}
                >
                  Open Job
                </button>
              </div>
            ) : null}
          </section>

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
            onStockChange={handleStockChange}
            toolDiameterMm={tool.diameterMm}
            trail={trail}
            liveMoving={liveMoving}
            simulating={simulating}
            simActivity={simulating ? sim.activity : null}
            wco={status.wco ?? currentWco}
            overlay={
              job && job.path.length > 0 ? (
                <div className="machine__overlay">
                  <SimControls
                    variant="overlay"
                    phase={sim.phase}
                    progress={sim.progress}
                    speed={simSpeed}
                    onSpeedChange={setSimSpeed}
                    zMm={simulating ? sim.position.z : null}
                    activity={simulating ? sim.activity : null}
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
                  className="workspace__panel workspace__panel--move"
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
                  <HomingPanel
                    enabled={
                      canHome(status.state, connected, streaming).ok && !homeBusy
                    }
                    blockedReason={
                      canHome(status.state, connected, streaming).reason ?? null
                    }
                    homed={homed}
                    busy={homeBusy}
                    message={homeMessage}
                    onHome={() => {
                      void handleHome();
                    }}
                    onClearHome={handleClearHome}
                  />
                  <WorkOffsetsPanel
                    enabled={jogEnabled}
                    active={workOffsets.active}
                    slots={workOffsets.slots}
                    currentWco={currentWco}
                    message={offsetsMessage}
                    onSelect={(id) => {
                      void handleSelectWcs(id);
                    }}
                    onSave={handleSaveOffset}
                    onRecall={(id) => {
                      void handleRecallOffset(id);
                    }}
                  />
                  <ConsolePanel
                    enabled={
                      canSendConsole(connected, streaming, status.state).ok
                    }
                    blockedReason={
                      canSendConsole(connected, streaming, status.state)
                        .reason ?? null
                    }
                    macros={macros}
                    lastResult={consoleResult}
                    onSend={(text) => {
                      void sendConsoleText(text);
                    }}
                    onRunMacro={(macro) => {
                      void sendConsoleText(macro.body);
                    }}
                    onSaveMacro={handleSaveMacro}
                    onDeleteMacro={handleDeleteMacro}
                  />
                  <SpindleFeedPanel
                    connected={connected}
                    feedRate={status.feedRate}
                    spindleSpeed={status.spindleSpeed}
                    feedOverridePercent={feedOverridePercent}
                    spindleOverridePercent={spindleOverridePercent}
                    busyAlarm={status.state === "Alarm"}
                    onSpindleOn={(rpm) => {
                      void handleSpindleOn(rpm);
                    }}
                    onSpindleOff={() => {
                      void handleSpindleOff();
                    }}
                    onFeedOverride={(step) => {
                      void handleFeedOverride(step);
                    }}
                    onSpindleOverride={(step) => {
                      void handleSpindleOverride(step);
                    }}
                  />
                </div>
              )}

              {workspaceTab === "probe" && (
                <div
                  className="workspace__panel"
                  role="tabpanel"
                  id="workspace-panel-probe"
                  aria-labelledby="workspace-tab-probe"
                >
                  <p className="workspace__intro">
                    Probe only: XY edges / corners and tool-length Z. Keep the
                    plate path clear. Full prepare / Z0 for a job still uses{" "}
                    <strong>Prepare to run…</strong> on the Job tab.
                  </p>
                  <ProbeXyPanel
                    enabled={
                      canProbe(status.state, connected, streaming, {
                        probePinActive: !!status.pins?.probe,
                      }).ok && !xyProbeBusy
                    }
                    blockedReason={
                      canProbe(status.state, connected, streaming, {
                        probePinActive: !!status.pins?.probe,
                      }).reason ?? null
                    }
                    busy={xyProbeBusy}
                    bitDiameterMm={tool.diameterMm}
                    seekMm={xySeekMm}
                    feedMmMin={xyFeedMmMin}
                    plateThicknessMm={probeConfig.plateThicknessMm}
                    message={xyProbeMessage}
                    onSeekChange={setXySeekMm}
                    onFeedChange={setXyFeedMmMin}
                    onEdge={(axis, direction) => {
                      void handleXyEdgeProbe(axis, direction);
                    }}
                    onCorner={(mode) => {
                      void handleXyCornerProbe(mode);
                    }}
                    onToolLength={() => {
                      void handleToolLengthProbe();
                    }}
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
                  <p className="workspace__intro">
                    Material, files, prepare, simulate, and Start. Jog on{" "}
                    <strong>Move</strong>; touch-offs on <strong>Probe</strong>.
                  </p>
                  {recoveryVisible && recovery ? (
                    <CrashRecoveryPanel
                      checkpoint={recovery}
                      connected={connected}
                      machineState={status.state}
                      alarmMessage={alarmMessage}
                      workPos={status.work}
                      machinePos={status.machine}
                      jobLoaded={!!job}
                      jobMatches={!!job && job.name === recovery.jobName}
                      onUnlock={() => {
                        void handleUnlock();
                      }}
                      onResumeFromCheckpoint={handleRecoveryResume}
                      onSafeAbort={() => {
                        void handleSafeAbortRecovery();
                      }}
                      onDismiss={() => dismissRecovery(true)}
                    />
                  ) : null}
                  <div
                    className={`mattool-anchor${matToolHighlight ? " is-flash" : ""}`}
                    id="material-tool-settings"
                  >
                    <MaterialToolPanel
                      stock={stock}
                      tool={tool}
                      bedMm={bedMm}
                      feeds={feeds}
                      zeroEnabled={jogEnabled}
                      onStockChange={handleStockChange}
                      onToolChange={handleToolChange}
                      onPlaceCorner={handlePlaceStockCorner}
                      onSetCornerFromToolhead={(corner) => {
                        void handleSetStockCornerFromToolhead(corner);
                      }}
                      onOpenStockPerimeter={openStockPerimeterTest}
                      onFeedsChange={handleFeedsChange}
                      onApplyToSvg={handleApplyFeedsToSvg}
                    />
                  </div>
                  <RecentJobsPanel
                    entries={recentJobs}
                    busy={streaming || simulating}
                    onOpen={handleOpenRecent}
                    onRemove={(id) => setRecentJobs(removeRecentJob(id))}
                  />
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
                    feeds={feeds}
                    feedsApplyToken={feedsApplyToken}
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
                    simSpeed={simSpeed}
                    onSimSpeedChange={setSimSpeed}
                    simZMm={simulating ? sim.position.z : null}
                    simActivity={simulating ? sim.activity : null}
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
                    onPrepareRun={openPrepareRun}
                    prepareReady={prepareReady}
                    scrubIndex={scrubIndex}
                    onScrubIndexChange={setScrubIndex}
                    timeEstimate={jobTimeEstimate}
                    dryRun={dryRun}
                    onDryRunChange={setDryRun}
                    onResumeToolChange={() => {
                      void handleResumeToolChange();
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

      {aboutOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="About SharpCNC"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close About"
            onClick={() => setAboutOpen(false)}
          />
          <div className="cal-modal__sheet">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">SharpCNC</p>
                <h2 className="cal-modal__title">About &amp; updates</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                onClick={() => setAboutOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <AboutUpdatePanel
                currentVersion={appVersion}
                onUpdateAvailabilityChange={setUpdateAvailable}
              />
            </div>
          </div>
        </div>
      )}

      {firstRunOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="First-run setup"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close first-run setup"
            onClick={() => finishFirstRun(true)}
          />
          <div className="cal-modal__sheet">
            <FirstRunWizard
              step={firstRunStep}
              connected={connected}
              homed={homed}
              homeBusy={homeBusy}
              homeBlockedReason={
                canHome(status.state, connected, streaming).reason ?? null
              }
              homeMessage={homeMessage}
              softTravel={softTravel}
              stock={stock}
              message={firstRunMessage}
              onStepChange={setFirstRunStep}
              onRefreshPorts={() => {
                void refreshPorts();
              }}
              onConnect={() => {
                void handleConnect();
              }}
              onHome={() => {
                void handleHome();
              }}
              onOpenCalibration={() => {
                openCalibration();
              }}
              onSoftTravelChange={updateSoftTravel}
              onApplySoftTravel={() => {
                void handleFirstRunSoftTravel();
              }}
              onStockChange={handleStockChange}
              onComplete={() => finishFirstRun(false)}
              onSkip={() => finishFirstRun(true)}
            />
          </div>
        </div>
      )}

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
                <p className="cal-modal__eyebrow">Once per machine</p>
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
                onWriteDirInvert={(mask) => {
                  void handleWriteDirInvert(mask);
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
                onOpenBedTravelTest={openBedTravelTest}
              />
            </div>
          </div>
        </div>
      )}

      {bedTravelOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Bed travel test"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close bed travel test"
            disabled={
              bedTravelPhase === "running" || bedTravelPhase === "paused"
            }
            onClick={() => {
              if (
                bedTravelPhase === "running" ||
                bedTravelPhase === "paused"
              ) {
                return;
              }
              setBedTravelOpen(false);
            }}
          />
          <div className="cal-modal__sheet cal-modal__sheet--wide">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">After calibration</p>
                <h2 className="cal-modal__title">Bed travel test</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                disabled={
                  bedTravelPhase === "running" || bedTravelPhase === "paused"
                }
                onClick={() => setBedTravelOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <BedTravelTestPanel
                enabled={jogEnabled && !streaming}
                blockedReason={
                  !connected
                    ? "Connect first."
                    : streaming
                      ? "Stop the job first."
                      : !jogGate.ok
                        ? (jogGate.reason ?? "Motion locked")
                        : null
                }
                softTravel={softTravel}
                softLimitsOn={softLimitsOn}
                status={status}
                machinePos={status.machine}
                runPhase={bedTravelPhase}
                segmentIndex={bedTravelSegmentIndex}
                plan={bedTravelPlan}
                message={bedTravelMessage}
                soundEnabled={bedTravelSound}
                onSoundEnabledChange={setBedTravelSound}
                onStart={(plan) => {
                  void handleBedTravelStart(plan);
                }}
                onStop={() => {
                  void handleBedTravelStop();
                }}
                onAbort={() => {
                  void handleBedTravelAbort();
                }}
                onClose={() => setBedTravelOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {stockPerimeterOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Trace stock perimeter"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close stock perimeter"
            disabled={
              stockPerimeterPhase === "running" ||
              stockPerimeterPhase === "paused"
            }
            onClick={() => {
              if (
                stockPerimeterPhase === "running" ||
                stockPerimeterPhase === "paused"
              ) {
                return;
              }
              setStockPerimeterOpen(false);
            }}
          />
          <div className="cal-modal__sheet cal-modal__sheet--wide">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">After stock setup</p>
                <h2 className="cal-modal__title">Trace stock perimeter</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                disabled={
                  stockPerimeterPhase === "running" ||
                  stockPerimeterPhase === "paused"
                }
                onClick={() => setStockPerimeterOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <StockPerimeterTestPanel
                enabled={jogEnabled && !streaming}
                blockedReason={
                  !connected
                    ? "Connect first."
                    : streaming
                      ? "Stop the job first."
                      : !jogGate.ok
                        ? (jogGate.reason ?? "Motion locked")
                        : null
                }
                softTravel={softTravel}
                softLimitsOn={softLimitsOn}
                stock={stock}
                wco={currentWco}
                status={status}
                machinePos={status.machine}
                runPhase={stockPerimeterPhase}
                segmentIndex={stockPerimeterSegmentIndex}
                plan={stockPerimeterPlan}
                message={stockPerimeterMessage}
                soundEnabled={stockPerimeterSound}
                onSoundEnabledChange={setStockPerimeterSound}
                onStart={(plan) => {
                  void handleStockPerimeterStart(plan);
                }}
                onStop={() => {
                  void handleStockPerimeterStop();
                }}
                onAbort={() => {
                  void handleStockPerimeterAbort();
                }}
                onClose={() => setStockPerimeterOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {prepareOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Prepare to run"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close prepare wizard"
            onClick={() => setPrepareOpen(false)}
          />
          <div className="cal-modal__sheet cal-modal__sheet--wide">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">Every job · after calibration</p>
                <h2 className="cal-modal__title">Prepare to run</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                onClick={() => setPrepareOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <PrepareRunPanel
                enabled={connected && !streaming && !prepareBusy}
                blockedReason={
                  !connected
                    ? "Connect first."
                    : streaming
                      ? "Stop the job before preparing."
                      : prepareBusy
                        ? "Probe / motion in progress…"
                        : null
                }
                status={status}
                stock={stock}
                tool={tool}
                probe={probeConfig}
                softTravel={softTravel}
                bedMm={bedMm}
                jogEnabled={jogEnabled}
                probeEnabled={
                  canProbe(status.state, connected, streaming, {
                    probePinActive: !!status.pins?.probe,
                  }).ok && !prepareBusy
                }
                probeBlockedReason={
                  canProbe(status.state, connected, streaming, {
                    probePinActive: !!status.pins?.probe,
                  }).reason ?? null
                }
                busy={prepareBusy}
                message={prepareMessage}
                zProbed={prepareZProbed}
                xyZeroed={prepareXyZeroed}
                jogMode={jogMode}
                stepMm={stepMm}
                feedMmMin={feedMmMin}
                softLimitHint={softLimitHint}
                onStockChange={handleStockChange}
                onToolChange={handleToolChange}
                onPlaceCorner={handlePlaceStockCorner}
                onSetCornerFromToolhead={(corner) => {
                  void handleSetStockCornerFromToolhead(corner);
                }}
                onProbeChange={handleProbeConfigChange}
                onJogModeChange={setJogMode}
                onStepChange={setStepMm}
                onFeedChange={setFeedMmMin}
                onJog={handleJog}
                onJogEnd={handleJogEnd}
                onZeroXy={() => {
                  void handlePrepareZeroXy();
                }}
                onRunProbe={() => {
                  void handleRunZProbe();
                }}
                onManualZZero={() => {
                  void handlePrepareManualZZero();
                }}
                onRetract={() => {
                  void handlePrepareRetract();
                }}
                onConfirmReady={() => {
                  setPrepareReady(true);
                  setPrepareMessage(
                    "Ready — Start is unlocked for this session.",
                  );
                  activityLog.append("event", "Prepare ready — Start unlocked");
                }}
                onOpenStockPerimeter={openStockPerimeterTest}
                onClose={() => setPrepareOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
