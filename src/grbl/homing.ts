import { ESTOP_LATCHED_REASON, type GrblMachineState } from "./types";

/** GRBL cycle home — requires `$22=1` and limit switches on the home side. */
export const HOME_COMMAND = "$H";

/** localStorage key for session-adjacent home preferences. */
export const HOMING_CONFIG_KEY = "sharpcnc.homing.v1";

export interface HomingConfig {
  /**
   * Soft reminder: require a successful home this session before Start.
   * Off by default — soft limits still protect travel when configured.
   */
  requireHomeBeforeStart: boolean;
}

export const DEFAULT_HOMING_CONFIG: HomingConfig = {
  requireHomeBeforeStart: false,
};

export function loadHomingConfig(): HomingConfig {
  try {
    const raw = localStorage.getItem(HOMING_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_HOMING_CONFIG };
    const parsed = JSON.parse(raw) as Partial<HomingConfig>;
    return {
      requireHomeBeforeStart: parsed.requireHomeBeforeStart === true,
    };
  } catch {
    return { ...DEFAULT_HOMING_CONFIG };
  }
}

export function saveHomingConfig(config: HomingConfig): void {
  try {
    localStorage.setItem(HOMING_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore quota / private mode
  }
}

export function canHome(
  state: GrblMachineState,
  connected: boolean,
  streaming: boolean,
): { ok: boolean; reason?: string } {
  if (!connected) return { ok: false, reason: "Connect first." };
  if (state === "EStopLatched") return { ok: false, reason: ESTOP_LATCHED_REASON };
  if (streaming) return { ok: false, reason: "Stop the job first." };
  if (state === "Alarm") {
    return { ok: false, reason: "Alarm lock — unlock ($X) before homing." };
  }
  if (state === "Hold") {
    return { ok: false, reason: "Feed hold active — resume or reset first." };
  }
  if (state === "Offline") return { ok: false, reason: "Machine offline." };
  if (state === "Run" || state === "Home" || state === "Jog") {
    return { ok: false, reason: `Busy (${state}) — wait for Idle.` };
  }
  return { ok: true };
}

/**
 * Clear SharpCNC's tracked "homed" session flag.
 * Does not erase GRBL EEPROM; soft-reset / power-cycle still own controller state.
 */
export function describeClearHomeState(): string {
  return "Cleared SharpCNC home flag. Machine coordinates are unchanged until you home or soft-reset.";
}
