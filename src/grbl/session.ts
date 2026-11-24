import { isTauri } from "@tauri-apps/api/core";
import type { ActivityLog } from "./activityLog";
import type { GrblClient } from "./transport";
import {
  createDesktopTransport,
  listDesktopPorts,
  type DesktopPortInfo,
} from "./desktopSerial";
import { createGrblClient } from "./client";
import { instrumentTransport } from "./instrumentTransport";
import {
  createMockGrblClient,
  createMockTransport,
  isVirtualCncPath,
  listMockPorts,
  mockTransportOptionsFromStorage,
  VIRTUAL_CNC_PATH,
} from "./mockSerial";
import { createRoutingTransport } from "./routingTransport";

export { isVirtualCncPath, VIRTUAL_CNC_PATH, createRoutingTransport };

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

/**
 * Prefer real Tauri USB serial with Virtual CNC as a selectable port;
 * browser / cloud shells use the in-app simulator only.
 */
export function createSessionClient(
  options: SessionClientOptions = {},
): GrblClient {
  const log = options.activityLog;
  const mockOpts = mockTransportOptionsFromStorage();
  if (isDesktopShell()) {
    const routed = createRoutingTransport(
      createDesktopTransport(),
      createMockTransport(mockOpts),
    );
    if (!log) return createGrblClient(routed);
    return createGrblClient(instrumentTransport(routed, log));
  }
  const mock = createMockTransport(mockOpts);
  if (!log) return createMockGrblClient(mock);
  return createGrblClient(instrumentTransport(mock, log));
}

/**
 * Port list for the Connect UI. Always includes **Virtual CNC** so the
 * simulator is chosen the same way as a COM port — not a post-connect mode.
 */
export async function listAvailablePorts(): Promise<DesktopPortInfo[]> {
  const virtual = listMockPorts();
  if (isDesktopShell()) {
    const real = await listDesktopPorts();
    // Virtual CNC first so it is an explicit, visible alternative to USB.
    const realOnly = real.filter((p) => !isVirtualCncPath(p.path));
    return [...virtual, ...realOnly];
  }
  return virtual;
}
