import { createGrblClient } from "./client";
import type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
import { DEFAULT_BAUD } from "./transport";

/**
 * Browser Web Serial API transport stub (Chrome / Edge).
 * Kept for later parity — desktop USB is the priority for Demon Shield.
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
      if (!("serial" in navigator)) {
        emit({
          type: "error",
          message: "Web Serial API is not available in this browser",
        });
        throw new Error("Web Serial API is not available in this browser");
      }
      // TODO: navigator.serial.requestPort() + port.open({ baudRate })
      void DEFAULT_BAUD;
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

/** Stub GRBL client for the browser / Web Serial path (parity later). */
export function createWebGrblClient(
  transport: SerialTransport = createWebSerialTransport(),
): GrblClient {
  return createGrblClient(transport, { softResetOnConnect: false });
}
