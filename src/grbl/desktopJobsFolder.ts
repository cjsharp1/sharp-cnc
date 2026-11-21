/**
 * Tauri invoke wrappers for the local jobs folder (desktop only).
 */

import { invoke } from "@tauri-apps/api/core";
import { isDesktopShell } from "./session";

export interface JobFileEntry {
  name: string;
  path: string;
  kind: "gcode" | "svg" | string;
  modifiedMs: number | null;
}

export async function pickJobsFolder(): Promise<string | null> {
  if (!isDesktopShell()) {
    throw new Error("Jobs folder pick requires the desktop app");
  }
  return invoke<string | null>("pick_jobs_folder");
}

export async function listJobFiles(folder: string): Promise<JobFileEntry[]> {
  if (!isDesktopShell()) {
    throw new Error("Jobs folder list requires the desktop app");
  }
  return invoke<JobFileEntry[]>("list_job_files", { folder });
}

export async function readJobFile(
  folder: string,
  filePath: string,
): Promise<string> {
  if (!isDesktopShell()) {
    throw new Error("Jobs folder read requires the desktop app");
  }
  return invoke<string>("read_job_file", { folder, filePath });
}

export async function jobsFolderExists(folder: string): Promise<boolean> {
  if (!isDesktopShell()) return false;
  return invoke<boolean>("jobs_folder_exists", { folder });
}
