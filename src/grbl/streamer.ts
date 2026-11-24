import { isToolChangeLine } from "./jobControls";
import type { SerialTransport } from "./transport";

/** Typical GRBL 1.1 serial RX buffer size (bytes). */
export const GRBL_RX_BUFFER = 128;

export type StreamPhase =
  | "idle"
  | "running"
  | "paused"
  | "tool-change"
  | "stopping"
  | "completed"
  | "error";

export interface StreamProgress {
  phase: StreamPhase;
  /** 0-based index of next line to send (or total when done). */
  sentLines: number;
  /** Lines that received ok/error so far. */
  ackedLines: number;
  totalLines: number;
  /**
   * Absolute 0-based index into the original job for the next line
   * (accounts for skip-to-line start offset).
   */
  absoluteLine?: number;
  /**
   * Absolute 0-based index of the first job line GRBL has NOT acknowledged.
   * Lines before it were parsed by GRBL, though not necessarily executed yet.
   */
  ackedAbsoluteLine?: number;
  /** Percent complete based on acked lines (0–100). */
  percent: number;
  /** Last error message from GRBL, if any. */
  lastError?: string;
  /** Set when paused for M6 tool change. */
  toolChangeLine?: number;
  toolChangeMessage?: string;
}

export interface GcodeStreamerOptions {
  /** RX buffer size used for character counting. Default 128. */
  rxBufferSize?: number;
  onProgress?: (progress: StreamProgress) => void;
  /**
   * When true (default), pause streaming on M6 / M06 until resumeAfterToolChange().
   * The M6 line itself is still sent to GRBL (many configs treat it as a no-op or pause).
   */
  pauseOnToolChange?: boolean;
}

export interface StreamStartOptions {
  /** 0-based offset into jobLines — skip earlier lines (scrubber / skip-to-line). */
  startIndex?: number;
  /**
   * Setup lines sent before jobLines[startIndex] (e.g. the resume preamble).
   * They are not part of the job, so progress and error line numbers keep
   * pointing at real job lines.
   */
  preamble?: string[];
}

interface PendingLine {
  chars: number;
  index: number;
}

/**
 * Character-counting G-code streamer for GRBL.
 *
 * - Start: fill RX buffer; advance on each `ok` / `error:…`
 * - Pause: real-time feed hold (`!`); stop filling the buffer
 * - Resume: cycle start (`~`); continue sending
 * - Stop: soft reset (`0x18`); abort remaining lines
 * - syncFromExternal*: mirror hardware Demon Shield buttons without re-sending
 *   the real-time command (hardware already applied it on the controller).
 */
export function createGcodeStreamer(
  transport: SerialTransport,
  options: GcodeStreamerOptions = {},
): {
  start(lines: string[], startOptions?: StreamStartOptions): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  /** Continue after an M6 tool-change pause (does not send `~` unless also held). */
  resumeAfterToolChange(): Promise<void>;
  stop(): Promise<void>;
  /** Mirror external feed hold — do not send `!`. */
  syncFromExternalHold(): void;
  /** Mirror external cycle start — do not send `~`; resume buffer fill. */
  syncFromExternalResume(): Promise<void>;
  /** Mirror external abort/reset — do not send soft-reset (already done). */
  syncFromExternalAbort(): void;
  getProgress(): StreamProgress;
  dispose(): void;
} {
  const rxBufferSize = options.rxBufferSize ?? GRBL_RX_BUFFER;
  const onProgress = options.onProgress;
  const pauseOnToolChange = options.pauseOnToolChange !== false;

  let lines: string[] = [];
  /** Absolute index (in the original job) of the first job line sent. */
  let lineOffset = 0;
  /** Number of setup lines at the front of `lines` that are not job lines. */
  let preambleCount = 0;
  /** Absolute job line for an index into `lines` (null for preamble lines). */
  const jobLineFor = (index: number): number | null =>
    index < preambleCount ? null : lineOffset + (index - preambleCount);
  let sendIndex = 0;
  let acked = 0;
  let bufferUsed = 0;
  let pending: PendingLine[] = [];
  let phase: StreamPhase = "idle";
  let lastError: string | undefined;
  let toolChangeLine: number | undefined;
  let toolChangeMessage: string | undefined;
  let unsubLine: (() => void) | null = null;
  let settle: (() => void) | null = null;
  let settleReject: ((err: Error) => void) | null = null;
  /** Serialize fill loops so concurrent ok callbacks cannot double-send. */
  let sendLock: Promise<void> = Promise.resolve();

  const progress = (): StreamProgress => {
    const total = lines.length;
    const percent =
      total === 0 ? 0 : Math.min(100, Math.round((acked / total) * 100));
    return {
      phase,
      sentLines: sendIndex,
      ackedLines: acked,
      totalLines: total,
      absoluteLine: lineOffset + Math.max(0, sendIndex - preambleCount),
      ackedAbsoluteLine: lineOffset + Math.max(0, acked - preambleCount),
      percent,
      lastError,
      toolChangeLine,
      toolChangeMessage,
    };
  };

  const emit = () => {
    onProgress?.(progress());
  };

  const finish = (next: StreamPhase) => {
    phase = next;
    emit();
    const done = settle;
    const fail = settleReject;
    settle = null;
    settleReject = null;
    if (next === "error" && fail) {
      fail(new Error(lastError ?? "Stream error"));
    } else if (done) {
      done();
    }
  };

  const maybeComplete = () => {
    if (
      (phase === "running" || phase === "paused" || phase === "tool-change") &&
      sendIndex >= lines.length &&
      pending.length === 0
    ) {
      finish("completed");
    }
  };

  const enterToolChange = (absoluteIndex: number, line: string) => {
    phase = "tool-change";
    toolChangeLine = absoluteIndex;
    toolChangeMessage = `Tool change (M6) at line ${absoluteIndex + 1}: ${line}`;
    emit();
  };

  const fillBuffer = async () => {
    if (phase !== "running") return;
    if (!transport.isOpen) {
      lastError = "Serial closed during stream";
      finish("error");
      return;
    }

    while (sendIndex < lines.length && phase === "running") {
      const body = lines[sendIndex]!;

      // Pause *before* sending M6 so the operator can change the bit first
      // when configured; still allow resumeAfterToolChange to send it.
      if (pauseOnToolChange && isToolChangeLine(body) && toolChangeLine == null) {
        enterToolChange(jobLineFor(sendIndex) ?? lineOffset, body);
        return;
      }

      const payload = body.endsWith("\n") ? body : `${body}\n`;
      const chars = payload.length;
      if (bufferUsed + chars > rxBufferSize) break;

      // Reserve RX budget before the await so overlapping fills cannot
      // claim the same line index.
      const index = sendIndex;
      pending.push({ chars, index });
      bufferUsed += chars;
      sendIndex += 1;
      // Clear latch so a later M6 can pause again.
      if (toolChangeLine !== undefined && jobLineFor(index) === toolChangeLine) {
        toolChangeLine = undefined;
        toolChangeMessage = undefined;
      }
      emit();

      try {
        await transport.write(payload);
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // Roll back reservation for this and any later unsent pending entries.
        pending = pending.filter((p) => p.index < index);
        bufferUsed = pending.reduce((sum, p) => sum + p.chars, 0);
        sendIndex = index;
        finish("error");
        return;
      }
    }

    maybeComplete();
  };

  const scheduleFill = () => {
    sendLock = sendLock.then(fillBuffer).catch((err) => {
      lastError = err instanceof Error ? err.message : String(err);
      finish("error");
    });
    return sendLock;
  };

  const onLine = (line: string) => {
    const trimmed = line.trim();
    if (
      phase === "idle" ||
      phase === "completed" ||
      phase === "stopping" ||
      phase === "tool-change"
    ) {
      // Still ack buffer while tool-change if GRBL replies for prior lines.
      if (
        phase === "tool-change" &&
        (trimmed === "ok" || trimmed.startsWith("error"))
      ) {
        const item = pending.shift();
        if (item) {
          bufferUsed = Math.max(0, bufferUsed - item.chars);
          acked = Math.max(acked, item.index + 1);
          emit();
        }
        if (trimmed.startsWith("error") && item) {
          const jobLine = jobLineFor(item.index);
          failStream(
            `${trimmed} ${jobLine === null ? "in the resume setup" : `on line ${jobLine + 1}`}`,
            true,
          );
        }
      } else if (
        phase === "tool-change" &&
        /^ALARM:\s*\d+/i.test(trimmed)
      ) {
        failStream(trimmed, false);
      }
      return;
    }

    if (trimmed === "ok" || trimmed.startsWith("error")) {
      const item = pending.shift();
      if (!item) {
        // Spurious ok (e.g. leftover) — ignore.
        return;
      }
      bufferUsed = Math.max(0, bufferUsed - item.chars);
      acked = Math.max(acked, item.index + 1);

      if (trimmed.startsWith("error")) {
        const jobLine = jobLineFor(item.index);
        const where =
          jobLine === null ? "in the resume setup" : `on line ${jobLine + 1}`;
        const source = (lines[item.index] ?? "").trim();
        failStream(
          `${trimmed} ${where}${source ? `: ${source}` : ""}`,
          true,
        );
        return;
      }

      emit();
      void scheduleFill();
      maybeComplete();
      return;
    }

    if (phase === "error") return; // keep the first failure as lastError

    if (/^ALARM:\s*\d+/i.test(trimmed)) {
      failStream(trimmed, false);
      return;
    }
    if (trimmed.startsWith("<Alarm")) {
      // Real GRBL prints ALARM:n first; this is a fallback if that line was missed.
      failStream("Controller entered Alarm state", false);
    }
  };

  /**
   * Stop streaming and reject the pending start() promise.
   * On a G-code error GRBL keeps running what is already buffered (spindle on),
   * so send a feed hold to stop motion until the operator chooses Stop.
   */
  const failStream = (message: string, holdMotion: boolean) => {
    lastError = message;
    phase = "error";
    emit();
    if (holdMotion) {
      void transport.write("!").catch(() => undefined);
    }
    const fail = settleReject;
    settle = null;
    settleReject = null;
    fail?.(new Error(message));
  };

  const attach = () => {
    if (unsubLine) return;
    unsubLine = transport.onLine(onLine);
  };

  const detach = () => {
    unsubLine?.();
    unsubLine = null;
  };

  const resetCounters = () => {
    sendIndex = 0;
    acked = 0;
    bufferUsed = 0;
    pending = [];
    lastError = undefined;
    toolChangeLine = undefined;
    toolChangeMessage = undefined;
  };

  return {
    async start(jobLines: string[], startOptions: StreamStartOptions = {}) {
      if (
        phase === "running" ||
        phase === "paused" ||
        phase === "tool-change" ||
        phase === "stopping"
      ) {
        throw new Error("A job is already in progress");
      }
      if (!transport.isOpen) {
        throw new Error("Not connected");
      }
      if (jobLines.length === 0) {
        throw new Error("Job has no lines to send");
      }

      const startIndex = Math.max(
        0,
        Math.min(jobLines.length - 1, Math.floor(startOptions.startIndex ?? 0)),
      );

      attach();
      lineOffset = startIndex;
      const preamble = startOptions.preamble ?? [];
      preambleCount = preamble.length;
      lines = [...preamble, ...jobLines.slice(startIndex)];
      resetCounters();
      phase = "running";
      emit();

      await new Promise<void>((resolve, reject) => {
        settle = resolve;
        settleReject = reject;
        void scheduleFill();
      });
    },

    async pause() {
      if (phase !== "running") return;
      phase = "paused";
      emit();
      await transport.write("!");
    },

    async resume() {
      if (phase !== "paused") return;
      phase = "running";
      emit();
      await transport.write("~");
      await scheduleFill();
    },

    async resumeAfterToolChange() {
      if (phase !== "tool-change") return;
      // Mark so fillBuffer will send the pending M6 line instead of re-pausing.
      toolChangeLine = jobLineFor(sendIndex) ?? lineOffset;
      toolChangeMessage = undefined;
      phase = "running";
      emit();
      await scheduleFill();
    },

    async stop() {
      if (
        phase !== "running" &&
        phase !== "paused" &&
        phase !== "tool-change" &&
        phase !== "error" &&
        phase !== "stopping"
      ) {
        return;
      }
      phase = "stopping";
      emit();
      try {
        await transport.write(new Uint8Array([0x18]));
      } catch {
        /* best-effort */
      }
      pending = [];
      bufferUsed = 0;
      finish("idle");
    },

    syncFromExternalHold() {
      if (phase !== "running") return;
      phase = "paused";
      emit();
    },

    async syncFromExternalResume() {
      if (phase === "tool-change") {
        await this.resumeAfterToolChange();
        return;
      }
      if (phase !== "paused") return;
      phase = "running";
      emit();
      await scheduleFill();
    },

    syncFromExternalAbort() {
      if (
        phase !== "running" &&
        phase !== "paused" &&
        phase !== "tool-change" &&
        phase !== "error" &&
        phase !== "stopping"
      ) {
        return;
      }
      pending = [];
      bufferUsed = 0;
      lastError = undefined;
      toolChangeLine = undefined;
      toolChangeMessage = undefined;
      finish("idle");
    },

    getProgress: progress,

    dispose() {
      detach();
      lines = [];
      lineOffset = 0;
      preambleCount = 0;
      resetCounters();
      phase = "idle";
      settle = null;
      settleReject = null;
    },
  };
}

export type GcodeStreamer = ReturnType<typeof createGcodeStreamer>;
