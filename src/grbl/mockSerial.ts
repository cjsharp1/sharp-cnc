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

type MockState = "Idle" | "Jog" | "Run" | "Hold" | "Alarm";

/**
 * In-browser / cloud-VM mock transport so connect + live position UX can be
 * exercised without a real Demon Shield. Simulates jog (`$J=`), work zero
 * (`G10 L20`), job motion (G0/G1), feed hold / resume, and status reports.
 *
 * Program lines are queued and acknowledged in order so the character-counting
 * streamer behaves like GRBL's RX buffer.
 */
export function createMockTransport(): SerialTransport {
  let open = false;
  let baud = DEFAULT_BAUD;
  const lineHandlers = new Set<(line: string) => void>();
  const eventHandlers = new Set<(event: TransportEvent) => void>();

  let machine: Position3 = { x: 40, y: 30, z: -1.5 };
  let wco: Position3 = { x: 10, y: 5, z: 0 };
  let state: MockState = "Idle";
  let heldFrom: MockState = "Idle";
  let absolute = true;
  let wcoReportCounter = 0;
  let motionTimer: ReturnType<typeof setTimeout> | null = null;
  let statusTick = 0;
  let busy = false;
  const queue: string[] = [];

  const emit = (event: TransportEvent) => {
    for (const handler of eventHandlers) handler(event);
  };

  const emitLine = (line: string) => {
    for (const handler of lineHandlers) handler(line);
  };

  const clearMotion = () => {
    if (motionTimer !== null) {
      clearTimeout(motionTimer);
      motionTimer = null;
    }
  };

  const emitStatus = () => {
    wcoReportCounter += 1;
    const withWco = wcoReportCounter % 7 === 0;
    const m = machine;
    const reportState = state === "Hold" ? "Hold:0" : state;
    const base = `<${reportState}|MPos:${m.x.toFixed(3)},${m.y.toFixed(3)},${m.z.toFixed(3)}|FS:0,0`;
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

  const animateTo = (
    target: Position3,
    feed: number,
    nextState: MockState,
    onDone: () => void,
  ) => {
    const dist = Math.hypot(
      target.x - machine.x,
      target.y - machine.y,
      target.z - machine.z,
    );
    // Slow enough that Pause/Hold is clickable in the UI; still fine for smoke.
    const durationMs = Math.min(
      900,
      Math.max(80, (dist / Math.max(feed, 1)) * 40_000),
    );

    clearMotion();
    state = nextState;
    const start = { ...machine };
    let progress = 0;
    let lastTick = performance.now();

    const step = () => {
      if (state === "Hold") {
        lastTick = performance.now();
        motionTimer = setTimeout(step, 40);
        return;
      }
      if (state !== nextState && state !== "Run" && state !== "Jog") {
        // Aborted by soft reset / cancel — do not ack.
        motionTimer = null;
        return;
      }

      const now = performance.now();
      progress += (now - lastTick) / durationMs;
      lastTick = now;
      const t = Math.min(1, progress);
      machine = {
        x: start.x + (target.x - start.x) * t,
        y: start.y + (target.y - start.y) * t,
        z: start.z + (target.z - start.z) * t,
      };
      if (t >= 1) {
        machine = target;
        state = "Idle";
        motionTimer = null;
        onDone();
        return;
      }
      motionTimer = setTimeout(step, 40);
    };
    motionTimer = setTimeout(step, 16);
  };

  const finishCommand = () => {
    busy = false;
    emitLine("ok");
    pump();
  };

  const applyJog = (cmd: string) => {
    const jogAbsolute = /\bG90\b/i.test(cmd);
    const values = parseAxisValues(cmd);
    const feedMatch = /F(\d+(?:\.\d+)?)/i.exec(cmd);
    const feed = feedMatch ? Number(feedMatch[1]) : 500;

    const target: Position3 = { ...machine };
    if (jogAbsolute) {
      if (values.x !== undefined) target.x = wco.x + values.x;
      if (values.y !== undefined) target.y = wco.y + values.y;
      if (values.z !== undefined) target.z = wco.z + values.z;
    } else {
      if (values.x !== undefined) target.x = machine.x + values.x;
      if (values.y !== undefined) target.y = machine.y + values.y;
      if (values.z !== undefined) target.z = machine.z + values.z;
    }

    busy = true;
    animateTo(target, feed, "Jog", finishCommand);
  };

  const applyG10L20 = (cmd: string) => {
    const values = parseAxisValues(cmd);
    if (values.x !== undefined) wco.x = machine.x - values.x;
    if (values.y !== undefined) wco.y = machine.y - values.y;
    if (values.z !== undefined) wco.z = machine.z - values.z;
    emitLine("ok");
  };

  const applyProgramMotion = (cmd: string) => {
    if (/\bG90\b/i.test(cmd)) absolute = true;
    if (/\bG91\b/i.test(cmd)) absolute = false;

    const values = parseAxisValues(cmd);
    const feedMatch = /F(\d+(?:\.\d+)?)/i.exec(cmd);
    const isRapid = /\bG0(?!\d)/i.test(cmd) || /\bG00\b/i.test(cmd);
    const feed = feedMatch ? Number(feedMatch[1]) : isRapid ? 3000 : 800;

    if (
      values.x === undefined &&
      values.y === undefined &&
      values.z === undefined
    ) {
      emitLine("ok");
      return;
    }

    const target: Position3 = { ...machine };
    const applyAxis = (axis: keyof Position3, v: number | undefined) => {
      if (v === undefined) return;
      if (absolute) target[axis] = wco[axis] + v;
      else target[axis] = machine[axis] + v;
    };
    applyAxis("x", values.x);
    applyAxis("y", values.y);
    applyAxis("z", values.z);

    busy = true;
    animateTo(target, feed, "Run", finishCommand);
  };

  const isMotionLine = (cmd: string) =>
    /\bG0(?!\d)/i.test(cmd) ||
    /\bG00\b/i.test(cmd) ||
    /\bG0*1\b/i.test(cmd) ||
    /\bG0*[23]\b/i.test(cmd) ||
    (/[XYZ]/i.test(cmd) &&
      !/^\$/i.test(cmd) &&
      !/^G10\b/i.test(cmd) &&
      !/^G92\b/i.test(cmd));

  const handleQueuedLine = (trimmed: string) => {
    // Unlock is allowed while locked; everything else is refused.
    if (/^\$X$/i.test(trimmed)) {
      if (state === "Alarm") {
        state = "Idle";
        emitLine("[MSG:Caution: Unlocked]");
      }
      emitLine("ok");
      return;
    }

    // Mock-only: force Alarm so unlock / refuse-motion UX can be exercised.
    if (/^\$Alarm$/i.test(trimmed)) {
      clearMotion();
      queue.length = 0;
      busy = false;
      state = "Alarm";
      emitLine("ALARM:1");
      emitLine("ok");
      return;
    }

    if (state === "Alarm") {
      emitLine("error:Alarm lock");
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
      const values = parseAxisValues(trimmed);
      if (values.x !== undefined) wco.x = machine.x - values.x;
      if (values.y !== undefined) wco.y = machine.y - values.y;
      if (values.z !== undefined) wco.z = machine.z - values.z;
      emitLine("ok");
      return;
    }

    if (/\bG90\b/i.test(trimmed)) absolute = true;
    if (/\bG91\b/i.test(trimmed)) absolute = false;

    if (isMotionLine(trimmed) && /[XYZ]/i.test(trimmed)) {
      applyProgramMotion(trimmed);
      return;
    }

    if (trimmed.length > 0) emitLine("ok");
  };

  const pump = () => {
    if (busy || state === "Hold") return;
    const next = queue.shift();
    if (!next) return;
    handleQueuedLine(next);
  };

  const softReset = () => {
    const wasAlarm = state === "Alarm";
    clearMotion();
    queue.length = 0;
    busy = false;
    machine = { x: 0, y: 0, z: 0 };
    absolute = true;
    // Soft reset from Alarm stays locked until `$X` (matches GRBL alarm lock UX).
    state = wasAlarm ? "Alarm" : "Idle";
    emitLine("Grbl 1.1h ['$' for help]");
    if (wasAlarm) {
      emitLine("ALARM:3");
      emitLine("[MSG:Reset to continue]");
    } else {
      emitLine("[MSG:Reset to continue]");
    }
  };

  const respondTo = (data: string | Uint8Array) => {
    if (typeof data !== "string") {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (bytes.length === 1 && bytes[0] === JOG_CANCEL_BYTE) {
        clearMotion();
        busy = false;
        state = "Idle";
        emitLine("ok");
        pump();
        return;
      }
      if (bytes.length === 1 && bytes[0] === SOFT_RESET_BYTE) {
        softReset();
        return;
      }
      return;
    }

    // Real-time single-character commands (no newline).
    if (data === "!") {
      if (state === "Run" || state === "Jog") {
        heldFrom = state;
        state = "Hold";
      }
      return;
    }
    if (data === "~") {
      if (state === "Hold") {
        state = heldFrom === "Jog" ? "Jog" : "Run";
        pump();
      }
      return;
    }

    const trimmed = data.replace(/\r?\n$/, "").trim();
    if (trimmed === "?") {
      if (state === "Idle" && statusTick < 3) {
        statusTick += 1;
      }
      emitStatus();
      return;
    }

    if (!trimmed) return;
    queue.push(trimmed);
    pump();
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
      clearMotion();
      queue.length = 0;
      busy = false;
      machine = { x: 40, y: 30, z: -1.5 };
      wco = { x: 10, y: 5, z: 0 };
      absolute = true;
      state = "Idle";
      statusTick = 0;
      emit({ type: "open" });
      emitLine("Grbl 1.1h ['$' for help]");
    },
    async close() {
      clearMotion();
      queue.length = 0;
      busy = false;
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
