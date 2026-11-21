/** Read-only local debug bridge helpers (agent-facing snapshot + Tauri IPC). */

import { invoke } from "@tauri-apps/api/core";
import type { ActivityEntry, ActivityLog } from "./activityLog";
import type { SoftTravelLimits } from "./machineConfig";
import { isDesktopShell } from "./session";
import type { StreamPhase, StreamProgress } from "./streamer";
import type { GrblMachineState, Position3 } from "./types";

/** Default localhost port for the desktop debug HTTP server. */
export const DEBUG_BRIDGE_DEFAULT_PORT = 17832;

export const DEBUG_BRIDGE_SCHEMA_VERSION = 1 as const;

export interface DebugBridgeConnection {
  phase: string;
  port: string | null;
  shell: "tauri" | "browser";
  connected: boolean;
}

export interface DebugBridgeMachine {
  state: GrblMachineState;
  mpos: Position3;
  wpos: Position3;
  wco?: Position3;
  feedRate?: number;
  spindleSpeed?: number;
  alarm: string | null;
}

export interface DebugBridgeJob {
  name: string | null;
  phase: StreamPhase | null;
  progress: StreamProgress | null;
}

export interface DebugBridgeSnapshot {
  schemaVersion: typeof DEBUG_BRIDGE_SCHEMA_VERSION;
  updatedAt: number;
  updatedAtIso: string;
  connection: DebugBridgeConnection;
  machine: DebugBridgeMachine;
  job: DebugBridgeJob;
  softTravel: SoftTravelLimits;
  /** Recent activity entries (oldest → newest). */
  logs: ActivityEntry[];
  /** Control API is stubbed / not available in this PR. */
  control: {
    enabled: false;
    note: string;
  };
}

export interface BuildDebugSnapshotInput {
  connection: DebugBridgeConnection;
  machine: DebugBridgeMachine;
  job: DebugBridgeJob;
  softTravel: SoftTravelLimits;
  log: ActivityLog;
  /** How many log lines to include. Default 200. */
  logLimit?: number;
}

export function buildDebugSnapshot(
  input: BuildDebugSnapshotInput,
): DebugBridgeSnapshot {
  const now = Date.now();
  const logLimit = input.logLimit ?? 200;
  return {
    schemaVersion: DEBUG_BRIDGE_SCHEMA_VERSION,
    updatedAt: now,
    updatedAtIso: new Date(now).toISOString(),
    connection: input.connection,
    machine: input.machine,
    job: input.job,
    softTravel: input.softTravel,
    logs: input.log.getLast(logLimit).slice(),
    control: {
      enabled: false,
      note: "Safe remote control (jog / e-stop) is out of scope for this bridge version — read-only.",
    },
  };
}

export interface DebugBridgeStatus {
  running: boolean;
  port: number;
  bind: string;
  readonly: boolean;
}

export function debugBridgeBaseUrl(port = DEBUG_BRIDGE_DEFAULT_PORT): string {
  return `http://127.0.0.1:${port}`;
}

export async function startDebugBridge(
  port = DEBUG_BRIDGE_DEFAULT_PORT,
): Promise<DebugBridgeStatus> {
  if (!isDesktopShell()) {
    throw new Error(
      "Debug bridge HTTP server requires the SharpCNC desktop (Tauri) app.",
    );
  }
  return invoke<DebugBridgeStatus>("debug_bridge_start", { port });
}

export async function stopDebugBridge(): Promise<DebugBridgeStatus> {
  if (!isDesktopShell()) {
    return {
      running: false,
      port: DEBUG_BRIDGE_DEFAULT_PORT,
      bind: "127.0.0.1",
      readonly: true,
    };
  }
  return invoke<DebugBridgeStatus>("debug_bridge_stop");
}

export async function publishDebugSnapshot(
  snapshot: DebugBridgeSnapshot,
): Promise<void> {
  if (!isDesktopShell()) return;
  await invoke("debug_bridge_set_snapshot", {
    snapshotJson: JSON.stringify(snapshot),
  });
}

export async function queryDebugBridgeStatus(): Promise<DebugBridgeStatus> {
  if (!isDesktopShell()) {
    return {
      running: false,
      port: DEBUG_BRIDGE_DEFAULT_PORT,
      bind: "127.0.0.1",
      readonly: true,
    };
  }
  return invoke<DebugBridgeStatus>("debug_bridge_status");
}
