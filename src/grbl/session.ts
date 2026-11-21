import { isTauri } from "@tauri-apps/api/core";
import type { GrblClient } from "./transport";
import {
  createDesktopGrblClient,
  listDesktopPorts,
  type DesktopPortInfo,
} from "./desktopSerial";
import { createMockGrblClient, listMockPorts } from "./mockSerial";

export function isDesktopShell(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

/** Prefer real Tauri USB serial; fall back to mock for browser / cloud smoke tests. */
export function createSessionClient(): GrblClient {
  if (isDesktopShell()) {
    return createDesktopGrblClient();
  }
  return createMockGrblClient();
}

export async function listAvailablePorts(): Promise<DesktopPortInfo[]> {
  if (isDesktopShell()) {
    return listDesktopPorts();
  }
  return listMockPorts();
}
