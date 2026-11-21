import type { SerialTransport } from "./transport";

/** Typical GRBL 1.1 serial RX buffer size (bytes). */
export const GRBL_RX_BUFFER = 128;

export type StreamPhase =
  | "idle"
  | "running"
  | "paused"
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
  /** Percent complete based on acked lines (0–100). */
  percent: number;
  /** Last error message from GRBL, if any. */
  lastError?: string;
}

export interface GcodeStreamerOptions {
  /** RX buffer size used for character counting. Default 128. */
  rxBufferSize?: number;
  onProgress?: (progress: StreamProgress) => void;
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
 */
export function createGcodeStreamer(
  transport: SerialTransport,
  options: GcodeStreamerOptions = {},
): {
  start(lines: string[]): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  getProgress(): StreamProgress;
  dispose(): void;
} {
  const rxBufferSize = options.rxBufferSize ?? GRBL_RX_BUFFER;
  const onProgress = options.onProgress;

  let lines: string[] = [];
  let sendIndex = 0;
  let acked = 0;
  let bufferUsed = 0;
  let pending: PendingLine[] = [];
  let phase: StreamPhase = "idle";
  let lastError: string | undefined;
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
      percent,
      lastError,
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
      (phase === "running" || phase === "paused") &&
      sendIndex >= lines.length &&
      pending.length === 0
    ) {
      finish("completed");
    }
  };

  const fillBuffer = async () => {
    if (phase !== "running") return;
    if (!transport.isOpen) {
      lastError = "Serial closed during stream";
      finish("error");
      return;
    }

    while (sendIndex < lines.length && phase === "running") {
      const body = lines[sendIndex];
      const payload = body.endsWith("\n") ? body : `${body}\n`;
      const chars = payload.length;
      if (bufferUsed + chars > rxBufferSize) break;

      // Reserve RX budget before the await so overlapping fills cannot
      // claim the same line index.
      const index = sendIndex;
      pending.push({ chars, index });
      bufferUsed += chars;
      sendIndex += 1;
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
      phase === "stopping"
    ) {
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
        lastError = trimmed;
        phase = "error";
        emit();
        settleReject?.(new Error(trimmed));
        settle = null;
        settleReject = null;
        return;
      }

      emit();
      void scheduleFill();
      maybeComplete();
      return;
    }

    if (trimmed.startsWith("ALARM:") || trimmed.startsWith("<Alarm")) {
      lastError = trimmed;
      phase = "error";
      emit();
    }
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
  };

  return {
    async start(jobLines: string[]) {
      if (phase === "running" || phase === "paused" || phase === "stopping") {
        throw new Error("A job is already in progress");
      }
      if (!transport.isOpen) {
        throw new Error("Not connected");
      }
      if (jobLines.length === 0) {
        throw new Error("Job has no lines to send");
      }

      attach();
      lines = [...jobLines];
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

    async stop() {
      if (
        phase !== "running" &&
        phase !== "paused" &&
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

    getProgress: progress,

    dispose() {
      detach();
      lines = [];
      resetCounters();
      phase = "idle";
      settle = null;
      settleReject = null;
    },
  };
}

export type GcodeStreamer = ReturnType<typeof createGcodeStreamer>;
