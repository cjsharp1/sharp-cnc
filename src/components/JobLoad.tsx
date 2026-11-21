import { useRef, useState, type DragEvent } from "react";
import type { LoadedJob, StreamPhase, StreamProgress } from "../grbl";
import { isGcodeFileName } from "../grbl";

export type JobRunPhase = StreamPhase | "idle";

interface JobLoadProps {
  job: LoadedJob | null;
  progress: StreamProgress | null;
  connected: boolean;
  machineState: string;
  /** Why start is blocked, if any. */
  startBlockedReason: string | null;
  onLoadFile: (file: File) => void;
  onClear: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function phaseLabel(phase: JobRunPhase): string {
  switch (phase) {
    case "running":
      return "Running";
    case "paused":
      return "Held";
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
  onLoadFile,
  onClear,
  onStart,
  onPause,
  onResume,
  onStop,
}: JobLoadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const phase: JobRunPhase = progress?.phase ?? "idle";
  const streaming =
    phase === "running" ||
    phase === "paused" ||
    phase === "stopping" ||
    phase === "error";
  const canStart =
    connected &&
    !!job &&
    job.lines.length > 0 &&
    !streaming &&
    !startBlockedReason;
  const showPause = phase === "running";
  const showResume = phase === "paused";
  const showStop =
    phase === "running" || phase === "paused" || phase === "error";

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

  return (
    <section
      className={`job${dragOver ? " is-dragover" : ""}`}
      aria-label="Job load and run"
      onDragOver={(e) => {
        e.preventDefault();
        if (!streaming) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="job__meta">
        <h2 className="job__title">Job</h2>
        <p className="job__name">{job?.name ?? "No file loaded"}</p>
        <p className="job__hint">
          {job
            ? `${lineText} · drop .nc / .gcode to replace`
            : "Load or drop .nc / .gcode"}
        </p>
      </div>

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
          {progress?.lastError && (
            <p className="job__error">{progress.lastError}</p>
          )}
          {startBlockedReason && !streaming && (
            <p className="job__warn-text">{startBlockedReason}</p>
          )}
        </div>
      )}

      {loadError && <p className="job__error">{loadError}</p>}

      <div className="job__actions">
        <button
          type="button"
          className="job__btn job__btn--ghost"
          disabled={streaming}
          onClick={() => inputRef.current?.click()}
        >
          {job ? "Replace" : "Load"}
        </button>
        {job && !streaming && (
          <button
            type="button"
            className="job__btn job__btn--ghost"
            onClick={onClear}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          className="job__btn"
          disabled={!canStart}
          title={startBlockedReason ?? undefined}
          onClick={onStart}
        >
          Start
        </button>
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
        {showStop && (
          <button type="button" className="job__btn job__btn--stop" onClick={onStop}>
            Stop
          </button>
        )}
      </div>
    </section>
  );
}
