import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { AdvancedPanel } from "./components/AdvancedPanel";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { ConnectPanel, type ConnectionPhase } from "./components/ConnectPanel";
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
import { JobLoad } from "./components/JobLoad";
import { JogPanel, type JogAxisMap } from "./components/JogPanel";
import { ZGauge } from "./components/ZGauge";
import { MachineView, type TrailPoint } from "./components/MachineView";
import { OverridesStrip } from "./components/OverridesStrip";
import {
  PrepareRunPanel,
  type PrepareStepId,
} from "./components/PrepareRunPanel";
import { RecentJobsPanel } from "./components/RecentJobsPanel";
import { SafetyControls } from "./components/SafetyControls";
import { SimControls } from "./components/SimControls";
import { SvgJobPanel } from "./components/SvgJobPanel";
import { PhaseSwitcher } from "./components/PhaseSwitcher";
import {
  DEFAULT_JOG_FEED_MM_MIN,
  JOG_STEP_OPTIONS_MM,
  SETTING_DIR_PORT_INVERT,
  SETTING_HARD_LIMITS,
  SETTING_SOFT_LIMITS,
  SOFT_LIMITS_WORKING_COPY,
  STEPS_SETTING_FOR_AXIS,
  buildJogCommand,
  plainSoftLimitsNeedHoming,
  runSoftLimitVerifyJog,
  softLimitVerifyDelta,
  buildRatesTrialLines,
  canFitRatesTest,
  clearPendingRatesRestore,
  extLimitCommandForAxis,
  homingAlarmPlainDetail,
  homingSettingPlainLabel,
  homingSettingUnit,
  loadPendingRatesRestore,
  mergePendingRatesRestore,
  ratesSettingId,
  ratesSettingPlainLabel,
  ratesSettingUnit,
  savePendingRatesRestore,
  describeDirInvertMask,
  HOME_COMMAND,
  UNLOCK_COMMAND,
  advanceSim,
  applyOverrideStep,
  applyRapidOverrideStep,
  bedSizeFromLimits,
  bitRadiusMm,
  buildResumePreamble,
  buildToolChangeSpindleRestore,
  buildToolChangeSpindleStop,
  canContinueToolChange,
  RESUME_BACKOFF_LINES,
  dryRunJobLines,
  dryRunLiftMm,
  scanResumeState,
  buildJobFromSvg,
  buildProbeRetractCommand,
  buildRecallOffsetCommands,
  buildSelectWcsCommand,
  buildSetWorkZeroCommand,
  buildSpindleOffCommand,
  canHome,
  canJogOrZero,
  canProbe,
  canRunPrepareZProbe,
  canSendConsole,
  canStartJob,
  canWriteSettings,
  checkJobSoftLimits,
  checkLatestRelease,
  checkSoftLimits,
  clampJogDelta,
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
  dismissSimNudge,
  emptyVerifyChecklist,
  estimateJobTimeFromJob,
  feedOverrideByte,
  fetchGrblSettings,
  firstConnectedGamepad,
  formatVersionLabel,
  gateForPhase,
  guideForAlarm,
  importSvg,
  initialDryRun,
  isDesktopShell,
  isGrblResetBanner,
  isIncompleteRecovery,
  isVirtualCncPath,
  jogDeltaFromAxes,
  listAvailablePorts,
  mapGamepadToJog,
  pressedButtonSet,
  loadCalibrationState,
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
  loadShellRailWidth,
  loadSoftTravel,
  loadStock,
  loadTool,
  loadUiTheme,
  loadVerifyRunState,
  loadWorkOffsets,
  clampShellRailWidthForStage,
  MAX_SHELL_RAIL_WIDTH_PX,
  MIN_SHELL_RAIL_WIDTH_PX,
  markStartedOnRealMachine,
  packagedAppVersion,
  phaseAfterConnect,
  phaseAfterStreamEnds,
  resolveAppVersion,
  saveCalibrationCompleted,
  saveDryRunPreferred,
  saveFirstRunCompleted,
  verifyChecklistComplete,
  OFFLINE_STATUS,
  parseAlarmLine,
  parseConsoleLines,
  pauseSim,
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
  saveJobRecoveryCheckpoint,
  saveJobsFolderConfig,
  saveMacros,
  saveOverridePercents,
  saveProbeConfig,
  saveSoftTravel,
  saveStock,
  saveTool,
  saveShellRailWidth,
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
  diffSettings,
  formatCalibrateUndoLabel,
  loadSettingsBackups,
  popCalibrateUndo,
  pushCalibrateUndo,
  pushSettingsBackup,
  restoreWriteEntries,
  saveSettingsBackupFile,
  type Axis,
  type CalibrateWriteEntry,
  type LimitAxis,
  type SettingsSnapshot,
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
  type RatesKind,
  type RapidOverrideStep,
  type RecentJobEntry,
  type SimSpeedRate,
  type BedTravelPlan,
  type StockPerimeterPlan,
  type Position3,
  type SoftTravelLimits,
  type StockConfig,
  type StockCorner,
  type StreamPhase,
  type StreamProgress,
  type SvgImportResult,
  type SvgToolpathParams,
  type TaskPhaseId,
  type ToolConfig,
  type UiTheme,
  type VerifyChecklistState,
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
  /** Pending machine target after in-flight jogs (soft-limit clamp cursor). */
  const jogSoftCursorRef = useRef<Position3 | null>(null);
  const softTravelRef = useRef<SoftTravelLimits>(loadSoftTravel());
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
  const [gamepadStatus, setGamepadStatus] = useState<string | null>(null);
  const gamepadPrevButtonsRef = useRef<Set<number>>(new Set());
  const gamepadHoldRef = useRef(false);
  const sendJogDeltaRef = useRef<
    (axes: JogAxisMap, continuous: boolean) => Promise<void>
  >(async () => undefined);
  const stopContinuousJogRef = useRef<() => Promise<void>>(async () => undefined);
  const [stepMm, setStepMm] = useState<number>(JOG_STEP_OPTIONS_MM[1]);
  const [feedMmMin, setFeedMmMin] = useState(DEFAULT_JOG_FEED_MM_MIN);
  const [softLimitHint, setSoftLimitHint] = useState<string | null>(null);
  const [zeroMessage, setZeroMessage] = useState<string | null>(null);

  const [job, setJob] = useState<LoadedJob | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(
    null,
  );
  /** Spindle-safe M6 UI: Idle → M5 → re-probe / same-length → restore → resume. */
  const [toolChangeUi, setToolChangeUi] = useState<{
    waitingForIdle: boolean;
    spindleStopped: boolean;
    zReprobed: boolean;
    sameToolLength: boolean;
    busy: boolean;
    statusNote: string | null;
  } | null>(null);
  const toolChangeArmRef = useRef(0);
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
  const [feeds] = useState<FeedsSpeedsSelection>(() =>
    loadFeedsSpeedsSelection(),
  );
  const feedsApplyToken = 0;
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
  /**
   * Set by E-Stop. Blocks every motion gate (jog, home, probe, start, test
   * loops) until the operator explicitly clears it. GRBL may be Idle after a
   * soft reset at rest, so we cannot rely on its Alarm state alone.
   */
  const [estopLatched, setEstopLatchedState] = useState(false);
  const estopLatchedRef = useRef(false);
  /** Latest Hold handler for the Space shortcut (M4) without re-binding keys. */
  const handleHoldRef = useRef<() => Promise<void>>(async () => {});
  const setEstopLatched = (value: boolean) => {
    estopLatchedRef.current = value;
    setEstopLatchedState(value);
  };
  /** Machine state as seen by motion gates — E-Stop latch reads as a lock. */
  const gateStateLive = (): GrblStatus["state"] =>
    estopLatchedRef.current ? "EStopLatched" : statusRef.current.state;
  const gateState: GrblStatus["state"] = estopLatched
    ? "EStopLatched"
    : status.state;
  const [homeBusy, setHomeBusy] = useState(false);
  const [homeMessage, setHomeMessage] = useState<string | null>(null);
  const [workOffsets, setWorkOffsets] = useState<WorkOffsetsStore>(() =>
    loadWorkOffsets(),
  );
  const [offsetsMessage, setOffsetsMessage] = useState<string | null>(null);
  const [macros, setMacros] = useState<GcodeMacro[]>(() => loadMacros());
  const [consoleResult, setConsoleResult] = useState<string | null>(null);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [verifyRunPrefs, setVerifyRunPrefs] = useState(() =>
    loadVerifyRunState(),
  );
  const [dryRun, setDryRun] = useState(() =>
    initialDryRun(loadVerifyRunState(), false),
  );
  const [verifyChecklist, setVerifyChecklist] = useState<VerifyChecklistState>(
    () => emptyVerifyChecklist(),
  );
  const [recovery, setRecovery] = useState<JobRecoveryCheckpoint | null>(() => {
    const cp = loadJobRecoveryCheckpoint();
    return isIncompleteRecovery(cp) ? cp : null;
  });
  const [recoveryVisible, setRecoveryVisible] = useState(
    () => isIncompleteRecovery(loadJobRecoveryCheckpoint()),
  );
  const [xyProbeBusy, setXyProbeBusy] = useState(false);
  const [xyProbeMessage, setXyProbeMessage] = useState<string | null>(null);
  const xySeekMm = 20;
  const xyFeedMmMin = 80;
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
  /** Session-only Calibrate write undo stack (newest at end). */
  const [calUndoStack, setCalUndoStack] = useState<CalibrateWriteEntry[]>([]);
  /** Rates/accel out-and-back trial in progress. */
  const [ratesTrialRunning, setRatesTrialRunning] = useState(false);
  const ratesTrialAbortRef = useRef(false);
  const ratesTrialRunningRef = useRef(false);
  /** True while Calibrate holds temporary rate/accel trial writes this session. */
  const ratesTempActiveRef = useRef(false);
  const wasConnectedRef = useRef(false);
  /** Persisted $$ snapshots (auto-backup + download). */
  const [settingsBackups, setSettingsBackups] = useState(() =>
    loadSettingsBackups(),
  );
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  /** One auto-backup per connection session on first successful $$ load. */
  const sessionSettingsBackupTakenRef = useRef(false);
  const [taskPhase, setTaskPhase] = useState<TaskPhaseId>("connect");
  const [calibrationCompleted, setCalibrationCompleted] = useState(
    () => loadCalibrationState().calibrationCompleted,
  );
  const [calOpen, setCalOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const [aboutOpen, setAboutOpen] = useState(false);
  /** Deep-link into a Prepare step from Menu (stock / load). */
  const [prepareFocusStep, setPrepareFocusStep] =
    useState<PrepareStepId | null>(null);
  const [prepareShowExternal, setPrepareShowExternal] = useState(false);
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
  /** Latch when Inputs probe pin (`Pn:P`) lights during Prepare continuity check. */
  const [prepareProbeContinuityOk, setPrepareProbeContinuityOk] =
    useState(false);
  const [prepareReady, setPrepareReady] = useState(false);
  const [prepareMessage, setPrepareMessage] = useState<string | null>(null);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [recentJobs, setRecentJobs] = useState<RecentJobEntry[]>(() =>
    loadRecentJobs(),
  );
  /** Debug mode chrome (Export / Copy / bridge) — persisted; default off. */
  const [debugMode, setDebugMode] = useState(() => loadDebugMode());
  /** Color theme — persisted; default dark workshop. */
  const [theme, setTheme] = useState<UiTheme>(() => loadUiTheme());
  /** Right phase-rail width — persisted; drag the splitter to adjust. */
  const [railWidthPx, setRailWidthPx] = useState(() => loadShellRailWidth());
  const [railResizing, setRailResizing] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const railWidthRef = useRef(railWidthPx);
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

  const applyRailWidth = (nextPx: number, stageWidthPx?: number) => {
    const stageW =
      stageWidthPx ?? stageRef.current?.getBoundingClientRect().width ?? 0;
    const clamped = clampShellRailWidthForStage(nextPx, stageW);
    railWidthRef.current = clamped;
    setRailWidthPx(clamped);
    return clamped;
  };

  useEffect(() => {
    const onResize = () => {
      const stageW = stageRef.current?.getBoundingClientRect().width ?? 0;
      if (stageW <= 0) return;
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
        return;
      }
      const next = clampShellRailWidthForStage(railWidthRef.current, stageW);
      if (next !== railWidthRef.current) {
        railWidthRef.current = next;
        setRailWidthPx(next);
        saveShellRailWidth(next);
      }
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleRailResizePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      return;
    }
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setRailResizing(true);
    const startX = event.clientX;
    const startWidth = railWidthRef.current;
    const stageWidth = stageRef.current?.getBoundingClientRect().width ?? 0;

    const onMove = (ev: PointerEvent) => {
      // Splitter is left of the rail: drag left → wider rail.
      applyRailWidth(startWidth + (startX - ev.clientX), stageWidth);
    };
    const onUp = (ev: PointerEvent) => {
      if (handle.hasPointerCapture(ev.pointerId)) {
        handle.releasePointerCapture(ev.pointerId);
      }
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setRailResizing(false);
      saveShellRailWidth(railWidthRef.current);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const handleRailResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const step = event.shiftKey ? 32 : 16;
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = railWidthRef.current + step;
    else if (event.key === "ArrowRight") next = railWidthRef.current - step;
    else if (event.key === "Home") next = MIN_SHELL_RAIL_WIDTH_PX;
    else if (event.key === "End") next = MAX_SHELL_RAIL_WIDTH_PX;
    if (next === null) return;
    event.preventDefault();
    saveShellRailWidth(applyRailWidth(next));
  };

  /** Simulator timeouts + mock alarm UI when Virtual CNC is selected (desktop or browser). */
  const usingMock = isVirtualCncPath(selectedPath) || !isDesktopShell();
  const usingVirtualCnc = isVirtualCncPath(selectedPath);
  const connected = phase === "connected";
  const bedMm = bedSizeFromLimits(softTravel);

  const streaming =
    streamProgress?.phase === "running" ||
    streamProgress?.phase === "paused" ||
    streamProgress?.phase === "tool-change" ||
    streamProgress?.phase === "stopping";
  /** Jog/probe allowed after M5 while paused for a tool change. */
  const toolChangeMotionOk =
    streamProgress?.phase === "tool-change" &&
    !!toolChangeUi?.spindleStopped &&
    !toolChangeUi.busy;
  const streamingBlocksMotion = streaming && !toolChangeMotionOk;

  const phaseCtx = useMemo(
    () => ({
      connected,
      calibrationCompleted,
      prepareReady,
      jobLoaded: !!job,
      streaming,
    }),
    [connected, calibrationCompleted, prepareReady, job, streaming],
  );

  const phaseGates = useMemo(
    () => ({
      connect: gateForPhase("connect", phaseCtx),
      calibrate: gateForPhase("calibrate", phaseCtx),
      prepare: gateForPhase("prepare", phaseCtx),
      verify: gateForPhase("verify", phaseCtx),
      run: gateForPhase("run", phaseCtx),
    }),
    [phaseCtx],
  );

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
          job.zRange,
        )
      : null;

  const checklistOk = verifyChecklistComplete(verifyChecklist);
  const startGate = canStartJob(gateState, connected);
  const startBlockedReason = !job
    ? null
    : !startGate.ok
      ? (startGate.reason ?? "Cannot start")
      : streaming
        ? "Job already running"
        : jobSoftCheck && !jobSoftCheck.ok
          ? (jobSoftCheck.reason ?? "Job outside soft limits")
          : !prepareReady
            ? "Mark material ready in Prepare before Start"
            : taskPhase !== "verify"
              ? "Start only from Verify"
              : !checklistOk
                ? "Confirm plate removed, clamps clear, and path free"
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

  // Abandoned rate/accel trial writes after disconnect — restore once Idle.
  useEffect(() => {
    const justConnected = connected && !wasConnectedRef.current;
    wasConnectedRef.current = connected;
    if (!justConnected) return;
    if (!loadPendingRatesRestore()) return;
    ratesTempActiveRef.current = false;
    const tryRestore = () => {
      if (!clientRef.current?.transport.isOpen) return;
      const st = statusRef.current.state;
      if (st !== "Idle" && st !== "Check") {
        window.setTimeout(tryRestore, 200);
        return;
      }
      void handleRestoreRatesPending("reconnect");
    };
    tryRestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rising-edge connect only
  }, [connected]);

  // M6: wait for Idle (buffered motion done), then send M5 before the panel unlocks.
  useEffect(() => {
    if (streamProgress?.phase !== "tool-change") {
      setToolChangeUi(null);
      return;
    }
    const arm = ++toolChangeArmRef.current;
    setToolChangeUi({
      waitingForIdle: true,
      spindleStopped: false,
      zReprobed: false,
      sameToolLength: false,
      busy: true,
      statusNote: "Waiting for the machine to finish moving…",
    });
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      try {
        const started = Date.now();
        while (!cancelled && toolChangeArmRef.current === arm) {
          const pending = streamerRef.current?.getProgress().pendingLines ?? 0;
          const idle = statusRef.current.state === "Idle";
          if (pending === 0 && idle) break;
          if (Date.now() - started > 120_000) {
            throw new Error("Timed out waiting for Idle before spindle stop");
          }
          await wait(100);
        }
        if (cancelled || toolChangeArmRef.current !== arm) return;
        setToolChangeUi((prev) =>
          prev
            ? {
                ...prev,
                statusNote: "Stopping the spindle…",
              }
            : prev,
        );
        await streamerRef.current?.sendDuringToolChange(
          buildToolChangeSpindleStop(),
        );
        if (cancelled || toolChangeArmRef.current !== arm) return;
        setToolChangeUi({
          waitingForIdle: false,
          spindleStopped: true,
          zReprobed: false,
          sameToolLength: false,
          busy: false,
          statusNote: null,
        });
        activityLog.append("event", "Tool change: spindle stopped (M5)");
      } catch (err) {
        if (cancelled || toolChangeArmRef.current !== arm) return;
        const message = err instanceof Error ? err.message : String(err);
        setToolChangeUi((prev) =>
          prev
            ? { ...prev, busy: false, statusNote: message }
            : {
                waitingForIdle: false,
                spindleStopped: false,
                zReprobed: false,
                sameToolLength: false,
                busy: false,
                statusNote: message,
              },
        );
        setErrorMessage(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamProgress?.phase, activityLog]);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    dryRunRef.current = dryRun;
  }, [dryRun]);

  /** Latch Prepare continuity once the probe pin lights (`status.pins.probe`). */
  useEffect(() => {
    if (status.pins?.probe) {
      setPrepareProbeContinuityOk(true);
    }
  }, [status.pins?.probe]);

  /** First real-machine Start defaults dry-run on; Virtual CNC uses last preference. */
  useEffect(() => {
    if (streaming) return;
    setDryRun(initialDryRun(verifyRunPrefs, usingVirtualCnc));
  }, [usingVirtualCnc, verifyRunPrefs.hasStartedOnRealMachine]);

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
      // Reconcile soft-limit cursor once motion settles (or on alarm/offline).
      if (
        next.state === "Idle" ||
        next.state === "Alarm" ||
        next.state === "Offline" ||
        next.state === "Hold"
      ) {
        jogSoftCursorRef.current = null;
      }
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
          // Resume from before the last acknowledged line: GRBL acks lines
          // when it plans them, not when it finishes cutting them.
          const acked =
            typeof p.ackedAbsoluteLine === "number"
              ? p.ackedAbsoluteLine
              : p.ackedLines;
          const nextLine = Math.max(0, acked - RESUME_BACKOFF_LINES);
          const checkpoint = {
            jobName: currentJob.name,
            totalLines: currentJob.lines.length,
            nextLine: Math.min(nextLine, currentJob.lines.length),
            absoluteLine: nextLine,
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

  // M4: Space = Hold when focus isn't in a text field or on a button.
  // Escape stays dialog-close only — never E-Stop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " && event.code !== "Space") return;
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          "input, textarea, select, [contenteditable='true'], [contenteditable='']",
        )
      ) {
        return;
      }
      if (
        target.closest(
          "button, a, [role='button'], [role='menuitem'], [role='tab']",
        )
      ) {
        return;
      }
      if (!connected || estopLatchedRef.current) return;
      if (statusRef.current.state === "Hold") return;
      if (statusRef.current.state === "Alarm") return;
      event.preventDefault();
      void handleHoldRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [connected]);

  useEffect(() => {
    if (!calOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [calOpen]);

  useEffect(() => {
    if (!advancedOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAdvancedOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [advancedOpen]);

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

  /** Enter Run while streaming; leave Run when the stream ends. */
  useEffect(() => {
    if (streaming) {
      setTaskPhase("run");
      return;
    }
    setTaskPhase((prev) =>
      prev === "run" ? phaseAfterStreamEnds(!!jobRef.current) : prev,
    );
  }, [streaming]);

  /** If Verify/Run gates break (clear ready / job), fall back to a valid phase. */
  useEffect(() => {
    if (streaming) return;
    setTaskPhase((prev) => {
      const gate = gateForPhase(prev, {
        connected,
        calibrationCompleted,
        prepareReady,
        jobLoaded: !!job,
        streaming: false,
      });
      if (gate.enabled) return prev;
      if (!connected) return "connect";
      if (!calibrationCompleted) return "calibrate";
      return "prepare";
    });
  }, [
    connected,
    calibrationCompleted,
    prepareReady,
    job,
    streaming,
  ]);

  const handleConnect = async () => {
    const client = clientRef.current;
    if (!client || !selectedPath) return;
    setPhase("connecting");
    setErrorMessage(null);
    setSoftLimitHint(null);
    setZeroMessage(null);
    setAlarmMessage(null);
    externalControlsRef.current.reset();
    try {
      await client.connect({ path: selectedPath });
      setPhase("connected");
      const land = phaseAfterConnect(calibrationCompleted);
      setTaskPhase(land);
      activityLog.append(
        "event",
        `Connected ${selectedPath} → ${land}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase("error");
      setErrorMessage(message);
      setStatus(OFFLINE_STATUS);
      setTaskPhase("connect");
      activityLog.append("event", `Connect failed: ${message}`);
    }
  };

  const stopContinuousJog = async () => {
    continuousAxesRef.current = null;
    jogSoftCursorRef.current = null;
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
      setStreamProgress(null);
      setGrblSettings(null);
      setCalMessage(null);
      setCalBusy(false);
      setCalUndoStack([]);
      setRatesTrialRunning(false);
      ratesTrialRunningRef.current = false;
      ratesTempActiveRef.current = false;
      setRestoreMessage(null);
      sessionSettingsBackupTakenRef.current = false;
      setHomed(false);
      setHomeMessage(null);
      setEstopLatched(false);
      resetPrepareSession();
      setTaskPhase("connect");
    }
  };

  const handleSoftReset = async () => {
    abortAppMotionLoops("soft reset");
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
      activityLog.append("event", "Soft reset");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  /**
   * Stop every app-driven motion loop (bed travel, stock perimeter, continuous
   * jog) and reset session flags. Shared by E-Stop and Reset so neither can
   * leave a loop running that sends the next move after the controller stops.
   */
  const abortAppMotionLoops = (reasonLabel: string) => {
    bedTravelAbortRef.current = true;
    stockPerimeterAbortRef.current = true;
    ratesTrialAbortRef.current = true;
    if (bedTravelRunningRef.current) {
      bedTravelRunningRef.current = false;
      setBedTravelPhase("aborted");
      setBedTravelMessage(`Aborted by ${reasonLabel}.`);
    }
    if (stockPerimeterRunningRef.current) {
      stockPerimeterRunningRef.current = false;
      setStockPerimeterPhase("aborted");
      setStockPerimeterMessage(`Aborted by ${reasonLabel}.`);
    }
    if (ratesTrialRunningRef.current) {
      ratesTrialRunningRef.current = false;
      setRatesTrialRunning(false);
      setCalMessage(`Rates trial aborted by ${reasonLabel}.`);
    }
  };

  const handleEstop = async () => {
    const client = clientRef.current;
    // Latch first so no gate lets new motion through while we stop.
    setEstopLatched(true);
    abortAppMotionLoops("E-Stop");
    if (!client || !client.transport.isOpen) return;
    // Feed hold goes out before anything else.
    try {
      await client.feedHold();
    } catch {
      /* best-effort */
    }
    activityLog.append("event", "E-Stop (motion locked until cleared)");
    externalControlsRef.current.noteSoftwareAction("abort");
    await stopContinuousJog();
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
      setFeedOverridePercent(100);
      setRapidOverridePercent(100);
      setSpindleOverridePercent(100);
      setHomed(false);
      setErrorMessage(null);
      setSoftLimitHint(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handleClearEstop = async () => {
    setEstopLatched(false);
    activityLog.append("event", "E-Stop cleared by operator");
    const client = clientRef.current;
    if (client?.transport.isOpen && statusRef.current.state === "Alarm") {
      await handleUnlock();
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

  handleHoldRef.current = handleHold;

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
    await simulateMockAlarm("$Alarm5", "Simulated probe no-contact alarm (mock)");
  };

  const handleHome = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canHome(gateStateLive(), connected, streaming);
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
          const code = parseAlarmLine(alarmMessage ?? "")?.code ?? null;
          throw new Error(
            homingAlarmPlainDetail(code) ??
              alarmMessage ??
              "Homing failed (Alarm)",
          );
        }
        if (st === "Idle" && (sawHome || usingMock)) break;
        await new Promise((r) => setTimeout(r, usingMock ? 80 : 250));
      }
      if (statusRef.current.state === "Alarm") {
        const code = parseAlarmLine(alarmMessage ?? "")?.code ?? null;
        throw new Error(
          homingAlarmPlainDetail(code) ??
            alarmMessage ??
            "Homing failed (Alarm)",
        );
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

  const handleWriteHomingSetting = async (
    id: number,
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
      recordCalibrateWrites([{ id, before, after }]);
      const unit = homingSettingUnit(id);
      const unitSuffix = unit ? ` ${unit}` : "";
      activityLog.append(
        "event",
        `Wrote $${id}=${after} (was ${before}) ${homingSettingPlainLabel(id)}`,
      );
      setCalMessage(
        `${homingSettingPlainLabel(id)}: ${before} → ${after}${unitSuffix} ($${id})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleToggleLimitPin = async (axis: LimitAxis) => {
    // Mock-only — never send $ExtLimit* to a real Demon Shield port.
    if (!usingMock) return;
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.sendLine(extLimitCommandForAxis(axis));
      activityLog.append(
        "event",
        `Toggled ${axis} limit pin (Virtual CNC $ExtLimit${axis})`,
      );
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
    }
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
    const gate = canProbe(gateStateLive(), connected, streaming, {
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
    const gate = canProbe(gateStateLive(), connected, streaming, {
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
      setXyProbeMessage(`Corner (${mode}) material XY set`);
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
    const gate = canProbe(gateStateLive(), connected, streaming, {
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

  const handleToolChangeSameLength = (checked: boolean) => {
    setToolChangeUi((prev) =>
      prev ? { ...prev, sameToolLength: checked } : prev,
    );
  };

  const handleToolChangeReprobeZ = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    if (!toolChangeMotionOk) {
      setErrorMessage(
        toolChangeUi?.spindleStopped
          ? "Wait for the spindle command to finish."
          : "Wait until the spindle is stopped.",
      );
      return;
    }
    const gate = canProbe(gateStateLive(), connected, false, {
      probePinActive: !!statusRef.current.pins?.probe,
    });
    if (!gate.ok) {
      setErrorMessage(gate.reason ?? "Cannot probe");
      return;
    }
    setToolChangeUi((prev) =>
      prev
        ? { ...prev, busy: true, statusNote: "Re-probing Z…" }
        : prev,
    );
    try {
      const result = await runToolLengthProbeCycle(client, {
        plateThicknessMm: probeConfig.plateThicknessMm,
        seekMm: probeConfig.seekMm,
        feedMmMin: probeConfig.feedMmMin,
        timeoutMs: usingMock ? 5000 : 20_000,
      });
      setToolChangeUi((prev) =>
        prev
          ? {
              ...prev,
              busy: false,
              zReprobed: true,
              statusNote: `Z re-probed · ${result.workZeroCommand}`,
            }
          : prev,
      );
      activityLog.append("event", "Tool change: Z re-probed");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setToolChangeUi((prev) =>
        prev ? { ...prev, busy: false, statusNote: message } : prev,
      );
      setErrorMessage(message);
    }
  };

  const handleResumeToolChange = async () => {
    const streamer = streamerRef.current;
    const currentJob = jobRef.current;
    if (!streamer || !toolChangeUi) return;
    if (
      !canContinueToolChange({
        spindleStopped: toolChangeUi.spindleStopped,
        zReprobed: toolChangeUi.zReprobed,
        sameToolLength: toolChangeUi.sameToolLength,
        busy: toolChangeUi.busy,
      })
    ) {
      setErrorMessage(
        "Re-probe Z or tick “Same tool length” before continuing.",
      );
      return;
    }
    setToolChangeUi((prev) =>
      prev
        ? { ...prev, busy: true, statusNote: "Restoring spindle…" }
        : prev,
    );
    try {
      const m6Line =
        streamer.getProgress().toolChangeLine ??
        Math.max(0, (streamer.getProgress().absoluteLine ?? 1) - 1);
      const resume =
        currentJob != null
          ? scanResumeState(currentJob.lines, m6Line)
          : { spindle: null, spindleSpeed: null };
      // Dry-run jobs keep the spindle off after the bit change.
      const restore = dryRunRef.current
        ? []
        : buildToolChangeSpindleRestore(resume);
      for (const line of restore) {
        await streamer.sendDuringToolChange(line);
      }
      await streamer.resumeAfterToolChange();
      activityLog.append(
        "event",
        restore.length > 0
          ? `Resumed after M6 (restored ${restore[0]})`
          : "Resumed after M6 tool change",
      );
      setToolChangeUi(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setToolChangeUi((prev) =>
        prev ? { ...prev, busy: false, statusNote: message } : prev,
      );
      setErrorMessage(message);
    }
  };

  const settingsGate = canWriteSettings(status.state, connected, streaming);

  const updateSoftTravel = (next: SoftTravelLimits) => {
    softTravelRef.current = next;
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
      // Auto-backup once per session on first successful $$ load (Calibrate entry).
      if (!sessionSettingsBackupTakenRef.current && map.size > 0) {
        const store = pushSettingsBackup(map);
        setSettingsBackups(store);
        sessionSettingsBackupTakenRef.current = true;
        activityLog.append(
          "event",
          `Settings backup saved (${map.size} settings, ${store.snapshots.length} kept)`,
        );
      }
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

  const handleBackupSettingsDownload = async () => {
    if (!grblSettings || grblSettings.size === 0) {
      setCalMessage("Load settings first (Reload), then back up.");
      return;
    }
    try {
      const saved = await saveSettingsBackupFile(grblSettings);
      if (saved === null) {
        setCalMessage("Backup cancelled.");
        return;
      }
      // Also keep a snapshot in the restore list when the operator explicitly backs up.
      const store = pushSettingsBackup(grblSettings);
      setSettingsBackups(store);
      activityLog.append("event", `Settings backup downloaded (${saved})`);
      setCalMessage(`Backed up settings → ${saved}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    }
  };

  const recordCalibrateWrites = (
    entries: Array<{ id: number; before: number; after: number }>,
  ) => {
    if (entries.length === 0) return;
    setCalUndoStack((prev) => {
      let next = prev;
      for (const e of entries) {
        next = pushCalibrateUndo(next, e);
      }
      return next;
    });
  };

  const handleUndoCalibrateWrite = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot write settings");
      return;
    }
    const { entry, next } = popCalibrateUndo(calUndoStack);
    if (!entry) {
      setCalMessage("Nothing to undo.");
      return;
    }
    setCalBusy(true);
    setCalMessage(null);
    setCalUndoStack(next);
    try {
      await writeGrblSetting(client, entry.id, entry.before, {
        timeoutMs: usingMock ? 1500 : 4000,
      });
      setGrblSettings((prev) => {
        const map = new Map(prev ?? []);
        map.set(entry.id, { id: entry.id, value: entry.before });
        return map;
      });
      if (entry.id === 130 || entry.id === 131 || entry.id === 132) {
        const patched = { ...softTravel, min: { ...softTravel.min } };
        if (entry.id === 130) patched.maxX = entry.before;
        if (entry.id === 131) patched.maxY = entry.before;
        if (entry.id === 132) patched.maxZ = entry.before;
        updateSoftTravel(patched);
      }
      activityLog.append(
        "event",
        `Undo $${entry.id}: ${entry.after} → ${entry.before}`,
      );
      setCalMessage(`Undid $${entry.id}: ${entry.after} → ${entry.before}`);
    } catch (err) {
      setCalUndoStack((prev) => pushCalibrateUndo(prev, entry));
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleRestoreSettingsSnapshot = async (snapshot: SettingsSnapshot) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canWriteSettings(statusRef.current.state, connected, streaming);
    if (!gate.ok) {
      setRestoreMessage(gate.reason ?? "Cannot write settings");
      return;
    }
    setCalBusy(true);
    setRestoreMessage(null);
    try {
      let live = grblSettings;
      if (!live || live.size === 0) {
        live = await fetchGrblSettings(client, {
          timeoutMs: usingMock ? 1500 : 5000,
        });
        setGrblSettings(live);
      }
      const diff = diffSettings(snapshot.settings, live);
      const entries = restoreWriteEntries(diff);
      if (entries.length === 0) {
        setRestoreMessage("Nothing to restore — live settings match.");
        return;
      }
      await writeGrblSettings(client, entries, {
        timeoutMs: usingMock ? 1500 : 4000,
      });
      const confirmed = await fetchGrblSettings(client, {
        timeoutMs: usingMock ? 1500 : 5000,
      });
      setGrblSettings(confirmed);
      const fromGrbl = softTravelFromSettings(confirmed, softTravel);
      updateSoftTravel(fromGrbl);
      activityLog.append(
        "event",
        `Restored ${entries.length} setting${entries.length === 1 ? "" : "s"} from backup`,
      );
      setRestoreMessage(
        `Restored ${entries.length} setting${entries.length === 1 ? "" : "s"}; re-read $$ (${confirmed.size}).`,
      );
      setCalMessage(
        `Restored ${entries.length} setting${entries.length === 1 ? "" : "s"} from backup.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRestoreMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleCalibrateMove = async (axis: Axis, distanceMm: number) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
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
      recordCalibrateWrites([{ id, before, after }]);
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

  const waitRatesIdle = async (client: GrblClient) => {
    const deadline = Date.now() + (usingMock ? 60_000 : 300_000);
    await new Promise((r) => setTimeout(r, usingMock ? 40 : 80));
    while (Date.now() < deadline) {
      if (ratesTrialAbortRef.current) return;
      await client.requestStatus().catch(() => undefined);
      const st = statusRef.current.state;
      if (st === "Alarm") {
        throw new Error(alarmMessage ?? "Alarm during rates trial");
      }
      if (st === "Hold") {
        await new Promise((r) => setTimeout(r, usingMock ? 80 : 200));
        continue;
      }
      if (st === "Idle" || st === "Check") return;
      await new Promise((r) => setTimeout(r, usingMock ? 50 : 120));
    }
    throw new Error("Timed out waiting for Idle after rates trial.");
  };

  /** Restore abandoned temp rate/accel writes (cancel, leave, reconnect). */
  const handleRestoreRatesPending = async (reason: string) => {
    const pending = loadPendingRatesRestore();
    if (!pending || pending.entries.length === 0) return;
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    // Use transport openness (not React `connected`) so reconnect can restore
    // before the next render flips phase → connected.
    const gate = canWriteSettings(statusRef.current.state, true, streaming);
    if (!gate.ok) {
      // Keep pending for a later Idle/connect attempt.
      return;
    }
    setCalBusy(true);
    try {
      await writeGrblSettings(
        client,
        pending.entries.map((e) => ({ id: e.id, value: e.value })),
        { timeoutMs: usingMock ? 1500 : 4000 },
      );
      setGrblSettings((prev) => {
        const next = new Map(prev ?? []);
        for (const e of pending.entries) {
          next.set(e.id, { id: e.id, value: e.value });
        }
        return next;
      });
      clearPendingRatesRestore();
      ratesTempActiveRef.current = false;
      activityLog.append(
        "event",
        `Rates pending restore (${reason}): ${pending.entries
          .map((e) => `$${e.id}=${e.value}`)
          .join(", ")}`,
      );
      setCalMessage(`Restored temporary rate/accel writes (${reason}).`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      activityLog.append("event", `Rates pending restore failed: ${message}`);
    } finally {
      setCalBusy(false);
    }
  };

  const handleRatesTrial = async (args: {
    axis: Axis;
    kind: RatesKind;
    trialValue: number;
    baselineValue: number;
    distanceMm: number;
    cycles: number;
  }) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) {
      throw new Error("Connect first.");
    }
    if (statusRef.current.state !== "Idle" && statusRef.current.state !== "Check") {
      throw new Error("Wait for Idle before starting a trial.");
    }
    const fit = canFitRatesTest(
      statusRef.current.machine,
      softTravel,
      args.axis,
      args.distanceMm,
    );
    if (!fit.ok) {
      throw new Error(fit.reason ?? "Test does not fit soft travel.");
    }
    const id = ratesSettingId(args.kind, args.axis);
    const writeGate = canWriteSettings(
      statusRef.current.state,
      connected,
      streaming,
    );
    if (!writeGate.ok) {
      throw new Error(writeGate.reason ?? "Cannot write settings.");
    }

    ratesTrialAbortRef.current = false;
    ratesTrialRunningRef.current = true;
    setRatesTrialRunning(true);
    setCalBusy(true);
    setCalMessage(null);

    try {
      await stopContinuousJog();

      // Record baseline once per setting id; trial value is temporary.
      const existing = loadPendingRatesRestore()?.entries ?? [];
      const merged = mergePendingRatesRestore(existing, [
        { id, value: args.baselineValue },
      ]);
      savePendingRatesRestore(merged);
      ratesTempActiveRef.current = true;

      await writeGrblSetting(client, id, args.trialValue, {
        timeoutMs: usingMock ? 1500 : 4000,
      });
      setGrblSettings((prev) => {
        const next = new Map(prev ?? []);
        next.set(id, { id, value: args.trialValue });
        return next;
      });

      // Feed for G1: use the trial max rate when tuning rate; when tuning
      // accel, use the current max rate for this axis so accel is the variable.
      const feedMmMin =
        args.kind === "rate"
          ? args.trialValue
          : (grblSettings?.get(ratesSettingId("rate", args.axis))?.value ??
            args.trialValue);

      const lines = buildRatesTrialLines(
        args.axis,
        args.distanceMm,
        args.cycles,
        feedMmMin,
      );
      activityLog.append(
        "event",
        `Rates trial ${args.kind} ${args.axis}: $${id}=${args.trialValue} · ${args.cycles}× ${args.distanceMm} mm`,
      );
      for (const line of lines) {
        if (ratesTrialAbortRef.current) break;
        await client.sendLine(line);
      }
      await waitRatesIdle(client);
      if (ratesTrialAbortRef.current) {
        throw new Error("Rates trial aborted.");
      }
      setCalMessage(
        `Trial done at ${args.trialValue} ${ratesSettingUnit(args.kind)} — check the mark.`,
      );
      activityLog.append(
        "event",
        `Rates trial complete ${args.kind} ${args.axis} @ ${args.trialValue}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCalMessage(message);
      activityLog.append("event", `Rates trial failed: ${message}`);
      throw err;
    } finally {
      ratesTrialRunningRef.current = false;
      setRatesTrialRunning(false);
      setCalBusy(false);
    }
  };

  const handleWriteRates = async (
    kind: RatesKind,
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
    const id = ratesSettingId(kind, axis);
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
      recordCalibrateWrites([{ id, before, after }]);
      // Accepted write replaces any pending restore for this id.
      const pending = loadPendingRatesRestore();
      if (pending) {
        const rest = pending.entries.filter((e) => e.id !== id);
        if (rest.length === 0) {
          clearPendingRatesRestore();
          ratesTempActiveRef.current = false;
        } else {
          savePendingRatesRestore(rest);
        }
      } else {
        ratesTempActiveRef.current = false;
      }
      activityLog.append(
        "event",
        `Wrote $${id}=${after} (was ${before}) ${ratesSettingPlainLabel(kind, axis)}`,
      );
      setCalMessage(
        `${ratesSettingPlainLabel(kind, axis)}: ${before} → ${after} ${ratesSettingUnit(kind)} ($${id})`,
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
    const before =
      grblSettings?.get(SETTING_DIR_PORT_INVERT)?.value ??
      0;
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
      recordCalibrateWrites([
        { id: SETTING_DIR_PORT_INVERT, before, after: value },
      ]);
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
    enableHard = false,
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
      if (enableHard) entries.push({ id: SETTING_HARD_LIMITS, value: 1 });

      const undoEntries = entries
        .map((e) => {
          const before = grblSettings?.get(e.id)?.value;
          if (before === undefined || !Number.isFinite(before)) return null;
          return { id: e.id, before, after: e.value };
        })
        .filter((e): e is CalibrateWriteEntry => e !== null);

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
      recordCalibrateWrites(undoEntries);

      activityLog.append(
        "event",
        `Soft travel X${merged.maxX ?? "—"} Y${merged.maxY ?? "—"} Z${merged.maxZ ?? "—"} · $20=${enableSoft ? 1 : "unchanged"} · $21=${enableHard ? 1 : "unchanged"}`,
      );
      setCalMessage(
        `Wrote max travel${enableSoft ? " and enabled soft limits ($20=1)" : ""}${enableHard ? " · hard limits ($21=1)" : ""}. Bed updated.`,
      );
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const plain = plainSoftLimitsNeedHoming(raw);
      const message = plain ?? raw;
      setCalMessage(message);
      setErrorMessage(message);
    } finally {
      setCalBusy(false);
    }
  };

  const handleVerifySoftLimit = async (axis: Axis) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
    if (!gate.ok) {
      setCalMessage(gate.reason ?? "Cannot test soft limit");
      return;
    }
    if (!grblSettings || !softLimitsEnabled(grblSettings)) {
      setCalMessage("Enable soft limits ($20=1) before testing.");
      return;
    }
    const delta = softLimitVerifyDelta(
      axis,
      statusRef.current.machine,
      softTravelRef.current,
    );
    if (!delta) {
      setCalMessage(
        `Set max ${axis} travel first, then write soft limits before testing.`,
      );
      return;
    }
    setCalBusy(true);
    setCalMessage(null);
    try {
      await stopContinuousJog();
      const cmd = buildJogCommand(delta, Math.min(feedMmMin, 500));
      const outcome = await runSoftLimitVerifyJog(client, cmd, {
        timeoutMs: usingMock ? 2000 : 4000,
      });
      if (!outcome.ok) {
        setCalMessage(outcome.reason);
        return;
      }
      if (outcome.kind === "ALARM:2") {
        // Default Virtual CNC soft-limit jog raises Alarm — unlock so the
        // operator can keep calibrating. Real / strict path stays Idle.
        try {
          await client.sendLine(UNLOCK_COMMAND);
        } catch {
          /* ignore unlock failure; message still reports success */
        }
      }
      activityLog.append(
        "event",
        `Soft-limit verify ${axis}: ${outcome.kind}`,
      );
      setCalMessage(`${SOFT_LIMITS_WORKING_COPY} (${axis})`);
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
    if (streamingBlocksMotion) return;

    const gate = canJogOrZero(gateStateLive(), connected, streamingBlocksMotion);
    if (!gate.ok) {
      setSoftLimitHint(gate.reason ?? "Cannot jog");
      if (continuous) await stopContinuousJog();
      return;
    }

    const rawDelta = continuous
      ? continuousJogDelta(axes, feedMmMin, CONTINUOUS_JOG_MS / 1000)
      : jogDeltaFromAxes(axes, stepMm);

    if (
      (rawDelta.x === undefined || rawDelta.x === 0) &&
      (rawDelta.y === undefined || rawDelta.y === 0) &&
      (rawDelta.z === undefined || rawDelta.z === 0)
    ) {
      return;
    }

    // Prefer pending soft-limit cursor so overlapping continuous bursts
    // (Xbox stick / hold mode) cannot command past [min, max] while MPos lags.
    const machine = jogSoftCursorRef.current ?? statusRef.current.machine;
    const limits = softTravelRef.current;
    const clamped = clampJogDelta(machine, rawDelta, limits);
    const delta = clamped.delta;

    if (
      (delta.x === undefined || delta.x === 0) &&
      (delta.y === undefined || delta.y === 0) &&
      (delta.z === undefined || delta.z === 0)
    ) {
      setSoftLimitHint(clamped.reason ?? "At soft limit");
      if (continuous) await stopContinuousJog();
      return;
    }

    if (clamped.clamped) {
      setSoftLimitHint(clamped.reason ?? "Soft limit");
    } else {
      setSoftLimitHint(null);
    }

    try {
      const cmd = buildJogCommand(delta, feedMmMin);
      jogSoftCursorRef.current = clamped.targetMachine;
      await client.sendLine(cmd);
      if (!continuous) {
        activityLog.append("event", `Jog ${cmd.replace(/^\$J=/, "")}`);
      }
    } catch (err) {
      jogSoftCursorRef.current = null;
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      if (continuous) await stopContinuousJog();
    }
  };

  const handleJog = (axes: JogAxisMap) => {
    if (!connected || streamingBlocksMotion) return;
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

  sendJogDeltaRef.current = sendJogDelta;
  stopContinuousJogRef.current = stopContinuousJog;

  // Xbox / gamepad jog via Browser Gamepad API (works in Vite + Tauri WebView).
  useEffect(() => {
    let raf = 0;
    let lastBurst = 0;
    let lastLabel = "";

    const tick = (ts: number) => {
      const list =
        typeof navigator !== "undefined" && navigator.getGamepads
          ? navigator.getGamepads()
          : null;
      const pad = firstConnectedGamepad(list ? Array.from(list) : null);
      const sample = pad
        ? { axes: Array.from(pad.axes), buttons: pad.buttons }
        : null;
      const frame = mapGamepadToJog(sample, gamepadPrevButtonsRef.current);
      gamepadPrevButtonsRef.current = pressedButtonSet(sample);

      const label = pad
        ? `${pad.id.split("(")[0]?.trim() || "Gamepad"} · ${frame.statusLabel}`
        : "No gamepad";
      if (label !== lastLabel) {
        lastLabel = label;
        setGamepadStatus(label);
      }

      const clientOpen = Boolean(clientRef.current?.transport.isOpen);
      if (!clientOpen || streamPhaseRef.current === "running") {
        if (gamepadHoldRef.current) {
          gamepadHoldRef.current = false;
          void stopContinuousJogRef.current();
        }
        raf = requestAnimationFrame(tick);
        return;
      }

      if (frame.cancel) {
        gamepadHoldRef.current = false;
        void stopContinuousJogRef.current();
      } else if (frame.step) {
        void sendJogDeltaRef.current(frame.step, false);
      } else if (frame.continuous) {
        gamepadHoldRef.current = true;
        if (ts - lastBurst >= CONTINUOUS_JOG_MS) {
          lastBurst = ts;
          void sendJogDeltaRef.current(frame.continuous, true);
        }
      } else if (gamepadHoldRef.current) {
        gamepadHoldRef.current = false;
        void stopContinuousJogRef.current();
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleZero = async (axes: ZeroAxisSelection) => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
    if (!gate.ok) {
      setZeroMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine(buildSetWorkZeroCommand(axes));
      setZeroMessage(
        axes === "XYZ"
          ? "Material XYZ zero set at current position (G10 L20)."
          : `Material ${axes} zero set at current position (G10 L20).`,
      );
      if (axes === "XYZ") {
        setPrepareXyZeroed(true);
        setPrepareZProbed(true);
        setPrepareReady(false);
      } else if (axes === "Z") {
        setPrepareZProbed(true);
        setPrepareReady(false);
      }
      activityLog.append("event", `Material zero ${axes}`);
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
    }
  };

  const handlePrepareZeroXy = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine("G10 L20 P1 X0 Y0");
      setPrepareXyZeroed(true);
      setPrepareReady(false);
      setPrepareMessage("Material XY zero set at current position (G10 L20).");
      setZeroMessage("Material XY zero set at current position (G10 L20).");
      activityLog.append("event", "Material zero XY (prepare)");
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
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
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
      const msg = `Material XY zero + stock ${label} at toolhead (G10 L20). Enter width / length from that corner.`;
      setPrepareMessage(msg);
      setZeroMessage(msg);
      activityLog.append(
        "event",
        `Material zero XY + stock origin ${label} (toolhead)`,
      );
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
      setZeroMessage(message);
      setErrorMessage(message);
    }
  };

  const handleSimulateProbeTouch = async () => {
    // Mock-only — never send $ExtProbe to a real Demon Shield port.
    if (!usingMock) return;
    const client = clientRef.current;
    if (!client || !client.transport.isOpen) return;
    try {
      await client.sendLine("$ExtProbe");
      activityLog.append("event", "Simulated probe clip touch (Virtual CNC)");
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
    }
  };

  const handleRunZProbe = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const pinActive = !!statusRef.current.pins?.probe;
    const gate = canRunPrepareZProbe(
      prepareProbeContinuityOk,
      canProbe(gateStateLive(), connected, streaming),
      pinActive,
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
        `Probe contact at machine Z=${z}. Material Z0 = stock top (plate ${probeConfig.plateThicknessMm} mm).`,
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
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
    if (!gate.ok) {
      setPrepareMessage(gate.reason ?? "Cannot set zero");
      return;
    }
    try {
      await client.sendLine(buildSetWorkZeroCommand("Z"));
      setPrepareZProbed(true);
      setPrepareReady(false);
      setPrepareMessage(
        "Manual material Z zero at current tip (paper feel / G10 L20).",
      );
      activityLog.append("event", "Material zero Z (manual prepare)");
      await client.requestStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPrepareMessage(message);
    }
  };

  const handlePrepareRetract = async () => {
    const client = clientRef.current;
    if (!client || !client.transport.isOpen || streaming) return;
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
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
        `Retracting to material Z=${probeConfig.retractWorkZMm} mm.`,
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
    setPrepareProbeContinuityOk(false);
    setPrepareReady(false);
    setPrepareMessage(null);
    setVerifyChecklist(emptyVerifyChecklist());
  };

  const handleDryRunChange = (enabled: boolean) => {
    setDryRun(enabled);
    setVerifyRunPrefs(saveDryRunPreferred(enabled));
  };

  const handleDismissSimNudge = () => {
    setVerifyRunPrefs(dismissSimNudge());
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
    setDryRun(initialDryRun(loadVerifyRunState(), usingVirtualCnc));
    setVerifyChecklist(emptyVerifyChecklist());
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
    setDryRun(initialDryRun(loadVerifyRunState(), usingVirtualCnc));
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
        "Mark material ready in Prepare first — stock, zeros, and Z probe.",
      );
      setTaskPhase("prepare");
      return;
    }

    if (taskPhase !== "verify") {
      setErrorMessage("Start only from Verify.");
      setTaskPhase(
        prepareReady && job ? "verify" : "prepare",
      );
      return;
    }

    if (!verifyChecklistComplete(verifyChecklist)) {
      setErrorMessage(
        "Confirm plate removed, clamps clear, and spindle path free.",
      );
      return;
    }

    const gate = canStartJob(gateStateLive(), connected);
    if (!gate.ok) {
      setErrorMessage(gate.reason ?? "Cannot start");
      return;
    }

    resetSimForPath(job.path);

    // Dry run lifts every absolute Z so the deepest cut stays above material Z0.
    const lift = dryRun ? dryRunLiftMm(job.zRange) : 0;
    const effectiveZRange = job.zRange
      ? { minZ: job.zRange.minZ + lift, maxZ: job.zRange.maxZ + lift }
      : null;

    const soft = checkJobSoftLimits(
      job.bounds,
      statusRef.current.wco ?? {
        x: statusRef.current.machine.x - statusRef.current.work.x,
        y: statusRef.current.machine.y - statusRef.current.work.y,
        z: statusRef.current.machine.z - statusRef.current.work.z,
      },
      softTravel,
      effectiveZRange,
    );
    if (!soft.ok) {
      setErrorMessage(
        dryRun
          ? `${soft.reason ?? "Job outside soft limits"} (Dry run lifts Z by ${lift.toFixed(1)} mm to keep the bit above the stock.)`
          : (soft.reason ?? "Job outside soft limits"),
      );
      return;
    }

    const startAt = clampScrubIndex(scrubIndex, job.lines.length);
    const jobLines = dryRun ? dryRunJobLines(job.lines, lift) : job.lines;
    // Starting mid-file: restore units, offsets, spindle, and feed first, then
    // retract → move over the start point → spin up → plunge.
    const resumePreamble = buildResumePreamble(jobLines, startAt, {
      clearanceZMm: effectiveZRange?.maxZ ?? 5,
    });
    const preamble = dryRun
      ? ["M5", ...dryRunJobLines(resumePreamble, 0)]
      : resumePreamble;
    if (resumePreamble.length > 0) {
      activityLog.append(
        "event",
        `Resume setup before line ${startAt + 1}: ${resumePreamble.join(" | ")}`,
      );
    }

    await stopContinuousJog();
    setErrorMessage(null);
    externalControlsRef.current.noteSoftwareAction("start");
    activityLog.append(
      "event",
      `Job start: ${job.name}${dryRun ? " (dry run)" : ""}${startAt > 0 ? ` @ line ${startAt + 1}` : ""}`,
    );
    saveDryRunPreferred(dryRun);
    setVerifyRunPrefs(
      !usingVirtualCnc ? markStartedOnRealMachine() : loadVerifyRunState(),
    );
    try {
      await streamer.start(jobLines, { startIndex: startAt, preamble });
      activityLog.append("event", `Job completed: ${job.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const shown = /^error:/i.test(message)
        ? `Job halted — GRBL rejected a line (${message}). Motion is on hold. Press Stop to cancel the job and turn the spindle off.`
        : /^ALARM:/i.test(message)
          ? `Job stopped by ${message}. See the alarm panel for what it means.`
          : message;
      setErrorMessage(shown);
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
    if (prepareReady) setTaskPhase("verify");
    else setTaskPhase("prepare");
    setRecoveryVisible(true);
    activityLog.append(
      "event",
      `Recovery: scrub set to line ${line + 1} of ${job.lines.length}`,
    );
    setErrorMessage(
      `Checkpoint ready at line ${line + 1}. Confirm clear path, then Start from Verify.`,
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
      ? usingVirtualCnc
        ? "Virtual CNC"
        : selectedPath || "Connected"
      : phase === "connecting"
        ? "Opening…"
        : usingVirtualCnc
          ? "Virtual CNC"
          : selectedPath || "No port";

  const jogGate = canJogOrZero(gateState, connected, streamingBlocksMotion);
  const jogEnabled = jogGate.ok;

  /** Same jog pad as Prepare, for Calibrate steps that need to move the machine. */
  const calibrationJogPad = (
    <JogPanel
      enabled={jogEnabled && !calBusy}
      mode={jogMode}
      stepMm={stepMm}
      feedMmMin={feedMmMin}
      softLimitHint={
        softLimitHint ?? (!jogGate.ok && connected ? jogGate.reason : null)
      }
      gamepadStatus={gamepadStatus}
      onModeChange={setJogMode}
      onStepChange={setStepMm}
      onFeedChange={setFeedMmMin}
      onJog={handleJog}
      onJogEnd={handleJogEnd}
    />
  );
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

  const markCalibrationCompleted = (source: string) => {
    const next = saveCalibrationCompleted(true);
    setCalibrationCompleted(next.calibrationCompleted);
    activityLog.append("event", `Calibration completed (${source})`);
  };

  const openCalibration = () => {
    if (connected) {
      setTaskPhase("calibrate");
      setCalOpen(false);
    } else {
      setCalOpen(true);
    }
    if (connected && settingsGate.ok && !grblSettings) {
      void handleRefreshSettings();
    }
  };

  const handleCalibrationComplete = () => {
    markCalibrationCompleted("wizard");
    setCalOpen(false);
    setTaskPhase("prepare");
  };

  const handleAlreadyCalibrated = () => {
    markCalibrationCompleted("already calibrated");
    setCalOpen(false);
    setTaskPhase("prepare");
  };

  const openAdvanced = () => {
    setAdvancedOpen(true);
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
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
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
    const gate = canJogOrZero(gateStateLive(), connected, streaming);
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
    if (!skipped) {
      markCalibrationCompleted("first-run");
      if (connected) setTaskPhase("prepare");
    }
    activityLog.append(
      "event",
      skipped ? "First-run setup skipped" : "First-run setup finished",
    );
  };

  const openPrepareRun = () => {
    if (connected && calibrationCompleted) {
      setTaskPhase("prepare");
    }
    setPrepareFocusStep(null);
    setPrepareShowExternal(false);
  };

  const handleProbeConfigChange = (next: ProbeConfig) => {
    setProbeConfig(next);
    saveProbeConfig(next);
  };

  const openMaterialTool = () => {
    if (connected && calibrationCompleted) {
      setTaskPhase("prepare");
    }
    setPrepareFocusStep("stock");
    setPrepareShowExternal(false);
  };

  const openExternalJobs = () => {
    if (connected && calibrationCompleted) {
      setTaskPhase("prepare");
    }
    setPrepareFocusStep("load");
    setPrepareShowExternal(true);
  };

  const openActivityLog = () => {
    setLogOpen(true);
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
            usingVirtualCnc={usingVirtualCnc}
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
            onOpenAdvanced={openAdvanced}
            onOpenActivityLog={openActivityLog}
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

      <div
        ref={stageRef}
        className={`shell__stage${railResizing ? " is-resizing-rail" : ""}`}
        style={
          {
            "--shell-rail-width": `${railWidthPx}px`,
          } as CSSProperties
        }
      >
        <div className="shell__main">
          <section className="shell__chrome" aria-label="Position and safety">
            <div className="shell__chrome-row">
              <CoordinateReadout status={status} showInputs={connected} />
              <SafetyControls
                connected={connected}
                machineState={status.state}
                estopLatched={estopLatched}
                onClearEstop={() => {
                  void handleClearEstop();
                }}
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
                taskPhase === "run" ||
                streaming ||
                status.state === "Run" ||
                status.state === "Hold"
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
                  Interrupted job <strong>{recovery.jobName}</strong> — open
                  Verify for recovery (where am I / unlock / resume / abort).
                </span>
                <button
                  type="button"
                  className="recovery-banner__btn"
                  onClick={() => {
                    if (prepareReady && job) setTaskPhase("verify");
                    else if (connected && calibrationCompleted) {
                      setTaskPhase("prepare");
                    }
                  }}
                >
                  Open Verify
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
            stock={taskPhase === "calibrate" ? null : stock}
            onStockChange={
              taskPhase === "calibrate" ? null : handleStockChange
            }
            showMaterialOrigin={taskPhase !== "calibrate"}
            toolDiameterMm={tool.diameterMm}
            trail={trail}
            liveMoving={liveMoving}
            simulating={simulating}
            simActivity={simulating ? sim.activity : null}
            wco={status.wco ?? currentWco}
            overlay={
              <>
              {connected ? (
                <ZGauge
                  machineZ={status.machine.z}
                  zTravelMm={softTravel.maxZ}
                  homeZ={softTravel.min.z}
                  materialZeroMachineZ={
                    prepareZProbed ||
                    Math.abs((status.wco ?? currentWco).z) > 1e-6
                      ? (status.wco ?? currentWco).z
                      : null
                  }
                  stockThicknessMm={
                    taskPhase === "calibrate" ? null : stock.thicknessMm
                  }
                  jobZRange={job?.zRange ?? null}
                />
              ) : null}
              {job && job.path.length > 0 ? (
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
              ) : null}
              </>
            }
          />
        </div>

        <div
          className="shell__splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize phase panel"
          aria-valuenow={railWidthPx}
          aria-valuemin={MIN_SHELL_RAIL_WIDTH_PX}
          aria-valuemax={MAX_SHELL_RAIL_WIDTH_PX}
          tabIndex={0}
          onPointerDown={handleRailResizePointerDown}
          onKeyDown={handleRailResizeKeyDown}
        />

        <aside className="shell__rail">
          <section className="workspace" aria-label="Task phase">
            <PhaseSwitcher
              active={taskPhase}
              gates={phaseGates}
              onChange={setTaskPhase}
              verifyBadge={jobBadge}
            />

            <div className="workspace__body workspace__body--phase">
              {taskPhase === "connect" && (
                <div
                  className="workspace__panel workspace__panel--phase"
                  role="tabpanel"
                  id="phase-panel-connect"
                  aria-labelledby="phase-tab-connect"
                >
                  <p className="workspace__intro">
                    Connect in the header — USB Demon Shield or{" "}
                    <strong>Virtual CNC</strong> to practice first.
                  </p>
                  {!connected ? (
                    <div className="phase-connect">
                      <p className="phase-connect__hint">
                        Practice here before the real machine. Soft limits and
                        alarms work on Virtual CNC.
                      </p>
                      <button
                        type="button"
                        className="job__btn"
                        disabled={!selectedPath || phase === "connecting"}
                        onClick={() => {
                          void handleConnect();
                        }}
                      >
                        {phase === "connecting" ? "Connecting…" : "Connect"}
                      </button>
                    </div>
                  ) : (
                    <p className="workspace__intro workspace__intro--compact">
                      Linked
                      {usingVirtualCnc ? " · Virtual CNC" : ""}. Use the phase
                      switcher to continue.
                    </p>
                  )}
                </div>
              )}

              {taskPhase === "calibrate" && (
                <div
                  className="workspace__panel workspace__panel--phase workspace__panel--calibrate"
                  role="tabpanel"
                  id="phase-panel-calibrate"
                  aria-labelledby="phase-tab-calibrate"
                >
                  {!calibrationCompleted ? (
                    <div className="phase-cal__skip">
                      <button
                        type="button"
                        className="job__btn job__btn--ghost"
                        onClick={handleAlreadyCalibrated}
                      >
                        Machine already calibrated
                      </button>
                      <span className="phase-cal__skip-hint">
                        Four guided steps. Home first (once per power-on); the bed travel test at the end is optional.
                      </span>
                    </div>
                  ) : (
                    <p className="workspace__intro workspace__intro--compact">
                      Calibrated — re-run anytime, or switch to Prepare.
                    </p>
                  )}
                  <CalibrationPanel
                    jogPad={calibrationJogPad}
                    dense
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
                    onBackupSettings={() => {
                      void handleBackupSettingsDownload();
                    }}
                    undoLabel={
                      calUndoStack.length > 0
                        ? formatCalibrateUndoLabel(
                            calUndoStack[calUndoStack.length - 1]!,
                          )
                        : null
                    }
                    onUndoCalibrateWrite={() => {
                      void handleUndoCalibrateWrite();
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
                    onApplySoftTravel={(limits, enableSoft, enableHard) => {
                      void handleApplySoftTravel(
                        limits,
                        enableSoft,
                        enableHard,
                      );
                    }}
                    onVerifySoftLimit={(axis) => {
                      void handleVerifySoftLimit(axis);
                    }}
                    onRatesTrial={handleRatesTrial}
                    onWriteRates={(kind, axis, before, after) => {
                      void handleWriteRates(kind, axis, before, after);
                    }}
                    onRatesCancelRestore={() => {
                      void handleRestoreRatesPending("cancel/leave");
                    }}
                    ratesTrialRunning={ratesTrialRunning}
                    onWriteHomingSetting={(id, before, after) => {
                      void handleWriteHomingSetting(id, before, after);
                    }}
                    onToggleLimitPin={
                      usingMock
                        ? (axis) => {
                            void handleToggleLimitPin(axis);
                          }
                        : null
                    }
                    onZero={(axes) => {
                      void handleZero(axes);
                    }}
                    onComplete={handleCalibrationComplete}
                    onOpenBedTravelTest={openBedTravelTest}
                    homing={{
                      enabled:
                        canHome(gateState, connected, streaming).ok &&
                        !homeBusy,
                      blockedReason:
                        canHome(gateState, connected, streaming).reason ??
                        null,
                      homed,
                      busy: homeBusy,
                      message: homeMessage,
                      onHome: () => {
                        void handleHome();
                      },
                    }}
                  />
                </div>
              )}

              {taskPhase === "prepare" && (
                <div
                  className="workspace__panel workspace__panel--phase workspace__panel--prepare"
                  role="tabpanel"
                  id="phase-panel-prepare"
                  aria-labelledby="phase-tab-prepare"
                >
                  {!prepareReady ? (
                    <p className="workspace__intro workspace__intro--compact">
                      One screen per step — stock, material XY, Z, load, then{" "}
                      <strong>Mark ready → Verify</strong>.
                    </p>
                  ) : (
                    <p className="workspace__intro workspace__intro--compact">
                      Prepared — continue to Verify, or revisit a step.
                    </p>
                  )}
                  <div id="material-tool-settings">
                    <PrepareRunPanel
                      dense
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
                        canRunPrepareZProbe(
                          prepareProbeContinuityOk,
                          canProbe(gateState, connected, streaming),
                          !!status.pins?.probe,
                        ).ok && !prepareBusy
                      }
                      probeBlockedReason={
                        canRunPrepareZProbe(
                          prepareProbeContinuityOk,
                          canProbe(gateState, connected, streaming),
                          !!status.pins?.probe,
                        ).reason ?? null
                      }
                      probeContinuityOk={prepareProbeContinuityOk}
                      onSimulateProbeTouch={
                        usingMock ? () => void handleSimulateProbeTouch() : null
                      }
                      busy={prepareBusy}
                      message={prepareMessage}
                      zProbed={prepareZProbed}
                      xyZeroed={prepareXyZeroed}
                      jobLoaded={!!job}
                      prepareReady={prepareReady}
                      jogMode={jogMode}
                      stepMm={stepMm}
                      feedMmMin={feedMmMin}
                      softLimitHint={
                        softLimitHint ??
                        (!jogGate.ok && connected ? jogGate.reason : null)
                      }
                      gamepadStatus={gamepadStatus}
                      focusStep={prepareFocusStep}
                      onFocusStepConsumed={() => setPrepareFocusStep(null)}
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
                          "Ready — continue to Verify, then Start.",
                        );
                        activityLog.append(
                          "event",
                          "Prepare ready — Verify unlocked",
                        );
                        setTaskPhase("verify");
                      }}
                      onOpenStockPerimeter={openStockPerimeterTest}
                      xyProbe={{
                        enabled:
                          canProbe(gateState, connected, streaming, {
                            probePinActive: !!status.pins?.probe,
                          }).ok && !xyProbeBusy,
                        blockedReason:
                          canProbe(gateState, connected, streaming, {
                            probePinActive: !!status.pins?.probe,
                          }).reason ?? null,
                        busy: xyProbeBusy,
                        bitDiameterMm: tool.diameterMm,
                        message: xyProbeMessage,
                        onEdge: (axis, direction) => {
                          void handleXyEdgeProbe(axis, direction);
                        },
                        onCorner: (mode) => {
                          void handleXyCornerProbe(mode);
                        },
                        onToolLength: () => {
                          void handleToolLengthProbe();
                        },
                      }}
                      homing={{
                        enabled:
                          canHome(gateState, connected, streaming).ok &&
                          !homeBusy,
                        blockedReason:
                          canHome(gateState, connected, streaming).reason ??
                          null,
                        busy: homeBusy,
                        homed,
                        onHome: () => {
                          void handleHome();
                        },
                      }}
                      loadSlot={
                        <div className="prep__load">
                          <JobLoad
                            variant="prepare"
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
                            prepareReady={prepareReady}
                            timeEstimate={jobTimeEstimate}
                          />
                          <RecentJobsPanel
                            entries={recentJobs}
                            busy={streaming || simulating}
                            onOpen={handleOpenRecent}
                            onRemove={(id) =>
                              setRecentJobs(removeRecentJob(id))
                            }
                          />
                          <SvgJobPanel
                            draft={svgDraft}
                            busy={streaming}
                            toolDiameterMm={tool.diameterMm}
                            feeds={feeds}
                            feedsApplyToken={feedsApplyToken}
                            onLoadSvg={handleLoadSvg}
                            onLoadSvgText={(name, text) => {
                              if (streaming) return;
                              applySvgText(name, text);
                            }}
                            onClear={handleClearSvg}
                            onGenerate={handleGenerateFromSvg}
                          />
                          <div className="prep__external">
                            <button
                              type="button"
                              className={`cal__btn cal__btn--ghost${prepareShowExternal ? " is-active" : ""}`}
                              disabled={streaming || simulating}
                              onClick={() =>
                                setPrepareShowExternal((v) => !v)
                              }
                            >
                              {prepareShowExternal
                                ? "Hide external folder / Drive"
                                : "External folder / Drive…"}
                            </button>
                            {prepareShowExternal ? (
                              <ExternalJobsPanel
                                folder={jobsFolder}
                                drive={driveConfig}
                                busy={streaming || simulating}
                                highlight
                                onFolderChange={handleJobsFolderChange}
                                onDriveChange={handleDriveConfigChange}
                                onOpenExternal={handleOpenExternal}
                              />
                            ) : null}
                          </div>
                        </div>
                      }
                    />
                  </div>
                </div>
              )}

              {taskPhase === "verify" && (
                <div
                  className="workspace__panel workspace__panel--phase workspace__panel--verify"
                  role="tabpanel"
                  id="phase-panel-verify"
                  aria-labelledby="phase-tab-verify"
                >
                  {recoveryVisible && recovery ? (
                    <>
                      <p className="workspace__intro workspace__intro--compact">
                        Crash recovery — clear the path, then resume or abort.
                      </p>
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
                    </>
                  ) : (
                    <>
                      <p className="workspace__intro workspace__intro--compact">
                        Soft-limit check, simulate, confirm clear path, then
                        Start → Run.
                      </p>
                      <JobLoad
                        variant="verify"
                        job={job}
                        progress={streamProgress}
                        connected={connected}
                        machineState={status.state}
                        startBlockedReason={startBlockedReason}
                        softLimitOk={jobSoftCheck?.ok ?? null}
                        softLimitReason={jobSoftCheck?.reason ?? null}
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
                        prepareReady={prepareReady}
                        scrubIndex={scrubIndex}
                        onScrubIndexChange={setScrubIndex}
                        timeEstimate={jobTimeEstimate}
                        dryRun={dryRun}
                        onDryRunChange={handleDryRunChange}
                        verifyChecklist={verifyChecklist}
                        onVerifyChecklistChange={setVerifyChecklist}
                        showSimNudge={!verifyRunPrefs.simNudgeDismissed}
                        onDismissSimNudge={handleDismissSimNudge}
                        usingVirtualCnc={usingVirtualCnc}
                        toolChangeUi={toolChangeUi}
                        onToolChangeSameLength={handleToolChangeSameLength}
                        onToolChangeReprobeZ={() => {
                          void handleToolChangeReprobeZ();
                        }}
                        onResumeToolChange={() => {
                          void handleResumeToolChange();
                        }}
                      />
                    </>
                  )}
                </div>
              )}

              {taskPhase === "run" && (
                <div
                  className="workspace__panel workspace__panel--phase workspace__panel--run"
                  role="tabpanel"
                  id="phase-panel-run"
                  aria-labelledby="phase-tab-run"
                >
                  <p className="workspace__intro workspace__intro--compact">
                    Progress, current line, Hold / Stop. Feed and spindle
                    overrides stay on the safety strip.
                  </p>
                  <JobLoad
                    variant="run"
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
                    timeEstimate={jobTimeEstimate}
                    dryRun={dryRun}
                    toolChangeUi={toolChangeUi}
                    onToolChangeSameLength={handleToolChangeSameLength}
                    onToolChangeReprobeZ={() => {
                      void handleToolChangeReprobeZ();
                    }}
                    onResumeToolChange={() => {
                      void handleResumeToolChange();
                    }}
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
                canHome(gateState, connected, streaming).reason ?? null
              }
              homeMessage={homeMessage}
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
                jogPad={calibrationJogPad}
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
                onBackupSettings={() => {
                  void handleBackupSettingsDownload();
                }}
                undoLabel={
                  calUndoStack.length > 0
                    ? formatCalibrateUndoLabel(
                        calUndoStack[calUndoStack.length - 1]!,
                      )
                    : null
                }
                onUndoCalibrateWrite={() => {
                  void handleUndoCalibrateWrite();
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
                onApplySoftTravel={(limits, enableSoft, enableHard) => {
                  void handleApplySoftTravel(limits, enableSoft, enableHard);
                }}
                onVerifySoftLimit={(axis) => {
                  void handleVerifySoftLimit(axis);
                }}
                onRatesTrial={handleRatesTrial}
                onWriteRates={(kind, axis, before, after) => {
                  void handleWriteRates(kind, axis, before, after);
                }}
                onRatesCancelRestore={() => {
                  void handleRestoreRatesPending("cancel/leave");
                }}
                ratesTrialRunning={ratesTrialRunning}
                onWriteHomingSetting={(id, before, after) => {
                  void handleWriteHomingSetting(id, before, after);
                }}
                onToggleLimitPin={
                  usingMock
                    ? (axis) => {
                        void handleToggleLimitPin(axis);
                      }
                    : null
                }
                onZero={(axes) => {
                  void handleZero(axes);
                }}
                onClose={() => setCalOpen(false)}
                onComplete={handleCalibrationComplete}
                onOpenBedTravelTest={openBedTravelTest}
                homing={{
                  enabled:
                    canHome(gateState, connected, streaming).ok && !homeBusy,
                  blockedReason:
                    canHome(gateState, connected, streaming).reason ?? null,
                  homed,
                  busy: homeBusy,
                  message: homeMessage,
                  onHome: () => {
                    void handleHome();
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {logOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Activity log"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close activity log"
            onClick={() => setLogOpen(false)}
          />
          <div className="cal-modal__sheet cal-modal__sheet--wide">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">Menu · Debug</p>
                <h2 className="cal-modal__title">Activity log</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                onClick={() => setLogOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <ActivityLogPanel
                log={activityLog}
                debugMode={debugMode}
                bridgeEnabled={bridgeEnabled}
                bridgeStatus={bridgeStatus}
                bridgeError={bridgeError}
                onBridgeEnabledChange={setBridgeEnabled}
              />
            </div>
          </div>
        </div>
      )}

      {advancedOpen && (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Advanced"
        >
          <button
            type="button"
            className="cal-modal__backdrop"
            aria-label="Close Advanced"
            onClick={() => setAdvancedOpen(false)}
          />
          <div className="cal-modal__sheet cal-modal__sheet--wide">
            <header className="cal-modal__head">
              <div>
                <p className="cal-modal__eyebrow">Debugging only</p>
                <h2 className="cal-modal__title">Advanced</h2>
              </div>
              <button
                type="button"
                className="cal-modal__close"
                onClick={() => setAdvancedOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="cal-modal__body">
              <AdvancedPanel
                consoleEnabled={
                  canSendConsole(connected, streaming, status.state).ok
                }
                consoleBlockedReason={
                  canSendConsole(connected, streaming, status.state).reason ??
                  null
                }
                macros={macros}
                consoleResult={consoleResult}
                onSendConsole={(text) => {
                  void sendConsoleText(text);
                }}
                onRunMacro={(macro) => {
                  void sendConsoleText(macro.body);
                }}
                onSaveMacro={handleSaveMacro}
                onDeleteMacro={handleDeleteMacro}
                offsetsEnabled={jogEnabled}
                offsetsBlockedReason={
                  !connected
                    ? "Connect first."
                    : !jogGate.ok
                      ? (jogGate.reason ?? "Motion locked")
                      : null
                }
                activeWcs={workOffsets.active}
                offsetSlots={workOffsets.slots}
                currentWco={currentWco}
                offsetsMessage={offsetsMessage}
                onSelectWcs={(id) => {
                  void handleSelectWcs(id);
                }}
                onSaveOffset={handleSaveOffset}
                onRecallOffset={(id) => {
                  void handleRecallOffset(id);
                }}
                settingsEnabled={settingsGate.ok && !calBusy}
                settingsBlockedReason={
                  !connected
                    ? "Connect first."
                    : !settingsGate.ok
                      ? (settingsGate.reason ?? "Settings locked")
                      : calBusy
                        ? "Settings operation in progress…"
                        : null
                }
                settings={grblSettings}
                settingsBusy={calBusy}
                settingsMessage={calMessage}
                onRefreshSettings={() => {
                  void handleRefreshSettings();
                }}
                onWriteManual={(id, value) => {
                  void handleWriteManual(id, value);
                }}
                settingsSnapshots={settingsBackups.snapshots}
                restoreMessage={restoreMessage}
                onRestoreSettingsSnapshot={(snapshot) => {
                  void handleRestoreSettingsSnapshot(snapshot);
                }}
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

    </div>
  );
}
