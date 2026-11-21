import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import type { Axis, Position3 } from "./types";
import { buildJogCommand, checkSoftLimits, type JogDelta } from "./jog";

/** G54 work coordinate system (P1). */
export const DEFAULT_WCS_P = 1;

export type ZeroAxisSelection = Axis | "XYZ";

/**
 * Set current position as work zero via G10 L20 (preferred over G92).
 * `G10 L20 P1 X0 Y0 Z0` makes the current machine location work-zero for G54.
 */
export function buildSetWorkZeroCommand(
  axes: ZeroAxisSelection,
  wcsP: number = DEFAULT_WCS_P,
): string {
  const parts = [`G10 L20 P${wcsP}`];
  if (axes === "XYZ") {
    parts.push("X0", "Y0", "Z0");
  } else {
    parts.push(`${axes}0`);
  }
  return parts.join(" ");
}

export interface GoToWorkZeroPlan {
  /** Ordered jog commands (safe Z-up first when XY is involved). */
  commands: string[];
  /** Soft-limit / safety notes; empty when clear. */
  warnings: string[];
  blocked?: string;
}

export interface GoToWorkZeroOptions {
  /** Absolute work Z to raise to before XY (default 0 = work Z zero). */
  safeWorkZ?: number;
  /** Feed for Z moves (mm/min). */
  zFeedMmMin?: number;
  /** Feed for XY moves (mm/min). */
  xyFeedMmMin?: number;
  softLimits?: SoftTravelLimits;
  /** Current machine position (for soft-limit checks). */
  machine?: Position3;
  /** Current work coordinate offset WCO = MPos − WPos. */
  wco?: Position3;
}

/**
 * Plan a go-to-work-zero move in work coordinates via `$J=` absolute (G90).
 * When XY is requested, raise Z to safe work Z first, then XY, optionally drop Z last.
 */
export function planGoToWorkZero(
  axes: ZeroAxisSelection,
  options: GoToWorkZeroOptions = {},
): GoToWorkZeroPlan {
  const safeWorkZ = options.safeWorkZ ?? 0;
  const zFeed = options.zFeedMmMin ?? 300;
  const xyFeed = options.xyFeedMmMin ?? 800;
  const warnings: string[] = [];
  const commands: string[] = [];

  const wantX = axes === "XYZ" || axes === "X";
  const wantY = axes === "XYZ" || axes === "Y";
  const wantZ = axes === "XYZ" || axes === "Z";
  const wantXy = wantX || wantY;

  // Soft-limit check: work zero (0,0,0) maps to machine = WCO.
  if (options.softLimits && options.wco && options.machine) {
    const targets: { label: string; machine: Position3 }[] = [];
    if (wantXy) {
      targets.push({
        label: "safe Z",
        machine: {
          x: options.machine.x,
          y: options.machine.y,
          z: options.wco.z + safeWorkZ,
        },
      });
      targets.push({
        label: "XY zero",
        machine: {
          x: wantX ? options.wco.x : options.machine.x,
          y: wantY ? options.wco.y : options.machine.y,
          z: options.wco.z + safeWorkZ,
        },
      });
    }
    if (wantZ) {
      targets.push({
        label: "Z zero",
        machine: {
          x: wantX && wantXy ? options.wco.x : options.machine.x,
          y: wantY && wantXy ? options.wco.y : options.machine.y,
          z: options.wco.z,
        },
      });
    }

    for (const t of targets) {
      const delta: JogDelta = {
        x: t.machine.x - options.machine.x,
        y: t.machine.y - options.machine.y,
        z: t.machine.z - options.machine.z,
      };
      const check = checkSoftLimits(options.machine, delta, options.softLimits);
      if (!check.ok) {
        return {
          commands: [],
          warnings,
          blocked: `Go-to-zero blocked (${t.label}): ${check.reason}`,
        };
      }
      // Also refuse if the absolute target is outside known travel.
      for (const axis of ["X", "Y", "Z"] as Axis[]) {
        const key = axis.toLowerCase() as keyof Position3;
        const max = maxForAxis(options.softLimits, axis);
        const min = minForAxis(options.softLimits, axis);
        const v = t.machine[key];
        if (v < min - 1e-6 || (max !== null && v > max + 1e-6)) {
          return {
            commands: [],
            warnings,
            blocked: `Go-to-zero target ${axis}=${v.toFixed(3)} outside soft travel`,
          };
        }
      }
    }
  } else if (!options.softLimits) {
    warnings.push("Soft travel not configured — move carefully.");
  }

  const absJog = (parts: string[], feed: number) =>
    `$J=G90 G21 ${parts.join(" ")} F${Math.round(feed)}`;

  if (wantXy) {
    commands.push(absJog([`Z${fmt(safeWorkZ)}`], zFeed));
    const xy: string[] = [];
    if (wantX) xy.push("X0");
    if (wantY) xy.push("Y0");
    commands.push(absJog(xy, xyFeed));
    if (wantZ && safeWorkZ !== 0) {
      commands.push(absJog(["Z0"], zFeed));
    } else if (wantZ && safeWorkZ === 0) {
      // Already at Z0 after the raise step.
    }
  } else if (wantZ) {
    commands.push(absJog(["Z0"], zFeed));
  }

  return { commands, warnings };
}

function fmt(n: number): string {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

/** Incremental relative jog helper re-export for go-to sequences that prefer G91. */
export { buildJogCommand };
