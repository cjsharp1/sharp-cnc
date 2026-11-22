/**
 * Official Tauri updater (SC-79): download + verify + apply NSIS, then relaunch.
 *
 * Requires a desktop shell with tauri-plugin-updater + signed Release assets
 * (`latest.json` + `SharpCNC_*_x64-setup.exe.sig`). Browser builds never install.
 */

import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { isDesktopShell } from "./session";

export type DesktopUpdateProgress = {
  phase: "checking" | "downloading" | "installing" | "relaunching";
  downloadedBytes: number;
  totalBytes: number | null;
};

export type DesktopUpdateResult =
  | { status: "up-to-date" }
  | { status: "installed"; version: string }
  | {
      status: "error";
      reason: "not-desktop" | "unavailable" | "failed";
      message: string;
    };

function progressFromEvent(
  event: DownloadEvent,
  state: { downloaded: number; total: number | null },
): DesktopUpdateProgress {
  switch (event.event) {
    case "Started":
      state.total =
        typeof event.data.contentLength === "number"
          ? event.data.contentLength
          : null;
      state.downloaded = 0;
      return {
        phase: "downloading",
        downloadedBytes: 0,
        totalBytes: state.total,
      };
    case "Progress":
      state.downloaded += event.data.chunkLength;
      return {
        phase: "downloading",
        downloadedBytes: state.downloaded,
        totalBytes: state.total,
      };
    case "Finished":
      return {
        phase: "installing",
        downloadedBytes: state.downloaded,
        totalBytes: state.total,
      };
    default:
      return {
        phase: "downloading",
        downloadedBytes: state.downloaded,
        totalBytes: state.total,
      };
  }
}

/** Probe whether a signed updater package is available (does not download). */
export async function checkDesktopUpdater(): Promise<Update | null> {
  if (!isDesktopShell()) return null;
  try {
    return await check();
  } catch {
    return null;
  }
}

/**
 * Download the signed update, apply it (Windows NSIS passive), and relaunch.
 * On Windows the process typically exits during install; relaunch is best-effort.
 */
export async function installDesktopUpdateAndRelaunch(
  onProgress?: (p: DesktopUpdateProgress) => void,
): Promise<DesktopUpdateResult> {
  if (!isDesktopShell()) {
    return {
      status: "error",
      reason: "not-desktop",
      message:
        "In-app install only works in the Windows SharpCNC desktop app.",
    };
  }

  onProgress?.({
    phase: "checking",
    downloadedBytes: 0,
    totalBytes: null,
  });

  let update: Update | null;
  try {
    update = await check();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      reason: "unavailable",
      message:
        /404|not found|failed to fetch|network/i.test(message)
          ? "No signed updater package found yet (need latest.json on the Release), or GitHub is unreachable."
          : `Updater check failed: ${message}`,
    };
  }

  if (!update) {
    return { status: "up-to-date" };
  }

  const state = { downloaded: 0, total: null as number | null };
  try {
    await update.downloadAndInstall((event) => {
      onProgress?.(progressFromEvent(event, state));
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      reason: "failed",
      message: `Could not download or apply the update: ${message}`,
    };
  }

  onProgress?.({
    phase: "relaunching",
    downloadedBytes: state.downloaded,
    totalBytes: state.total,
  });

  try {
    await relaunch();
  } catch {
    // Windows often exits during NSIS install; relaunch may not return.
  }

  return { status: "installed", version: update.version };
}
