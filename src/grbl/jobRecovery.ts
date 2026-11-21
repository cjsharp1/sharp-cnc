/**
 * Mid-job / crash recovery checkpoint (local).
 * Captures where the stream stopped so the operator can unlock, resume,
 * or safely abort after power loss / soft reset / alarm.
 */

export interface JobRecoveryCheckpoint {
  /** Job file / SVG name. */
  jobName: string;
  /** Total lines in the job when checkpointed. */
  totalLines: number;
  /** 0-based next line index to send (acked / start-at). */
  nextLine: number;
  /** Absolute 0-based line in the original job when known. */
  absoluteLine: number | null;
  /** Last known work position (mm). */
  work: { x: number; y: number; z: number } | null;
  /** Last known machine position (mm). */
  machine: { x: number; y: number; z: number } | null;
  /** Stream phase when saved. */
  phase: string;
  /** ISO-ish ms timestamp. */
  savedAt: number;
  /** Optional dry-run flag. */
  dryRun: boolean;
}

const STORAGE_KEY = "sharpcnc.jobRecovery.v1";

function isPos(v: unknown): v is { x: number; y: number; z: number } {
  if (!v || typeof v !== "object") return false;
  const p = v as { x?: unknown; y?: unknown; z?: unknown };
  return (
    typeof p.x === "number" &&
    typeof p.y === "number" &&
    typeof p.z === "number" &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.z)
  );
}

/** Load recovery checkpoint, or null if none / invalid. */
export function loadJobRecoveryCheckpoint(): JobRecoveryCheckpoint | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<JobRecoveryCheckpoint>;
    if (
      typeof parsed.jobName !== "string" ||
      !parsed.jobName ||
      typeof parsed.totalLines !== "number" ||
      typeof parsed.nextLine !== "number" ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.totalLines) ||
      !Number.isFinite(parsed.nextLine) ||
      parsed.totalLines < 0 ||
      parsed.nextLine < 0
    ) {
      return null;
    }
    return {
      jobName: parsed.jobName,
      totalLines: Math.floor(parsed.totalLines),
      nextLine: Math.floor(parsed.nextLine),
      absoluteLine:
        typeof parsed.absoluteLine === "number" &&
        Number.isFinite(parsed.absoluteLine)
          ? Math.floor(parsed.absoluteLine)
          : null,
      work: isPos(parsed.work) ? parsed.work : null,
      machine: isPos(parsed.machine) ? parsed.machine : null,
      phase: typeof parsed.phase === "string" ? parsed.phase : "unknown",
      savedAt: parsed.savedAt,
      dryRun: parsed.dryRun === true,
    };
  } catch {
    return null;
  }
}

/** Persist a recovery checkpoint. */
export function saveJobRecoveryCheckpoint(
  checkpoint: JobRecoveryCheckpoint,
): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoint));
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Clear recovery checkpoint (job completed or operator dismissed). */
export function clearJobRecoveryCheckpoint(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** True when a checkpoint looks like an interrupted job (not fully done). */
export function isIncompleteRecovery(
  checkpoint: JobRecoveryCheckpoint | null,
): boolean {
  if (!checkpoint) return false;
  if (checkpoint.totalLines <= 0) return false;
  return checkpoint.nextLine < checkpoint.totalLines;
}

/** Human label for resume line (1-based). */
export function recoveryResumeLineLabel(
  checkpoint: JobRecoveryCheckpoint,
): string {
  const line =
    (checkpoint.absoluteLine ?? checkpoint.nextLine) + 1;
  return `line ${line} of ${checkpoint.totalLines}`;
}

/** Format a position or em dash. */
export function formatRecoveryPos(
  pos: { x: number; y: number; z: number } | null,
): string {
  if (!pos) return "—";
  const f = (n: number) => n.toFixed(3);
  return `X${f(pos.x)} Y${f(pos.y)} Z${f(pos.z)}`;
}
