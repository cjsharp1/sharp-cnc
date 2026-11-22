import type { SerialOpenOptions, SerialTransport, TransportEvent } from "./transport";
import { isVirtualCncPath } from "./mockSerial";

/**
 * Desktop routing transport: open `MOCK://…` / Virtual CNC → in-app simulator;
 * any other path → real USB serial. Browser shells typically use mock only.
 */
export function createRoutingTransport(
  desktop: SerialTransport,
  mock: SerialTransport,
): SerialTransport {
  let active: SerialTransport | null = null;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();

  const emitLine = (line: string) => {
    for (const handler of lineHandlers) handler(line);
  };
  const emitEvent = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  // Forward only from the active child so GRBL client / activity log see one stream.
  desktop.onLine((line) => {
    if (active === desktop) emitLine(line);
  });
  mock.onLine((line) => {
    if (active === mock) emitLine(line);
  });
  desktop.onEvent((event) => {
    if (active === desktop) emitEvent(event);
  });
  mock.onEvent((event) => {
    if (active === mock) emitEvent(event);
  });

  return {
    kind: "desktop",
    get isOpen() {
      return active?.isOpen ?? false;
    },
    async open(options?: SerialOpenOptions) {
      if (active?.isOpen) {
        await active.close().catch(() => undefined);
      }
      const path = options?.path;
      active = isVirtualCncPath(path) ? mock : desktop;
      await active.open(options);
    },
    async close() {
      if (!active) return;
      try {
        await active.close();
      } finally {
        active = null;
      }
    },
    async write(data: string | Uint8Array) {
      if (!active || !active.isOpen) {
        throw new Error("Serial transport is not open");
      }
      return active.write(data);
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
