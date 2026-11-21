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
 * Browser Web Serial API transport stub (Chrome / Edge).
 * Wired later for secondary-PC use when the usual desktop isn't available.
 */
export function createWebSerialTransport(): SerialTransport {
  let open = false;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();

  const emit = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  return {
    kind: "web",
    get isOpen() {
      return open;
    },
    async open(_options?: SerialOpenOptions) {
      // TODO: navigator.serial.requestPort() + port.open({ baudRate })
      if (!("serial" in navigator)) {
        emit({
          type: "error",
          message: "Web Serial API is not available in this browser",
        });
        throw new Error("Web Serial API is not available in this browser");
      }
      open = true;
      emit({ type: "open" });
    },
    async close() {
      // TODO: port.close()
      open = false;
      emit({ type: "close", reason: "stub" });
    },
    async write(_data: string | Uint8Array) {
      if (!open) throw new Error("Web Serial transport is not open");
      // TODO: writable.getWriter().write(...)
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

/** Stub GRBL client for the browser / Web Serial path. */
export function createWebGrblClient(
  transport: SerialTransport = createWebSerialTransport(),
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
