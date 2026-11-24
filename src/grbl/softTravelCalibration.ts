/**
 * Soft travel polish helpers (Calibrate step 6 / PR 5).
 * Prerequisite ($22), verify-limit jog (expects error:15), hard limits ($21),
 * and plain-language error:10 when soft limits need homing.
 */
import type { SoftTravelLimits } from "./machineConfig";
import { maxForAxis, minForAxis } from "./machineConfig";
import type { JogDelta } from "./jog";
import type { GrblClient } from "./transport";
import type { Axis, Position3 } from "./types";

/** How far past the soft edge the verify jog aims (mm). */
export const SOFT_LIMIT_VERIFY_OVERSHOOT_MM = 1;

export const SOFT_TRAVEL_NEEDS_HOMING_COPY =
  "Soft limits need homing turned on. Finish the Homing step first.";

export const SOFT_LIMITS_WORKING_COPY = "Soft limits working ✓";

export const SOFT_TRAVEL_MACHINE_NOT_WORK_COPY =
  "Soft limits protect the machine, not your work. They know how far each axis can travel, but not where your stock or spoilboard is. If your Z zero is set wrong, the machine will still plunge into the spoilboard. Your Z probe in Prepare is what protects the work.";

export const Z_TRAVEL_POSITIVE_COPY =
  "Enter Z travel as a positive number (e.g. 80). Because Z homes to the top, GRBL allows Z from 0 down to −80.";

export const HARD_LIMITS_OPTIONAL_COPY =
  "Extra backstop: stops instantly if a home-side switch is hit mid-job. Can false-trigger on noisy wiring.";

/** Map GRBL error:10 (soft limits require homing) to plain English. */
export function plainSoftLimitsNeedHoming(errorLine: string): string | null {
  if (!/^error:\s*10\b/i.test(errorLine.trim())) return null;
  return `${SOFT_TRAVEL_NEEDS_HOMING_COPY} (error:10)`;
}

/** True when a jog was refused for soft travel (real GRBL). */
export function isSoftLimitJogError(line: string): boolean {
  return /^error:\s*15\b/i.test(line.trim());
}

/**
 * Default Virtual CNC raises ALARM:2 on soft-limit jog (known mock delta).
 * Treat as a positive verify result so the step works without strict mode.
 */
export function isSoftLimitJogAlarm(line: string): boolean {
  return /^ALARM:\s*2\b/i.test(line.trim());
}

/**
 * Incremental jog delta that deliberately overshoots the soft edge for `axis`.
 * Returns null when travel for that axis is unknown.
 */
export function softLimitVerifyDelta(
  axis: Axis,
  machine: Position3,
  limits: SoftTravelLimits,
  overshootMm: number = SOFT_LIMIT_VERIFY_OVERSHOOT_MM,
): JogDelta | null {
  const over = Math.max(0.1, overshootMm);
  if (axis === "X") {
    const max = maxForAxis(limits, "X");
    if (max === null || !Number.isFinite(max)) return null;
    return { x: max + over - machine.x };
  }
  if (axis === "Y") {
    const max = maxForAxis(limits, "Y");
    if (max === null || !Number.isFinite(max)) return null;
    return { y: max + over - machine.y };
  }
  const minZ = minForAxis(limits, "Z");
  if (!Number.isFinite(minZ)) return null;
  return { z: minZ - over - machine.z };
}

export type SoftLimitVerifyOutcome =
  | { ok: true; kind: "error:15" | "ALARM:2" }
  | { ok: false; reason: string };

/**
 * Send an intentional overshoot jog (no app-side clamp) and wait for soft-limit
 * refusal. Real GRBL → error:15 + Idle; default Virtual CNC → ALARM:2.
 */
export async function runSoftLimitVerifyJog(
  client: GrblClient,
  cmd: string,
  options: { timeoutMs?: number } = {},
): Promise<SoftLimitVerifyOutcome> {
  const timeoutMs = options.timeoutMs ?? 4000;
  if (!client.transport.isOpen) {
    return { ok: false, reason: "Not connected." };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve({
        ok: false,
        reason: "Timed out waiting for soft-limit refusal (error:15).",
      });
    }, timeoutMs);

    const unsub = client.transport.onLine((line: string) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("<")) return;
      if (isSoftLimitJogError(trimmed)) {
        clearTimeout(timer);
        unsub();
        resolve({ ok: true, kind: "error:15" });
        return;
      }
      if (isSoftLimitJogAlarm(trimmed)) {
        clearTimeout(timer);
        unsub();
        resolve({ ok: true, kind: "ALARM:2" });
        return;
      }
      if (/^error:/i.test(trimmed)) {
        clearTimeout(timer);
        unsub();
        resolve({ ok: false, reason: trimmed });
        return;
      }
      if (trimmed === "ok") {
        // Jog accepted — soft limits did not refuse.
        clearTimeout(timer);
        unsub();
        resolve({
          ok: false,
          reason:
            "Jog was accepted — soft limits did not refuse. Enable $20 and check travel values.",
        });
      }
    });

    void client.sendLine(cmd).catch((err: unknown) => {
      clearTimeout(timer);
      unsub();
      resolve({
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    });
  });
}
