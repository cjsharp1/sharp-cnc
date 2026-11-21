import { createGrblClient } from "./client";
import type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
import { DEFAULT_BAUD } from "./transport";
import type { DesktopPortInfo } from "./desktopSerial";

const MOCK_PORTS: DesktopPortInfo[] = [
  { path: "MOCK://grbl-demo", portType: "Simulated GRBL" },
];

/**
 * In-browser / cloud-VM mock transport so connect + live position UX can be
 * exercised without a real Demon Shield. Emits synthetic status reports.
 */
export function createMockTransport(): SerialTransport {
  let open = false;
  let baud = DEFAULT_BAUD;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let t = 0;
  const wco = { x: 10, y: 5, z: 0 };

  const emit = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  const emitLine = (line: string) => {
    for (const handler of lineHandlers) handler(line);
  };

  const stopTicks = () => {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };

  const respondTo = (data: string | Uint8Array) => {
    if (typeof data !== "string") {
      // Soft reset — welcome banner, then idle at origin-ish.
      t = 0;
      emitLine("Grbl 1.1h ['$' for help]");
      emitLine("[MSG:Reset to continue]");
      return;
    }
    if (data === "?") {
      const mx = 40 + Math.sin(t) * 35;
      const my = 30 + Math.cos(t * 0.7) * 25;
      const mz = -1.5 + Math.sin(t * 0.3) * 0.5;
      t += 0.12;
      // Alternate including WCO so parser retention is exercised.
      const withWco = Math.floor(t * 4) % 7 === 0;
      const base = `<Idle|MPos:${mx.toFixed(3)},${my.toFixed(3)},${mz.toFixed(3)}|FS:0,0`;
      emitLine(withWco ? `${base}|WCO:${wco.x.toFixed(3)},${wco.y.toFixed(3)},${wco.z.toFixed(3)}>` : `${base}>`);
      return;
    }
    // Ignore other lines in the mock.
  };

  return {
    kind: "desktop",
    get isOpen() {
      return open;
    },
    async open(options?: SerialOpenOptions) {
      const path = options?.path ?? MOCK_PORTS[0].path;
      if (!MOCK_PORTS.some((p) => p.path === path) && !path.startsWith("MOCK://")) {
        throw new Error(`Unknown mock port: ${path}`);
      }
      baud = options?.baudRate ?? DEFAULT_BAUD;
      void baud;
      open = true;
      emit({ type: "open" });
      emitLine("Grbl 1.1h ['$' for help]");
    },
    async close() {
      stopTicks();
      open = false;
      emit({ type: "close", reason: "mock" });
    },
    async write(data: string | Uint8Array) {
      if (!open) throw new Error("Mock serial transport is not open");
      // Simulate async RX shortly after TX.
      queueMicrotask(() => respondTo(data));
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

export function listMockPorts(): DesktopPortInfo[] {
  return [...MOCK_PORTS];
}

export function createMockGrblClient(
  transport: SerialTransport = createMockTransport(),
): GrblClient {
  return createGrblClient(transport);
}
