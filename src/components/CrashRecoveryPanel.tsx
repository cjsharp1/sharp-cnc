import {
  formatRecoveryPos,
  recoveryResumeLineLabel,
  type JobRecoveryCheckpoint,
} from "../grbl";

interface CrashRecoveryPanelProps {
  checkpoint: JobRecoveryCheckpoint;
  connected: boolean;
  machineState: string;
  alarmMessage: string | null;
  workPos: { x: number; y: number; z: number } | null;
  machinePos: { x: number; y: number; z: number } | null;
  jobLoaded: boolean;
  jobMatches: boolean;
  onUnlock: () => void;
  onResumeFromCheckpoint: () => void;
  onSafeAbort: () => void;
  onDismiss: () => void;
}

export function CrashRecoveryPanel({
  checkpoint,
  connected,
  machineState,
  alarmMessage,
  workPos,
  machinePos,
  jobLoaded,
  jobMatches,
  onUnlock,
  onResumeFromCheckpoint,
  onSafeAbort,
  onDismiss,
}: CrashRecoveryPanelProps) {
  const inAlarm = machineState === "Alarm";
  const resumeLabel = recoveryResumeLineLabel(checkpoint);
  const when = new Date(checkpoint.savedAt).toLocaleString();

  return (
    <section
      className="recovery"
      role="region"
      aria-label="Crash and mid-job recovery"
    >
      <header className="recovery__head">
        <div>
          <p className="recovery__eyebrow">Recovery</p>
          <h2 className="recovery__title">Where am I?</h2>
        </div>
        <span
          className={`recovery__state${inAlarm ? " is-alarm" : ""}`}
          aria-live="polite"
        >
          {machineState}
        </span>
      </header>

      <p className="recovery__lead">
        Interrupted job <strong>{checkpoint.jobName}</strong> · saved {when}
        {checkpoint.dryRun ? " · dry run" : ""}. Review position, unlock if
        needed, then resume from the checkpoint or safely abort.
      </p>

      <dl className="recovery__facts">
        <div>
          <dt>Checkpoint</dt>
          <dd>{resumeLabel}</dd>
        </div>
        <div>
          <dt>Last stream phase</dt>
          <dd>{checkpoint.phase}</dd>
        </div>
        <div>
          <dt>Work (saved)</dt>
          <dd className="recovery__mono">{formatRecoveryPos(checkpoint.work)}</dd>
        </div>
        <div>
          <dt>Machine (saved)</dt>
          <dd className="recovery__mono">
            {formatRecoveryPos(checkpoint.machine)}
          </dd>
        </div>
        <div>
          <dt>Work (live)</dt>
          <dd className="recovery__mono">{formatRecoveryPos(workPos)}</dd>
        </div>
        <div>
          <dt>Machine (live)</dt>
          <dd className="recovery__mono">{formatRecoveryPos(machinePos)}</dd>
        </div>
      </dl>

      {inAlarm ? (
        <p className="recovery__warn" role="alert">
          Alarm lock
          {alarmMessage ? ` — ${alarmMessage}` : ""}. Clear the physical cause,
          then Unlock before any resume.
        </p>
      ) : null}

      {!jobLoaded ? (
        <p className="recovery__warn">
          Load the same job file again before resume (name should match{" "}
          <strong>{checkpoint.jobName}</strong>).
        </p>
      ) : !jobMatches ? (
        <p className="recovery__warn">
          Loaded job name does not match the checkpoint. Load{" "}
          <strong>{checkpoint.jobName}</strong> or abort this recovery.
        </p>
      ) : null}

      <div className="recovery__actions">
        <button
          type="button"
          className="recovery__btn recovery__btn--unlock"
          disabled={!connected || !inAlarm}
          onClick={onUnlock}
        >
          Unlock ($X)
        </button>
        <button
          type="button"
          className="recovery__btn"
          disabled={
            !connected || inAlarm || !jobLoaded || !jobMatches
          }
          onClick={onResumeFromCheckpoint}
          title={`Set scrubber to ${resumeLabel} and prepare Start`}
        >
          Resume from checkpoint
        </button>
        <button
          type="button"
          className="recovery__btn recovery__btn--danger"
          onClick={onSafeAbort}
          title="Stop any stream, clear checkpoint, keep spindle off"
        >
          Safe abort
        </button>
        <button
          type="button"
          className="recovery__btn recovery__btn--ghost"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
