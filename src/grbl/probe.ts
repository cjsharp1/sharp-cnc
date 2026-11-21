import type { GrblClient } from "./transport";
import type { GrblMachineState, Position3 } from "./types";
import { buildSetWorkZeroCommand } from "./workZero";

/**
 * Z probe / touch-plate helpers for GRBL 1.1 (Demon Shield / Arduino).
 *
 * Common hardware path Chris uses:
 * - Conductive plate on stock top (or table)
 * - Alligator clip on the bit (closes circuit when bit touches plate)
 * - Wired to GRBL PROBE input (Arduino Uno GRBL 1.1 default: A5)
 *
 * Cycle (standard):
 * 1. Jog XY over the plate; leave Z clear above it
 * 2. `G91` then `G38.2 Z-{seek} F{feed}` (probe toward more-negative Z)
 * 3. On success GRBL emits `[PRB:x,y,z:1]` then `ok` and stops at contact
 * 4. Set work Z so stock top is Z0: `G10 L20 P1 Z{plateThicknessMm}`
 *    (current tip is on the plate top; stock face is plateThickness below)
 * 5. Optional retract in work coords
 *
 * Assumptions to verify on Demon Shield:
 * - Probe pin is wired and `$6` invert matches the plate polarity
 * - Soft limits (`$20`) / max travel do not trap the seek distance
 * - Alarm 4 = no contact within seek; Alarm 5 = already contacting at start
 */

/** localStorage key for probe prefs. */
export const PROBE_CONFIG_KEY = "sharpcnc.probe.v1";

export interface ProbeConfig {
  /** Touch-plate thickness in mm (stock top = plate top − this). */
  plateThicknessMm: number;
  /** Relative Z seek distance (mm, positive = how far to look down). */
  seekMm: number;
  /** Probe feed mm/min (slow — contact accuracy). */
  feedMmMin: number;
  /** Retract above stock top after zero (work Z, mm). */
  retractWorkZMm: number;
}

export const DEFAULT_PROBE_CONFIG: ProbeConfig = {
  plateThicknessMm: 1.5,
  seekMm: 30,
  feedMmMin: 80,
  retractWorkZMm: 5,
};

export function loadProbeConfig(): ProbeConfig {
  try {
    const raw = localStorage.getItem(PROBE_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_PROBE_CONFIG };
    const parsed = JSON.parse(raw) as Partial<ProbeConfig>;
    return {
      plateThicknessMm:
        typeof parsed.plateThicknessMm === "number" &&
        Number.isFinite(parsed.plateThicknessMm) &&
        parsed.plateThicknessMm >= 0
          ? parsed.plateThicknessMm
          : DEFAULT_PROBE_CONFIG.plateThicknessMm,
      seekMm:
        typeof parsed.seekMm === "number" &&
        Number.isFinite(parsed.seekMm) &&
        parsed.seekMm > 0
          ? parsed.seekMm
          : DEFAULT_PROBE_CONFIG.seekMm,
      feedMmMin:
        typeof parsed.feedMmMin === "number" &&
        Number.isFinite(parsed.feedMmMin) &&
        parsed.feedMmMin > 0
          ? parsed.feedMmMin
          : DEFAULT_PROBE_CONFIG.feedMmMin,
      retractWorkZMm:
        typeof parsed.retractWorkZMm === "number" &&
        Number.isFinite(parsed.retractWorkZMm)
          ? parsed.retractWorkZMm
          : DEFAULT_PROBE_CONFIG.retractWorkZMm,
    };
  } catch {
    return { ...DEFAULT_PROBE_CONFIG };
  }
}

export function saveProbeConfig(config: ProbeConfig): void {
  try {
    localStorage.setItem(PROBE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore quota / private mode
  }
}

/** Parsed `[PRB:x,y,z:success]` message (machine coordinates). */
export interface ProbeResult {
  machine: Position3;
  /** 1 = contact found; 0 = failed without alarm in some firmwares. */
  success: boolean;
  raw: string;
}

/**
 * Parse a GRBL probe report line, e.g. `[PRB:10.000,20.000,-1.500:1]`.
 */
export function parseProbeResult(line: string): ProbeResult | null {
  const trimmed = line.trim();
  const match =
    /^\[PRB:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?):([01])\]$/i.exec(
      trimmed,
    );
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  const z = Number(match[3]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return {
    machine: { x, y, z },
    success: match[4] === "1",
    raw: trimmed,
  };
}

/** Relative G38.2 seek toward −Z (plate below the bit). */
export function buildZProbeSeekCommand(
  seekMm: number,
  feedMmMin: number,
): string {
  const seek = Math.abs(seekMm);
  const feed = Math.max(1, Math.round(feedMmMin));
  return `G38.2 Z-${fmt(seek)} F${feed}`;
}

/**
 * After contact on the plate top, set work Z so stock top is 0.
 * Current tip position becomes Z = plateThicknessMm.
 */
export function buildProbeWorkZZeroCommand(
  plateThicknessMm: number,
): string {
  const z = Math.max(0, plateThicknessMm);
  // Reuse G10 helper shape: current location is work Z = thickness.
  return `G10 L20 P1 Z${fmt(z)}`;
}

/** Absolute work-Z retract jog after probing. */
export function buildProbeRetractCommand(
  retractWorkZMm: number,
  feedMmMin = 300,
): string {
  const z = retractWorkZMm;
  const feed = Math.max(1, Math.round(feedMmMin));
  return `$J=G90 G21 Z${fmt(z)} F${feed}`;
}

export function canProbe(
  state: GrblMachineState,
  connected: boolean,
  streaming: boolean,
  options?: { probePinActive?: boolean },
): { ok: boolean; reason?: string } {
  if (!connected) return { ok: false, reason: "Connect first." };
  if (streaming) return { ok: false, reason: "Stop the job first." };
  if (state === "Alarm") {
    return { ok: false, reason: "Alarm lock — unlock before probing." };
  }
  if (state === "Hold") {
    return { ok: false, reason: "Feed hold active — resume or reset first." };
  }
  if (state === "Offline") return { ok: false, reason: "Machine offline." };
  if (state === "Run" || state === "Home" || state === "Jog") {
    return { ok: false, reason: `Busy (${state}) — wait for Idle.` };
  }
  if (options?.probePinActive) {
    return {
      ok: false,
      reason:
        "Probe pin already active — clear contact (Alarm 5 risk) before seeking.",
    };
  }
  return { ok: true };
}

export interface RunZProbeOptions {
  plateThicknessMm: number;
  seekMm: number;
  feedMmMin: number;
  /** Wait for PRB + ok. Default 15000ms. */
  timeoutMs?: number;
  /** Skip setting work Z after contact (rare). */
  skipWorkZero?: boolean;
}

export interface RunZProbeOutcome {
  probe: ProbeResult;
  workZeroCommand: string | null;
}

/**
 * Run a relative Z probe cycle and optionally set work Z from plate thickness.
 * Leaves modal state in G90 after the cycle.
 */
export async function runZProbeCycle(
  client: GrblClient,
  options: RunZProbeOptions,
): Promise<RunZProbeOutcome> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!client.transport.isOpen) {
    throw new Error("Not connected.");
  }

  // Holder so the onLine closure can assign without TS narrowing to `never`.
  const holder: { probe: ProbeResult | null; sawOk: boolean; alarm: string | null } =
    { probe: null, sawOk: false, alarm: null };

  const wait = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("Timed out waiting for probe result (G38.2)."));
    }, timeoutMs);

    const unsub = client.transport.onLine((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("<")) return;

      const prb = parseProbeResult(trimmed);
      if (prb) {
        holder.probe = prb;
        return;
      }

      if (/^ALARM:\s*\d+/i.test(trimmed)) {
        holder.alarm = trimmed;
        clearTimeout(timer);
        unsub();
        reject(new Error(trimmed));
        return;
      }
      if (/^error:/i.test(trimmed)) {
        clearTimeout(timer);
        unsub();
        reject(new Error(trimmed));
        return;
      }
      if (trimmed === "ok") {
        // G91 / G38.2 each ack — resolve once we have PRB + a post-probe ok.
        if (holder.probe) {
          holder.sawOk = true;
          clearTimeout(timer);
          unsub();
          resolve();
        }
      }
    });
  });

  // Incremental seek — do not rely on absolute work Z before zero is set.
  try {
    await client.sendLine("G91");
    await client.sendLine(
      buildZProbeSeekCommand(options.seekMm, options.feedMmMin),
    );
    await wait;
  } finally {
    // Best-effort restore absolute mode (ignore if Alarm-locked).
    try {
      await client.sendLine("G90");
    } catch {
      /* ignore */
    }
  }

  const probe = holder.probe;
  if (!probe || !probe.success) {
    throw new Error(
      holder.alarm ??
        (probe
          ? "Probe reported no contact ([PRB:…:0])."
          : "Probe finished without a [PRB:] report."),
    );
  }
  void holder.sawOk;

  let workZeroCommand: string | null = null;
  if (!options.skipWorkZero) {
    workZeroCommand = buildProbeWorkZZeroCommand(options.plateThicknessMm);
    await client.sendLine(workZeroCommand);
    await client.requestStatus();
  }

  return { probe, workZeroCommand };
}

/** Convenience: same G10 path as manual Zero Z after a paper touch-off. */
export function buildManualZZeroCommand(): string {
  return buildSetWorkZeroCommand("Z");
}

function fmt(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}
