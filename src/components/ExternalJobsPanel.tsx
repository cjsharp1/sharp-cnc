import { useEffect, useRef, useState } from "react";
import {
  jobsFolderExists,
  listJobFiles,
  pickJobsFolder,
  readJobFile,
  type JobFileEntry,
} from "../grbl/desktopJobsFolder";
import {
  clearDriveConfig,
  isDriveConfigured,
  type DriveConfig,
} from "../grbl/driveConfig";
import {
  beginDriveConnect,
  driveStatusLabel,
} from "../grbl/googleDrive";
import {
  JOBS_FOLDER_ERROR_BACKOFF_MS,
  JOBS_FOLDER_POLL_MS,
  jobsFolderHealthLabel,
  shortFolderLabel,
  type JobsFolderConfig,
  type JobsFolderHealth,
} from "../grbl/jobsFolderConfig";
import { isDesktopShell } from "../grbl/session";

export type ExternalJobKind = "gcode" | "svg";

interface ExternalJobsPanelProps {
  folder: JobsFolderConfig;
  drive: DriveConfig;
  busy: boolean;
  highlight?: boolean;
  onFolderChange: (next: JobsFolderConfig) => void;
  onDriveChange: (next: DriveConfig) => void;
  onOpenExternal: (name: string, text: string, kind: ExternalJobKind) => void;
}

function formatModified(ms: number | null): string {
  if (ms == null) return "";
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ExternalJobsPanel({
  folder,
  drive,
  busy,
  highlight = false,
  onFolderChange,
  onDriveChange,
  onOpenExternal,
}: ExternalJobsPanelProps) {
  const desktop = isDesktopShell();
  const driveReady = isDriveConfigured();
  const [files, setFiles] = useState<JobFileEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [driveMessage, setDriveMessage] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [folderMissing, setFolderMissing] = useState(false);
  const [health, setHealth] = useState<JobsFolderHealth>("idle");
  const [lastOkAt, setLastOkAt] = useState<number | null>(null);
  const [failStreak, setFailStreak] = useState(0);
  const fingerprintRef = useRef("");
  const nextAllowedPollRef = useRef(0);

  const refresh = async (silent = false) => {
    if (!desktop || !folder.path) {
      setFiles([]);
      setFolderMissing(false);
      setHealth("idle");
      if (!silent) setListError(null);
      return;
    }
    if (silent && Date.now() < nextAllowedPollRef.current) {
      return;
    }
    if (!silent) setListing(true);
    try {
      const exists = await jobsFolderExists(folder.path);
      setFolderMissing(!exists);
      if (!exists) {
        setFiles([]);
        setHealth("missing");
        setFailStreak((n) => n + 1);
        nextAllowedPollRef.current = Date.now() + JOBS_FOLDER_ERROR_BACKOFF_MS;
        setListError("Folder not found — pick it again (Drive sync offline?).");
        return;
      }
      const next = await listJobFiles(folder.path);
      const fp = next
        .map((f) => `${f.name}:${f.modifiedMs ?? 0}`)
        .join("|");
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setFiles(next);
      }
      setListError(null);
      setHealth("ok");
      setFailStreak(0);
      setLastOkAt(Date.now());
      nextAllowedPollRef.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setListError(
        `${message} — watched folders over Drive/network can flake; retrying with backoff.`,
      );
      setHealth("error");
      setFailStreak((n) => n + 1);
      nextAllowedPollRef.current = Date.now() + JOBS_FOLDER_ERROR_BACKOFF_MS;
    } finally {
      if (!silent) setListing(false);
    }
  };

  useEffect(() => {
    void refresh(true);
  }, [folder.path, desktop]);

  useEffect(() => {
    if (!desktop || !folder.path || !folder.watch) return;
    const id = window.setInterval(() => {
      void refresh(true);
    }, JOBS_FOLDER_POLL_MS);
    return () => window.clearInterval(id);
  }, [desktop, folder.path, folder.watch]);

  const handlePick = async () => {
    setActionError(null);
    try {
      const path = await pickJobsFolder();
      if (!path) return;
      onFolderChange({ ...folder, path });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
    }
  };

  const handleClearFolder = () => {
    onFolderChange({ ...folder, path: "" });
    setFiles([]);
    fingerprintRef.current = "";
    setListError(null);
    setFolderMissing(false);
  };

  const handleOpen = async (entry: JobFileEntry) => {
    if (busy || !folder.path) return;
    setActionError(null);
    try {
      const text = await readJobFile(folder.path, entry.path);
      const kind: ExternalJobKind = entry.kind === "svg" ? "svg" : "gcode";
      onOpenExternal(entry.name, text, kind);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
    }
  };

  const handleDriveConnect = async () => {
    setDriveMessage(null);
    setActionError(null);
    const result = await beginDriveConnect();
    if (result.ok) {
      setDriveMessage(result.message);
    } else {
      setActionError(result.reason);
    }
  };

  const handleDriveDisconnect = () => {
    clearDriveConfig();
    onDriveChange({
      folderId: "",
      folderName: "",
      accountHint: "",
    });
    setDriveMessage("Drive connection cleared.");
  };

  return (
    <section
      className={`extjobs${highlight ? " is-flash" : ""}`}
      aria-label="External jobs"
      id="external-jobs"
    >
      <div className="extjobs__meta">
        <h2 className="extjobs__title">External jobs</h2>
        <p className="extjobs__hint">
          Watched folder for .nc / .gcode / .svg · Google Drive when configured
        </p>
        {folder.path ? (
          <p className="extjobs__health" role="status">
            {jobsFolderHealthLabel(health)}
            {failStreak > 0 ? ` · ${failStreak} fail(s)` : ""}
            {lastOkAt
              ? ` · last ok ${new Date(lastOkAt).toLocaleTimeString()}`
              : ""}
          </p>
        ) : null}
      </div>

      <div className="extjobs__block">
        <div className="extjobs__row">
          <div className="extjobs__path-wrap">
            <p className="extjobs__label">Local folder</p>
            <p className="extjobs__path" title={folder.path || undefined}>
              {folder.path
                ? shortFolderLabel(folder.path)
                : desktop
                  ? "Not set"
                  : "Desktop app only"}
            </p>
          </div>
          <div className="extjobs__actions">
            <button
              type="button"
              className="extjobs__btn extjobs__btn--ghost"
              disabled={!desktop || busy}
              onClick={() => {
                void handlePick();
              }}
            >
              {folder.path ? "Change…" : "Pick…"}
            </button>
            {folder.path && (
              <button
                type="button"
                className="extjobs__btn extjobs__btn--ghost"
                disabled={busy}
                onClick={handleClearFolder}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="extjobs__btn extjobs__btn--ghost"
              disabled={!desktop || !folder.path || listing || busy}
              onClick={() => {
                void refresh(false);
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {folder.path && (
          <label className="extjobs__watch">
            <input
              type="checkbox"
              checked={folder.watch}
              disabled={!desktop}
              onChange={(e) =>
                onFolderChange({ ...folder, watch: e.target.checked })
              }
            />
            Auto-refresh
          </label>
        )}

        {folderMissing && (
          <p className="extjobs__warn">Folder missing on disk.</p>
        )}
        {listError && <p className="extjobs__error">{listError}</p>}

        {folder.path && !folderMissing && (
          <ul className="extjobs__list" aria-label="Job files in folder">
            {files.length === 0 && !listing && (
              <li className="extjobs__empty">No .nc / .gcode / .svg files</li>
            )}
            {files.map((entry) => (
              <li key={entry.path} className="extjobs__item">
                <button
                  type="button"
                  className="extjobs__file"
                  disabled={busy}
                  onClick={() => {
                    void handleOpen(entry);
                  }}
                >
                  <span className="extjobs__file-name">{entry.name}</span>
                  <span className="extjobs__file-meta">
                    {entry.kind}
                    {entry.modifiedMs != null
                      ? ` · ${formatModified(entry.modifiedMs)}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="extjobs__block extjobs__block--drive">
        <div className="extjobs__row">
          <div className="extjobs__path-wrap">
            <p className="extjobs__label">Google Drive</p>
            <p className="extjobs__path">
              {driveStatusLabel(driveReady, drive)}
            </p>
          </div>
          <div className="extjobs__actions">
            {driveReady ? (
              <>
                <button
                  type="button"
                  className="extjobs__btn extjobs__btn--ghost"
                  disabled={busy}
                  onClick={() => {
                    void handleDriveConnect();
                  }}
                >
                  {drive.accountHint ? "Reconnect…" : "Connect…"}
                </button>
                {(drive.accountHint || drive.folderId) && (
                  <button
                    type="button"
                    className="extjobs__btn extjobs__btn--ghost"
                    disabled={busy}
                    onClick={handleDriveDisconnect}
                  >
                    Disconnect
                  </button>
                )}
              </>
            ) : (
              <span className="extjobs__badge">Setup needed</span>
            )}
          </div>
        </div>
        {!driveReady && (
          <p className="extjobs__hint-inline">
            Add a Google OAuth client ID to enable Drive. Until then, point the
            watched folder at Drive for Desktop / USB / network. See{" "}
            <code>docs/google-drive-setup.md</code>.
          </p>
        )}
        {driveReady && !drive.folderId && (
          <p className="extjobs__hint-inline">
            Connect opens Google sign-in (PKCE). Folder pick + file load finish
            after the OAuth loopback is wired with your client ID. Until then,
            prefer a watched folder pointed at Drive for Desktop for reliability.
          </p>
        )}
        {driveReady && (
          <p className="extjobs__hint-inline">
            Drive listing can lag when offline. Keep Auto-refresh on the local
            watched folder as the primary job inbox.
          </p>
        )}
        {driveMessage && <p className="extjobs__ok">{driveMessage}</p>}
      </div>

      {actionError && <p className="extjobs__error">{actionError}</p>}
    </section>
  );
}
