import { createGrblClient } from "./client";
import { JOG_CANCEL_BYTE } from "./jog";
import type {
  GrblClient,
  SerialOpenOptions,
  SerialTransport,
  TransportEvent,
} from "./transport";
import { DEFAULT_BAUD } from "./transport";
import type { DesktopPortInfo } from "./desktopSerial";
import type { Position3 } from "./types";

const MOCK_PORTS: DesktopPortInfo[] = [
  { path: "MOCK://grbl-demo", portType: "Simulated GRBL" },
];

const SOFT_RESET_BYTE = 0x18;

/**
 * In-browser / cloud-VM mock transport so connect + live position UX can be
 * exercised without a real Demon Shield. Simulates jog (`$J=`), work zero
 * (`G10 L20`), and status reports with live MPos/WPos.
 */
export function createMockTransport(): SerialTransport {
  let open = false;
  let baud = DEFAULT_BAUD;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();

  let machine: Position3 = { x: 40, y: 30, z: -1.5 };
  let wco: Position3 = { x: 10, y: 5, z: 0 };
  let state: "Idle" | "Jog" = "Idle";
  let wcoReportCounter = 0;
  let jogTimer: ReturnType<typeof setTimeout> | null = null;
  let statusTick = 0;

  const emit = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  const emitLine = (line: string) => {
    for (const handler of lineHandlers) handler(line);
  };

  const clearJog = () => {
    if (jogTimer !== null) {
      clearTimeout(jogTimer);
      jogTimer = null;
    }
    state = "Idle";
  };

  const emitStatus = () => {
    wcoReportCounter += 1;
    const withWco = wcoReportCounter % 7 === 0;
    const m = machine;
    const base = `<${state}|MPos:${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}|FS:0,0`;
    emitLine(
      withWco
        ? `${base}|WCO:${wco.x.toFixed(3)},${wco.y.toFixed(3)},${wco.z.toFixed(3)}>`
        : `${base}>`,
    );
  };

  const parseAxisValues = (cmd: string): Partial<Position3> => {
    const out: Partial<Position3> = {};
    const re = /([XYZ])(-?\d+(?:\.\d+)?)/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cmd)) !== null) {
      const axis = match[1].toUpperCase() as keyof Position3;
      out[axis.toLowerCase() as keyof Position3] = Number(match[2]);
    }
    return out;
  };

  const applyJog = (cmd: string) => {
    const absolute = /\bG90\b/i.test(cmd);
    const values = parseAxisValues(cmd);
    const feedMatch = /F(\d+(?:\.\d+)?)/i.exec(cmd);
    const feed = feedMatch ? Number(feedMatch[1]) : 500;

    const target: Position3 = { ...machine };
    if (absolute) {
      // Jog absolute is in work coordinates when G90 is used with $J=.
      if (values.x !== undefined) target.x = wco.x + values.x;
      if (values.y !== undefined) target.y = wco.y + values.y;
      if (values.z !== undefined) target.z = wco.z + values.z;
    } else {
      if (values.x !== undefined) target.x = machine.x + values.x;
      if (values.y !== undefined) target.y = machine.y + values.y;
      if (values.z !== undefined) target.z = machine.z + values.z;
    }

    const dist = Math.hypot(
      target.x - machine.x,
      target.y - machine.y,
      target.z - machine.z,
    );
    const durationMs = Math.min(
      2500,
      Math.max(40, (dist / Math.max(feed, 1)) * 60_000),
    );

    clearJog();
    state = "Jog";
    const start = { ...machine };
    const startedAt = performance.now();

    const step = () => {
      const elapsed = performance.now() - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      machine = {
        x: start.x + (target.x - start.x) * t,
        y: start.y + (target.y - start.y) * t,
        z: start.z + (target.z - start.z) * t,
      };
      if (t >= 1) {
        machine = target;
        state = "Idle";
        jogTimer = null;
        emitLine("ok");
        return;
      }
      jogTimer = setTimeout(step, 40);
    };
    jogTimer = setTimeout(step, 40);
  };

  const applyG10L20 = (cmd: string) => {
    // G10 L20 Pn X0 Y0 Z0 — set work zero so WPos becomes the given values.
    const values = parseAxisValues(cmd);
    if (values.x !== undefined) wco.x = machine.x - values.x;
    if (values.y !== undefined) wco.y = machine.y - values.y;
    if (values.z !== undefined) wco.z = machine.z - values.z;
    emitLine("ok");
  };

  const respondTo = (data: string | Uint8Array) => {
    if (typeof data !== "string") {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (bytes.length === 1 && bytes[0] === JOG_CANCEL_BYTE) {
        clearJog();
        emitLine("ok");
        return;
      }
      if (bytes.length === 1 && bytes[0] === SOFT_RESET_BYTE) {
        clearJog();
        machine = { x: 0, y: 0, z: 0 };
        emitLine("Grbl 1.1h ['$' for help]");
        emitLine("[MSG:Reset to continue]");
        return;
      }
      return;
    }

    const trimmed = data.replace(/\r?\n$/, "").trim();
    if (trimmed === "?") {
      // Tiny idle drift only when not jogging, so the view still “lives”
      // before the user jogs — but stays still once they take control.
      if (state === "Idle" && statusTick < 3) {
        statusTick += 1;
      }
      emitStatus();
      return;
    }

    if (/^\$J=/i.test(trimmed)) {
      applyJog(trimmed);
      return;
    }

    if (/^G10\s+L20\b/i.test(trimmed)) {
      applyG10L20(trimmed);
      return;
    }

    if (/^G92\b/i.test(trimmed)) {
      // G92 X0 Y0 Z0 — temporary offset to make WPos the given values.
      const values = parseAxisValues(trimmed);
      if (values.x !== undefined) wco.x = machine.x - values.x;
      if (values.y !== undefined) wco.y = machine.y - values.y;
      if (values.z !== undefined) wco.z = machine.z - values.z;
      emitLine("ok");
      return;
    }

    // Acknowledge other lines so the UI doesn't hang waiting.
    if (trimmed.length > 0) emitLine("ok");
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
      clearJog();
      machine = { x: 40, y: 30, z: -1.5 };
      wco = { x: 10, y: 5, z: 0 };
      statusTick = 0;
      emit({ type: "open" });
      emitLine("Grbl 1.1h ['$' for help]");
    },
    async close() {
      clearJog();
      open = false;
      emit({ type: "close", reason: "mock" });
    },
    async write(data: string | Uint8Array) {
      if (!open) throw new Error("Mock serial transport is not open");
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
