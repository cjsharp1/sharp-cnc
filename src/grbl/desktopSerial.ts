import type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
import { DEFAULT_BAUD } from "./transport";
import type { GrblStatus } from "./types";
import { OFFLINE_STATUS } from "./types";

/**
 * Desktop (Tauri) serial transport stub.
 * Real implementation will call Rust `serialport` commands via `invoke`.
 */
export function createDesktopTransport(): SerialTransport {
  let open = false;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();

  const emit = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  return {
    kind: "desktop",
    get isOpen() {
      return open;
    },
    async open(_options?: SerialOpenOptions) {
      // TODO: invoke("serial_open", { path, baudRate })
      open = true;
      emit({ type: "open" });
    },
    async close() {
      // TODO: invoke("serial_close")
      open = false;
      emit({ type: "close", reason: "stub" });
    },
    async write(_data: string | Uint8Array) {
      if (!open) throw new Error("Desktop serial transport is not open");
      // TODO: invoke("serial_write", { data })
    },
    onLine(handler) {
      lineHandlers.add(handler);
      return () => lineHandlers.delete(handler);
    },
    onEvent(handler) {
      eventHandlers.add(handler);
      return () => eventHandlers.delete(handler);
    },
  };
}

/** Stub GRBL client wired to the desktop serial transport. */
export function createDesktopGrblClient(
  transport: SerialTransport = createDesktopTransport(),
): GrblClient {
  const statusHandlers = new Set<(status: GrblStatus) => void>();

  return {
    transport,
    async connect(options?: SerialOpenOptions) {
      await transport.open({ baudRate: DEFAULT_BAUD, ...options });
      for (const handler of statusHandlers) handler(OFFLINE_STATUS);
    },
    async disconnect() {
      await transport.close();
      for (const handler of statusHandlers) handler(OFFLINE_STATUS);
    },
    async softReset() {
      // TODO: write 0x18
    },
    async requestStatus() {
      // TODO: write "?"
    },
    async sendLine(line: string) {
      await transport.write(line.endsWith("\n") ? line : `${line}\n`);
    },
    onStatus(handler) {
      statusHandlers.add(handler);
      return () => statusHandlers.delete(handler);
    },
  };
}
