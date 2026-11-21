import type { GrblClient, SerialOpenOptions, SerialTransport } from "./transport";
import { DEFAULT_BAUD } from "./transport";
import { JOG_CANCEL_BYTE } from "./jog";
import { parseStatusReport } from "./parseStatus";
import type { GrblStatus } from "./types";
import { OFFLINE_STATUS } from "./types";

const STATUS_POLL_MS = 250;
const SOFT_RESET_BYTE = 0x18;

export interface CreateGrblClientOptions {
  /** Soft-reset after open to get a clean GRBL handshake. Default true. */
  softResetOnConnect?: boolean;
  /** Poll interval for `?` status requests while connected. Default 250ms. */
  statusPollMs?: number;
}

/**
 * Shared GRBL client: line parsing, soft reset, and status polling on top of
 * any {@link SerialTransport}.
 */
export function createGrblClient(
  transport: SerialTransport,
  options: CreateGrblClientOptions = {},
): GrblClient {
  const softResetOnConnect = options.softResetOnConnect !== false;
  const statusPollMs = options.statusPollMs ?? STATUS_POLL_MS;

  const statusHandlers = new Set<(status: GrblStatus) => void>();
  let latest: GrblStatus = OFFLINE_STATUS;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let unsubLine: (() => void) | null = null;
  let unsubEvent: (() => void) | null = null;

  const emitStatus = (status: GrblStatus) => {
    latest = status;
    for (const handler of statusHandlers) handler(status);
  };

  const stopPolling = () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollTimer = setInterval(() => {
      if (!transport.isOpen) return;
      void transport.write("?").catch(() => {
        /* ignore transient write errors during teardown */
      });
    }, statusPollMs);
  };

  const detach = () => {
    stopPolling();
    unsubLine?.();
    unsubEvent?.();
    unsubLine = null;
    unsubEvent = null;
  };

  const attach = () => {
    detach();
    unsubLine = transport.onLine((line) => {
      const parsed = parseStatusReport(line, latest);
      if (parsed) emitStatus(parsed);
    });
    unsubEvent = transport.onEvent((event) => {
      if (event.type === "close" || event.type === "error") {
        stopPolling();
        emitStatus(OFFLINE_STATUS);
      }
    });
  };

  return {
    transport,
    async connect(openOptions?: SerialOpenOptions) {
      attach();
      await transport.open({ baudRate: DEFAULT_BAUD, ...openOptions });
      if (softResetOnConnect) {
        await transport.write(new Uint8Array([SOFT_RESET_BYTE]));
        // Brief pause so GRBL can print the welcome banner before status polls.
        await new Promise((r) => setTimeout(r, 150));
      }
      startPolling();
      // Kick an immediate status request.
      await transport.write("?").catch(() => undefined);
    },
    async disconnect() {
      stopPolling();
      try {
        await transport.close();
      } finally {
        detach();
        emitStatus(OFFLINE_STATUS);
      }
    },
    async softReset() {
      await transport.write(new Uint8Array([SOFT_RESET_BYTE]));
    },
    async cancelJog() {
      await transport.write(new Uint8Array([JOG_CANCEL_BYTE]));
    },
    async feedHold() {
      // Real-time command — no newline.
      await transport.write("!");
    },
    async cycleStart() {
      await transport.write("~");
    },
    async requestStatus() {
      await transport.write("?");
    },
    async sendLine(line: string) {
      await transport.write(line.endsWith("\n") ? line : `${line}\n`);
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      handler(latest);
      return () => statusHandlers.delete(handler);
    },
  };
}
