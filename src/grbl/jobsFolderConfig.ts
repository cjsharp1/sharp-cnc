/**
 * Persisted local jobs-folder preferences (watched folder for .nc / .gcode / .svg).
 */

export interface JobsFolderConfig {
  /** Absolute folder path on the desktop machine. Empty = not configured. */
  path: string;
  /** When true, the UI re-lists the folder on an interval. */
  watch: boolean;
}

export const DEFAULT_JOBS_FOLDER: JobsFolderConfig = {
  path: "",
  watch: true,
};

const JOBS_FOLDER_STORAGE_KEY = "sharpcnc.jobsFolder.v1";

/** Poll interval while watching (ms). Network / Drive-for-Desktop friendly. */
export const JOBS_FOLDER_POLL_MS = 2500;

export function loadJobsFolderConfig(): JobsFolderConfig {
  try {
    const raw = localStorage.getItem(JOBS_FOLDER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_JOBS_FOLDER };
    const parsed = JSON.parse(raw) as Partial<JobsFolderConfig>;
    return {
      path: typeof parsed.path === "string" ? parsed.path : "",
      watch: typeof parsed.watch === "boolean" ? parsed.watch : true,
    };
  } catch {
    return { ...DEFAULT_JOBS_FOLDER };
  }
}

export function saveJobsFolderConfig(config: JobsFolderConfig): void {
  try {
    localStorage.setItem(
      JOBS_FOLDER_STORAGE_KEY,
      JSON.stringify({
        path: config.path,
        watch: config.watch,
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Short display label for a long absolute path. */
export function shortFolderLabel(path: string, max = 42): string {
  if (!path) return "No folder";
  if (path.length <= max) return path;
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(sep).filter(Boolean);
  if (parts.length <= 2) return `…${path.slice(-(max - 1))}`;
  const tail = parts.slice(-2).join(sep);
  return `…${sep}${tail}`;
}
