import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { createGrblClient } from "./client";
import type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
import { DEFAULT_BAUD } from "./transport";

export interface DesktopPortInfo {
  path: string;
  portType: string;
}

interface SerialLinePayload {
  line: string;
}

interface SerialErrorPayload {
  message: string;
}

/** List USB / serial ports via the Tauri `serialport` backend. */
export async function listDesktopPorts(): Promise<DesktopPortInfo[]> {
  return invoke<DesktopPortInfo[]>("list_serial_ports");
}

/**
 * Desktop (Tauri) serial transport backed by Rust `serialport`.
 * RX lines arrive on the `serial-rx` event; errors on `serial-error`.
 */
export function createDesktopTransport(): SerialTransport {
  let open = false;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();
  let unlistenRx: UnlistenFn | null = null;
  let unlistenErr: UnlistenFn | null = null;

  const emit = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  const emitLine = (line: string) => {
    for (const handler of lineHandlers) handler(line);
  };

  const teardownListeners = () => {
    unlistenRx?.();
    unlistenErr?.();
    unlistenRx = null;
    unlistenErr = null;
  };

  return {
    kind: "desktop",
    get isOpen() {
      return open;
    },
    async open(options?: SerialOpenOptions) {
      const path = options?.path;
      if (!path) {
        throw new Error("Select a serial port before connecting");
      }
      const baudRate = options?.baudRate ?? DEFAULT_BAUD;

      teardownListeners();
      unlistenRx = await listen<SerialLinePayload>("serial-rx", (event) => {
        emitLine(event.payload.line);
      });
      unlistenErr = await listen<SerialErrorPayload>("serial-error", (event) => {
        open = false;
        emit({ type: "error", message: event.payload.message });
        emit({ type: "close", reason: event.payload.message });
        teardownListeners();
      });

      try {
        await invoke("serial_open", { path, baudRate });
      } catch (err) {
        teardownListeners();
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "error", message });
        throw err instanceof Error ? err : new Error(message);
      }

      open = true;
      emit({ type: "open" });
    },
    async close() {
      try {
        await invoke("serial_close");
      } finally {
        open = false;
        teardownListeners();
        emit({ type: "close" });
      }
    },
    async write(data: string | Uint8Array) {
      if (!open) throw new Error("Desktop serial transport is not open");
      if (typeof data === "string") {
        await invoke("serial_write", { data });
        return;
      }
      await invoke("serial_write_bytes", { bytes: Array.from(data) });
    },
    onLine(handler) {
      lineHandlers.add(handler);
      return () => {
        lineHandlers.delete(handler);
      };
    },
    onEvent(handler) {
      eventHandlers.add(handler);
      return () => {
        eventHandlers.delete(handler);
      };
    },
  };
}

/** GRBL client wired to the desktop USB serial transport. */
export function createDesktopGrblClient(
  transport: SerialTransport = createDesktopTransport(),
): GrblClient {
  return createGrblClient(transport);
}
