import type { GrblClient } from "./transport";
import type { Axis, GrblMachineState, Position3 } from "./types";
import {
  buildZProbeSeekCommand,
  canProbe,
  parseProbeResult,
  type ProbeResult,
} from "./probe";

/**
 * XY edge / corner probe helpers for GRBL 1.1 (G38.2).
 *
 * Edge: seek along +X/−X or +Y/−Y until contact, then set that work axis to 0
 * (or ± half bit diameter when probing stock face with a round bit).
 * Corner: run X then Y (or Y then X) against an outside/inside corner.
 * Tool length: after a bit change, Z-probe a known plate and set work Z.
 */

export type EdgeAxis = "X" | "Y";
export type EdgeDirection = "positive" | "negative";

export interface EdgeProbeOptions {
  axis: EdgeAxis;
  direction: EdgeDirection;
  /** How far to seek along the axis (mm, positive). */
  seekMm: number;
  feedMmMin: number;
  /**
   * After contact, set work axis so contact face is 0, offset by this
   * (e.g. +bitRadius when approaching stock from −X outside face).
   */
  workOffsetMm?: number;
  timeoutMs?: number;
}

export interface CornerProbeOptions {
  /** Outside corner: approach +X then +Y from the third quadrant relative to corner. */
  mode: "outside" | "inside";
  seekMm: number;
  feedMmMin: number;
  /** Bit radius compensation applied on each axis after contact. */
  bitRadiusMm?: number;
  /** Retract between axes (relative mm along the probe axis, away from stock). */
  retractMm?: number;
  timeoutMs?: number;
}

export interface ToolLengthProbeOptions {
  plateThicknessMm: number;
  seekMm: number;
  feedMmMin: number;
  /** Optional known tool length reference (stored for UI). */
  timeoutMs?: number;
}

function fmt(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

export function buildAxisProbeSeekCommand(
  axis: EdgeAxis,
  direction: EdgeDirection,
  seekMm: number,
  feedMmMin: number,
): string {
  const seek = Math.abs(seekMm);
  const signed = direction === "positive" ? seek : -seek;
  const feed = Math.max(1, Math.round(feedMmMin));
  return `G38.2 ${axis}${fmt(signed)} F${feed}`;
}

export function buildEdgeWorkZeroCommand(
  axis: EdgeAxis,
  workOffsetMm = 0,
): string {
  return `G10 L20 P1 ${axis}${fmt(workOffsetMm)}`;
}

export function buildRelativeRetractCommand(
  axis: Axis,
  deltaMm: number,
  feedMmMin = 400,
): string {
  const feed = Math.max(1, Math.round(feedMmMin));
  return `$J=G91 G21 ${axis}${fmt(deltaMm)} F${feed}`;
}

export { canProbe };

async function waitForProbe(
  client: GrblClient,
  timeoutMs: number,
): Promise<ProbeResult> {
  const holder: {
    probe: ProbeResult | null;
    alarm: string | null;
  } = { probe: null, alarm: null };

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("Timed out waiting for probe result (G38.2)."));
    }, timeoutMs);

    const unsub = client.transport.onLine((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("<")) return;

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
      if (trimmed === "ok" && holder.probe) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });

  if (!holder.probe || !holder.probe.success) {
    throw new Error(
      holder.alarm ??
        (holder.probe
          ? "Probe reported no contact ([PRB:…:0])."
          : "Probe finished without a [PRB:] report."),
    );
  }
  return holder.probe;
}

/** Single-axis edge probe + G10 L20 work zero on that axis. */
export async function runEdgeProbeCycle(
  client: GrblClient,
  options: EdgeProbeOptions,
): Promise<{ probe: ProbeResult; workZeroCommand: string }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!client.transport.isOpen) throw new Error("Not connected.");

  const workZeroCommand = buildEdgeWorkZeroCommand(
    options.axis,
    options.workOffsetMm ?? 0,
  );

  try {
    await client.sendLine("G91");
    await client.sendLine(
      buildAxisProbeSeekCommand(
        options.axis,
        options.direction,
        options.seekMm,
        options.feedMmMin,
      ),
    );
    const probe = await waitForProbe(client, timeoutMs);
    await client.sendLine("G90");
    await client.sendLine(workZeroCommand);
    await client.requestStatus();
    return { probe, workZeroCommand };
  } catch (err) {
    try {
      await client.sendLine("G90");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

/**
 * Outside corner: probe +X (from −X side) then +Y (from −Y side).
 * Inside corner: probe −X then −Y (approaching from inside the cutout).
 */
export async function runCornerProbeCycle(
  client: GrblClient,
  options: CornerProbeOptions,
): Promise<{ probes: ProbeResult[]; commands: string[] }> {
  const radius = Math.max(0, options.bitRadiusMm ?? 0);
  const retract = Math.abs(options.retractMm ?? 2);
  const outside = options.mode === "outside";
  const probes: ProbeResult[] = [];
  const commands: string[] = [];

  const axes: {
    axis: EdgeAxis;
    direction: EdgeDirection;
    offset: number;
    retractDelta: number;
  }[] = outside
    ? [
        {
          axis: "X",
          direction: "positive",
          offset: radius,
          retractDelta: -retract,
        },
        {
          axis: "Y",
          direction: "positive",
          offset: radius,
          retractDelta: -retract,
        },
      ]
    : [
        {
          axis: "X",
          direction: "negative",
          offset: -radius,
          retractDelta: retract,
        },
        {
          axis: "Y",
          direction: "negative",
          offset: -radius,
          retractDelta: retract,
        },
      ];

  for (let i = 0; i < axes.length; i++) {
    const step = axes[i]!;
    const result = await runEdgeProbeCycle(client, {
      axis: step.axis,
      direction: step.direction,
      seekMm: options.seekMm,
      feedMmMin: options.feedMmMin,
      workOffsetMm: step.offset,
      timeoutMs: options.timeoutMs,
    });
    probes.push(result.probe);
    commands.push(result.workZeroCommand);

    if (i < axes.length - 1) {
      const retractCmd = buildRelativeRetractCommand(
        step.axis,
        step.retractDelta,
        Math.max(200, options.feedMmMin),
      );
      await client.sendLine(retractCmd);
      commands.push(retractCmd);
    }
  }

  return { probes, commands };
}

/**
 * Tool-length / bit-change Z probe: same as plate Z zero, exposed for UI wording.
 * Sets work Z so plate top − thickness = stock/table reference.
 */
export async function runToolLengthProbeCycle(
  client: GrblClient,
  options: ToolLengthProbeOptions,
): Promise<{ probe: ProbeResult; workZeroCommand: string }> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (!client.transport.isOpen) throw new Error("Not connected.");

  const workZeroCommand = `G10 L20 P1 Z${fmt(Math.max(0, options.plateThicknessMm))}`;

  try {
    await client.sendLine("G91");
    await client.sendLine(
      buildZProbeSeekCommand(options.seekMm, options.feedMmMin),
    );
    const probe = await waitForProbe(client, timeoutMs);
    await client.sendLine("G90");
    await client.sendLine(workZeroCommand);
    await client.requestStatus();
    return { probe, workZeroCommand };
  } catch (err) {
    try {
      await client.sendLine("G90");
    } catch {
      /* ignore */
    }
    throw err;
  }
}

export function canToolLengthProbe(
  state: GrblMachineState,
  connected: boolean,
  streaming: boolean,
  probePinActive?: boolean,
): { ok: boolean; reason?: string } {
  return canProbe(state, connected, streaming, { probePinActive });
}

/** Derive bit radius from diameter for corner compensation. */
export function bitRadiusMm(diameterMm: number): number {
  return Math.max(0, diameterMm) / 2;
}

export type { Position3 };
