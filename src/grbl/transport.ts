import type { GrblStatus } from "./types";

/** Byte-oriented serial transport plugged in per shell (Tauri or Web Serial). */
export interface SerialTransport {
  readonly kind: "desktop" | "web";
  /** True once open and ready for read/write. */
  readonly isOpen: boolean;
  open(options?: SerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  write(data: string | Uint8Array): Promise<void>;
  /** Subscribe to inbound lines (CR/LF stripped). Returns unsubscribe. */
  onLine(handler: (line: string) => void): () => void;
  /** Subscribe to connection / error events. Returns unsubscribe. */
  onEvent(handler: (event: TransportEvent) => void): () => void;
}

export interface SerialOpenOptions {
  /** Platform path or port id (e.g. `COM3`, `/dev/ttyUSB0`). */
  path?: string;
  baudRate?: number;
}

export type TransportEvent =
  | { type: "open" }
  | { type: "close"; reason?: string }
  | { type: "error"; message: string };

/**
 * High-level GRBL client surface. Implementations stream status and send
 * commands; transport is injected by the shell.
 */
export interface GrblClient {
  readonly transport: SerialTransport;
  connect(options?: SerialOpenOptions): Promise<void>;
  disconnect(): Promise<void>;
  /** Soft reset (`Ctrl-X`). */
  softReset(): Promise<void>;
  /** Cancel jogging (`0x85`). */
  cancelJog(): Promise<void>;
  /** Feed hold / pause (`!`). */
  feedHold(): Promise<void>;
  /** Cycle start / resume after hold (`~`). */
  cycleStart(): Promise<void>;
  /** Request a status report (`?`). */
  requestStatus(): Promise<void>;
  /**
   * GRBL 1.1 realtime feed override byte (`0x90`–`0x94`).
   * No newline — works during a running job.
   */
  feedOverride(byte: number): Promise<void>;
  /**
   * GRBL 1.1 realtime spindle override byte (`0x99`–`0x9D`).
   * No newline — works during a running job.
   */
  spindleOverride(byte: number): Promise<void>;
  /**
   * GRBL 1.1 realtime rapid override byte (`0x95`–`0x97`).
   * No newline — works during a running job.
   */
  rapidOverride(byte: number): Promise<void>;
  sendLine(line: string): Promise<void>;
  onStatus(handler: (status: GrblStatus) => void): () => void;
}

export const DEFAULT_BAUD = 115_200;
