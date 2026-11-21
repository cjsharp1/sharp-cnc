import type { StreamPhase } from "./streamer";
import type { GrblActivePins, GrblMachineState, GrblStatus } from "./types";

/**
 * Demon Shield (Arduino Uno + GRBL) external control pins — Designs by Phil /
 * common GRBL 1.1 Arduino pinout:
 *
 * | Button   | Shield label | Arduino pin | GRBL pin letter (`Pn:`) |
 * |----------|--------------|-------------|-------------------------|
 * | Abort    | ABORT        | A0          | `R` (reset)             |
 * | Pause    | FEED HOLD    | A1          | `H` (feed hold)         |
 * | Start    | RESUME       | A2          | `S` (cycle start)       |
 *
 * Hardware buttons drive the same real-time actions as serial `!` / `~` /
 * Ctrl-X. They do **not** emit custom serial messages — the GUI learns about
 * them from:
 * 1. Machine state changes in `?` status reports (`Run` ↔ `Hold` ↔ `Idle`)
 * 2. Optional `Pn:` active-pin letters while a button is held across a poll
 * 3. Soft-reset welcome banner (`Grbl …`) after Abort
 *
 * Chris should confirm on hardware: Abort = soft reset (not a latching E-stop),
 * and whether Resume while Idle should start a loaded job (we treat it as yes).
 */

export type { GrblActivePins };

export type ExternalControlAction =
  | "hold"
  | "resume"
  | "abort"
  | "start"
  | "cycle-start-idle";

export type ExternalControlSource = "state" | "pin" | "reset-banner";

export interface ExternalControlEvent {
  action: ExternalControlAction;
  source: ExternalControlSource;
  /** Short human label for the activity log. */
  message: string;
}

export interface ExternalControlObserveInput {
  status: GrblStatus;
  streamPhase: StreamPhase;
  /** Optional raw RX line (welcome banner / MSG) observed alongside status. */
  rawLine?: string;
  nowMs?: number;
}

export interface ExternalControlAdapter {
  /**
   * Tell the adapter the UI / software is about to (or just did) send the
   * matching real-time command so we do not treat the resulting machine
   * transition as an external press.
   */
  noteSoftwareAction(action: ExternalControlAction, nowMs?: number): void;
  /** Feed status (and optional raw lines); returns new external events. */
  observe(input: ExternalControlObserveInput): ExternalControlEvent[];
  reset(): void;
}

export interface CreateExternalControlAdapterOptions {
  /**
   * How long after a software hold/resume/abort/start we ignore matching
   * machine transitions as "external". Default 800ms (~3 status polls).
   */
  softwareSuppressMs?: number;
}

const EMPTY_PINS: GrblActivePins = {
  cycleStart: false,
  feedHold: false,
  reset: false,
  door: false,
  raw: "",
};

/** Parse `Pn:XYZPDHRS`-style pin letters into control pin flags. */
export function parseActivePins(raw: string | undefined | null): GrblActivePins {
  if (!raw) return { ...EMPTY_PINS };
  const letters = raw.toUpperCase();
  return {
    cycleStart: letters.includes("S"),
    feedHold: letters.includes("H"),
    reset: letters.includes("R"),
    door: letters.includes("D"),
    raw: letters,
  };
}

/** True when a RX line looks like a GRBL soft-reset welcome banner. */
export function isGrblResetBanner(line: string): boolean {
  const trimmed = line.trim();
  return /^Grbl\s+/i.test(trimmed) || /^\[MSG:Reset to continue\]/i.test(trimmed);
}

function isActiveStream(phase: StreamPhase): boolean {
  return (
    phase === "running" ||
    phase === "paused" ||
    phase === "stopping" ||
    phase === "error"
  );
}

/**
 * Demon Shield / stock GRBL adapter: detect external start/pause/stop from
 * status state + `Pn:` edges, while cooperating with software controls.
 */
export function createDemonShieldExternalControlAdapter(
  options: CreateExternalControlAdapterOptions = {},
): ExternalControlAdapter {
  const softwareSuppressMs = options.softwareSuppressMs ?? 800;

  let prevState: GrblMachineState | null = null;
  let prevPins: GrblActivePins = { ...EMPTY_PINS };
  let prevStreamPhase: StreamPhase = "idle";
  const suppressUntil: Partial<Record<ExternalControlAction, number>> = {};

  const noteSoftwareAction = (
    action: ExternalControlAction,
    nowMs = Date.now(),
  ) => {
    suppressUntil[action] = nowMs + softwareSuppressMs;
    // Hold/resume/abort often arrive as both pin + state; suppress siblings.
    if (action === "hold") {
      suppressUntil.hold = nowMs + softwareSuppressMs;
    } else if (action === "resume" || action === "start") {
      suppressUntil.resume = nowMs + softwareSuppressMs;
      suppressUntil["cycle-start-idle"] = nowMs + softwareSuppressMs;
      suppressUntil.start = nowMs + softwareSuppressMs;
    } else if (action === "abort") {
      suppressUntil.abort = nowMs + softwareSuppressMs;
    }
  };

  const isSuppressed = (action: ExternalControlAction, nowMs: number) => {
    const until = suppressUntil[action];
    return until !== undefined && nowMs < until;
  };

  const observe = (input: ExternalControlObserveInput): ExternalControlEvent[] => {
    const nowMs = input.nowMs ?? Date.now();
    const { status, streamPhase } = input;
    const pins = status.pins ?? EMPTY_PINS;
    const events: ExternalControlEvent[] = [];

    const emit = (
      action: ExternalControlAction,
      source: ExternalControlSource,
      message: string,
    ) => {
      if (isSuppressed(action, nowMs)) return;
      // Deduplicate within this observation batch.
      if (events.some((e) => e.action === action)) return;
      events.push({ action, source, message });
      // Once we accept an external event, suppress briefly so pin+state
      // double-fires in the same press don't enqueue twice.
      suppressUntil[action] = nowMs + softwareSuppressMs;
    };

    // Soft-reset banner while a job stream is active → Abort button (or cable).
    if (input.rawLine && isGrblResetBanner(input.rawLine) && isActiveStream(streamPhase)) {
      emit(
        "abort",
        "reset-banner",
        "External abort / reset (GRBL restarted)",
      );
    }

    // Rising pin edges (button held across a `?` poll — may miss very short taps).
    if (pins.feedHold && !prevPins.feedHold) {
      if (streamPhase === "running" || status.state === "Run" || status.state === "Jog") {
        emit("hold", "pin", "External pause (feed hold pin)");
      }
    }
    if (pins.reset && !prevPins.reset) {
      if (isActiveStream(streamPhase) || status.state === "Run" || status.state === "Hold") {
        emit("abort", "pin", "External stop (abort / reset pin)");
      }
    }
    if (pins.cycleStart && !prevPins.cycleStart) {
      if (streamPhase === "paused" || status.state === "Hold") {
        emit("resume", "pin", "External start / resume (cycle start pin)");
      } else if (
        streamPhase === "idle" ||
        streamPhase === "completed" ||
        streamPhase === "error"
      ) {
        if (
          status.state === "Idle" ||
          status.state === "Check" ||
          status.state === "Unknown"
        ) {
          emit(
            "cycle-start-idle",
            "pin",
            "External start (cycle start while idle)",
          );
        }
      }
    }

    // State transitions — reliable even when a momentary press is missed by Pn:.
    if (prevState !== null && prevState !== status.state) {
      if (
        status.state === "Hold" &&
        (prevState === "Run" || prevState === "Jog") &&
        streamPhase === "running"
      ) {
        emit("hold", "state", "External pause (machine Hold)");
      }

      if (
        status.state === "Run" &&
        prevState === "Hold" &&
        streamPhase === "paused"
      ) {
        emit("resume", "state", "External resume (machine Run)");
      }

      // Abort / stop: active stream, machine returned to Idle without our stop.
      // (Normal job completion leaves streamPhase "completed", not running/paused.)
      if (
        status.state === "Idle" &&
        (prevState === "Run" || prevState === "Hold" || prevState === "Jog") &&
        (streamPhase === "running" || streamPhase === "paused")
      ) {
        emit("abort", "state", "External stop (machine Idle during job)");
      }

      if (
        status.state === "Alarm" &&
        (streamPhase === "running" || streamPhase === "paused")
      ) {
        emit("abort", "state", "External stop / alarm during job");
      }
    }

    prevState = status.state;
    prevPins = { ...pins };
    prevStreamPhase = streamPhase;
    void prevStreamPhase;

    return events;
  };

  return {
    noteSoftwareAction,
    observe,
    reset() {
      prevState = null;
      prevPins = { ...EMPTY_PINS };
      prevStreamPhase = "idle";
      for (const key of Object.keys(suppressUntil) as ExternalControlAction[]) {
        delete suppressUntil[key];
      }
    },
  };
}
