import { useRef, useState, type DragEvent } from "react";
import type {
  JobTimeEstimate,
  LoadedJob,
  SimActivity,
  SimPhase,
  SimSpeedRate,
  StreamPhase,
  StreamProgress,
  VerifyChecklistState,
} from "../grbl";
import { VERIFY_CHECKLIST, isGcodeFileName } from "../grbl";
import { SimControls } from "./SimControls";

export type JobRunPhase = StreamPhase | "idle";

/** Which actions this panel exposes for the task-phase shell. */
export type JobLoadVariant = "full" | "prepare" | "verify" | "run";

interface JobLoadProps {
  job: LoadedJob | null;
  progress: StreamProgress | null;
  connected: boolean;
  machineState: string;
  /** Why start is blocked, if any. */
  startBlockedReason: string | null;
  /** Pre-run visualizer simulation (no serial). */
  simPhase?: SimPhase;
  simProgress?: number;
  simSpeed?: SimSpeedRate;
  onSimSpeedChange?: (rate: SimSpeedRate) => void;
  simZMm?: number | null;
  simActivity?: SimActivity | null;
  simDisabled?: boolean;
  simDisabledReason?: string | null;
  onSimPlay?: () => void;
  onSimPause?: () => void;
  onSimStop?: () => void;
  onLoadFile: (file: File) => void;
  onClear: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** Open pre-start / Z-probe wizard. */
  onPrepareRun?: () => void;
  /** Session work-zero confirmed via Prepare wizard. */
  prepareReady?: boolean;
  /** Scrubber: 0-based start line for next Start. */
  scrubIndex?: number;
  onScrubIndexChange?: (index: number) => void;
  timeEstimate?: JobTimeEstimate | null;
  dryRun?: boolean;
  onDryRunChange?: (enabled: boolean) => void;
  onResumeToolChange?: () => void;
  /**
   * Phase-shell mode: prepare = load only; verify = sim + Start;
   * run = progress + hold/stop; full = legacy all-in-one.
   */
  variant?: JobLoadVariant;
  /** Soft-limit summary for Verify (already checked in App). */
  softLimitOk?: boolean | null;
  softLimitReason?: string | null;
  /** Session clear-path checklist (Verify). */
  verifyChecklist?: VerifyChecklistState;
  onVerifyChecklistChange?: (next: VerifyChecklistState) => void;
  /** Soft “simulate once” nudge — not a hard gate after dismiss. */
  showSimNudge?: boolean;
  onDismissSimNudge?: () => void;
  /** Virtual CNC practice hint on Verify. */
  usingVirtualCnc?: boolean;
}

function phaseLabel(phase: JobRunPhase): string {
  switch (phase) {
    case "running":
      return "Running";
    case "paused":
      return "Held";
    case "tool-change":
      return "Tool change";
    case "stopping":
      return "Stopping";
    case "completed":
      return "Done";
    case "error":
      return "Error";
    default:
      return "Ready";
  }
}

export function JobLoad({
  job,
  progress,
  connected,
  machineState,
  startBlockedReason,
  simPhase = "idle",
  simProgress = 0,
  simSpeed,
  onSimSpeedChange,
  simZMm = null,
  simActivity = null,
  simDisabled = false,
  simDisabledReason = null,
  onSimPlay,
  onSimPause,
  onSimStop,
  onLoadFile,
  onClear,
  onStart,
  onPause,
  onResume,
  onStop,
  onPrepareRun,
  prepareReady = false,
  scrubIndex = 0,
  onScrubIndexChange,
  timeEstimate = null,
  dryRun = false,
  onDryRunChange,
  onResumeToolChange,
  variant = "full",
  softLimitOk = null,
  softLimitReason = null,
  verifyChecklist,
  onVerifyChecklistChange,
  showSimNudge = false,
  onDismissSimNudge,
  usingVirtualCnc = false,
}: JobLoadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const showLoad = variant === "full" || variant === "prepare";
  /** Prepare-to-run lives in the Prepare phase wizard — only legacy full shows the button. */
  const showPrepareBtn = variant === "full";
  const showSim = variant === "full" || variant === "verify";
  const showStart = variant === "full" || variant === "verify";
  /** Pause / Resume / Stop belong in Run (and legacy full). Verify only Starts. */
  const showRunControls = variant === "full" || variant === "run";
  const showScrubber = variant === "full" || variant === "verify";
  const showVerifyExtras = variant === "verify";
  const dense = variant === "verify" || variant === "run";

  const phase: JobRunPhase = progress?.phase ?? "idle";
  const streaming =
    phase === "running" ||
    phase === "paused" ||
    phase === "tool-change" ||
    phase === "stopping" ||
    phase === "error";
  const simulating =
    simPhase === "playing" || simPhase === "paused" || simPhase === "done";
  const canStart =
    showStart &&
    connected &&
    !!job &&
    job.lines.length > 0 &&
    !streaming &&
    !simulating &&
    !startBlockedReason;
  const canSimulate =
    showSim &&
    !!job &&
    job.path.length > 0 &&
    !streaming &&
    !simDisabled &&
    !!onSimPlay &&
    !!onSimPause &&
    !!onSimStop;
  const showPause = showRunControls && phase === "running";
  const showResume = showRunControls && phase === "paused";
  const showToolChange = showRunControls && phase === "tool-change";
  const showStop =
    showRunControls &&
    (phase === "running" ||
      phase === "paused" ||
      phase === "tool-change" ||
      phase === "error");

  const titleByVariant =
    variant === "prepare"
      ? "Load"
      : variant === "verify"
        ? "Verify"
        : variant === "run"
          ? "Run"
          : "Job";

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!isGcodeFileName(file.name)) {
      setLoadError("Use a .nc / .gcode file.");
      return;
    }
    setLoadError(null);
    onLoadFile(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (streaming) return;
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const percent = progress?.percent ?? 0;
  const lineText = progress
    ? `Line ${Math.min(progress.ackedLines, progress.totalLines)} / ${progress.totalLines}`
    : job
      ? `${job.lines.length} lines`
      : null;

  const maxScrub = job ? Math.max(0, job.lines.length - 1) : 0;
  const previewLine =
    job && job.lines.length > 0
      ? job.lines[Math.min(scrubIndex, maxScrub)]
      : null;

  const streamLineIndex =
    progress?.absoluteLine != null
      ? Math.min(
          Math.max(0, progress.absoluteLine),
          Math.max(0, (job?.lines.length ?? 1) - 1),
        )
      : progress
        ? Math.min(
            Math.max(0, progress.ackedLines),
            Math.max(0, progress.totalLines - 1),
          )
        : 0;
  const currentStreamLine =
    job && streaming && job.lines.length > 0
      ? job.lines[streamLineIndex]
      : null;

  return (
    <section
      className={`job${dense ? " job--dense" : ""}${
        dragOver && showLoad ? " is-dragover" : ""
      }${variant === "run" ? " job--run" : ""}${
        variant === "verify" ? " job--verify" : ""
      }`}
      aria-label={
        variant === "run"
          ? "Job run"
          : variant === "verify"
            ? "Job verify and start"
            : variant === "prepare"
              ? "Job load"
              : "Job load and run"
      }
      onDragOver={(e) => {
        if (!showLoad) return;
        e.preventDefault();
        if (!streaming) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={showLoad ? onDrop : undefined}
    >
      <div className="job__meta">
        <h2 className="job__title">{titleByVariant}</h2>
        <p className="job__name">{job?.name ?? "No file loaded"}</p>
        <p className="job__hint">
          {job
            ? `${lineText}${timeEstimate ? ` · ${timeEstimate.label}` : ""}${
                showLoad ? " · drop .nc / .gcode to replace" : ""
              }${dryRun && variant === "run" ? " · dry run" : ""}`
            : showLoad
              ? "Load or drop .nc / .gcode"
              : "No file loaded"}
        </p>
      </div>

      {showLoad ? (
        <input
          ref={inputRef}
          type="file"
          accept=".nc,.gcode,.ngc,.tap,text/plain"
          className="job__file"
          onChange={(e) => {
            acceptFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      ) : null}

      {showVerifyExtras && softLimitOk != null ? (
        <p
          className={
            softLimitOk ? "job__softok" : "job__warn-text"
          }
          role="status"
        >
          {softLimitOk
            ? "Path fits soft travel."
            : (softLimitReason ?? "Path outside soft limits")}
        </p>
      ) : null}

      {(job || progress) && (
        <div className="job__status" aria-live="polite">
          <div className="job__status-row">
            <span className={`job__phase is-${phase}`}>{phaseLabel(phase)}</span>
            {progress && streaming && (
              <span className="job__line">{lineText}</span>
            )}
            {progress && phase === "completed" && (
              <span className="job__line">100%</span>
            )}
            {!streaming && machineState === "Alarm" && (
              <span className="job__warn">Alarm</span>
            )}
            {dryRun && !streaming && showScrubber && (
              <span className="job__warn">Dry run</span>
            )}
          </div>
          {(streaming || phase === "completed") && (
            <div
              className="job__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className="job__bar-fill" style={{ width: `${percent}%` }} />
            </div>
          )}
          {currentStreamLine && (
            <p className="job__stream-line" title={currentStreamLine}>
              <span className="job__stream-label">G-code</span>
              <code>{currentStreamLine}</code>
            </p>
          )}
          {progress?.lastError && (
            <p className="job__error">{progress.lastError}</p>
          )}
          {progress?.toolChangeMessage && phase === "tool-change" && (
            <p className="job__toolchange" role="status">
              {progress.toolChangeMessage}
            </p>
          )}
          {showStart && startBlockedReason && !streaming && (
            <p className="job__warn-text">{startBlockedReason}</p>
          )}
        </div>
      )}

      {showScrubber && job && onScrubIndexChange && !streaming && (
        <div className="job__scrubber">
          <label className="job__scrub-label" htmlFor="job-scrub">
            Start at line {scrubIndex + 1}
            {previewLine ? (
              <span className="job__scrub-preview"> · {previewLine}</span>
            ) : null}
          </label>
          {scrubIndex > 0 ? (
            <p className="job__scrub-note">
              Starting mid-file: SharpCNC first restores units, offsets, feed, and
              spindle from earlier lines, then retracts, moves over this point,
              spins up, and plunges. Details go to the activity log.
            </p>
          ) : null}
          <input
            id="job-scrub"
            type="range"
            className="job__scrub"
            min={0}
            max={maxScrub}
            value={Math.min(scrubIndex, maxScrub)}
            disabled={simulating}
            onChange={(e) => onScrubIndexChange(Number(e.target.value))}
          />
          <div className="job__scrub-actions">
            <button
              type="button"
              className="job__btn job__btn--ghost"
              disabled={simulating || scrubIndex === 0}
              onClick={() => onScrubIndexChange(0)}
            >
              Reset to start
            </button>
            {onDryRunChange && (
              <label
                className="job__dryrun"
                title="Spindle stays off and every Z is lifted so the deepest cut stays 5 mm above material Z0. Use it to watch the path in the air."
              >
                <input
                  type="checkbox"
                  checked={dryRun}
                  disabled={simulating}
                  onChange={(e) => onDryRunChange(e.target.checked)}
                />
                Dry run (spindle off, Z lifted above the stock)
              </label>
            )}
          </div>
        </div>
      )}

      {loadError && <p className="job__error">{loadError}</p>}

      {showSim &&
        job &&
        job.path.length > 0 &&
        onSimPlay &&
        onSimPause &&
        onSimStop && (
          <SimControls
            variant="panel"
            phase={simPhase}
            progress={simProgress}
            speed={simSpeed}
            onSpeedChange={onSimSpeedChange}
            zMm={simZMm}
            activity={simActivity}
            disabled={!canSimulate && !simulating}
            disabledReason={
              streaming
                ? "Stop the running job before simulating."
                : simDisabledReason
            }
            onPlay={onSimPlay}
            onPause={onSimPause}
            onStop={onSimStop}
          />
        )}

      {showVerifyExtras && showSimNudge && onDismissSimNudge && (
        <div className="job__nudge" role="status">
          <p>
            {usingVirtualCnc
              ? "Simulate once here before Start on the real machine."
              : "Simulate once on Virtual CNC before Start on the real machine."}
          </p>
          <button
            type="button"
            className="job__btn job__btn--ghost"
            onClick={onDismissSimNudge}
          >
            Got it
          </button>
        </div>
      )}

      {showVerifyExtras &&
        verifyChecklist &&
        onVerifyChecklistChange &&
        !streaming && (
          <fieldset className="job__checklist">
            <legend className="job__checklist-legend">Before Start</legend>
            {VERIFY_CHECKLIST.map((item) => (
              <label key={item.id} className="job__check">
                <input
                  type="checkbox"
                  checked={verifyChecklist[item.id]}
                  disabled={simulating}
                  onChange={(e) =>
                    onVerifyChecklistChange({
                      ...verifyChecklist,
                      [item.id]: e.target.checked,
                    })
                  }
                />
                {item.label}
              </label>
            ))}
          </fieldset>
        )}

      <div className="job__actions">
        {showLoad ? (
          <button
            type="button"
            className="job__btn job__btn--ghost"
            disabled={streaming || simulating}
            onClick={() => inputRef.current?.click()}
          >
            {job ? "Replace" : "Load"}
          </button>
        ) : null}
        {showLoad && job && !streaming && !simulating && (
          <button
            type="button"
            className="job__btn job__btn--ghost"
            onClick={onClear}
          >
            Clear
          </button>
        )}
        {showPrepareBtn && onPrepareRun && job && !streaming && (
          <button
            type="button"
            className={`job__btn job__btn--ghost${prepareReady ? " is-ready" : ""}`}
            disabled={simulating}
            onClick={onPrepareRun}
            title="Stock, tool, XY zero, Z probe — required before Verify"
          >
            {prepareReady ? "Prepared" : "Prepare…"}
          </button>
        )}
        {showStart ? (
          <button
            type="button"
            className="job__btn"
            disabled={!canStart}
            title={
              simulating
                ? "Stop the preview before starting the job."
                : (startBlockedReason ?? undefined)
            }
            onClick={onStart}
          >
            {scrubIndex > 0 ? `Start @ ${scrubIndex + 1}` : "Start"}
          </button>
        ) : null}
        {showPause && (
          <button type="button" className="job__btn job__btn--hold" onClick={onPause}>
            Pause
          </button>
        )}
        {showResume && (
          <button type="button" className="job__btn" onClick={onResume}>
            Resume
          </button>
        )}
        {showToolChange && onResumeToolChange && (
          <button
            type="button"
            className="job__btn"
            onClick={onResumeToolChange}
            title="Bit changed — continue past M6"
          >
            Resume after tool change
          </button>
        )}
        {showStop && (
          <button type="button" className="job__btn job__btn--stop" onClick={onStop}>
            Stop
          </button>
        )}
      </div>
    </section>
  );
}
