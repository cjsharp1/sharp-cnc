import { isTauri } from "@tauri-apps/api/core";
import type { ActivityLog } from "./activityLog";
import type { GrblClient } from "./transport";
import {
  createDesktopGrblClient,
  createDesktopTransport,
  listDesktopPorts,
  type DesktopPortInfo,
} from "./desktopSerial";
import { createGrblClient } from "./client";
import { instrumentTransport } from "./instrumentTransport";
import { createMockGrblClient, createMockTransport, listMockPorts } from "./mockSerial";

export function isDesktopShell(): boolean {
  try {
    return isTauri();
  } catch {
    return false;
  }
}

export interface SessionClientOptions {
  /** When set, TX/RX/open/close are mirrored into this activity log. */
  activityLog?: ActivityLog;
}

/** Prefer real Tauri USB serial; fall back to mock for browser / cloud smoke tests. */
export function createSessionClient(
  options: SessionClientOptions = {},
): GrblClient {
  const log = options.activityLog;
  if (isDesktopShell()) {
    if (!log) return createDesktopGrblClient();
    return createGrblClient(instrumentTransport(createDesktopTransport(), log));
  }
  if (!log) return createMockGrblClient();
  return createGrblClient(instrumentTransport(createMockTransport(), log));
}

export async function listAvailablePorts(): Promise<DesktopPortInfo[]> {
  if (isDesktopShell()) {
    return listDesktopPorts();
  }
  return listMockPorts();
}
