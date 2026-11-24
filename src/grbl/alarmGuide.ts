import type { ParsedAlarm } from "./safety";
import { parseAlarmLine } from "./safety";

export type AlarmGuideKind =
  | "soft-limit"
  | "hard-limit"
  | "probe-fail"
  | "homing-fail"
  | "reset-motion"
  | "generic";

export interface AlarmGuideStep {
  title: string;
  detail: string;
}

export interface AlarmGuide {
  kind: AlarmGuideKind;
  headline: string;
  steps: AlarmGuideStep[];
  /** Suggest unlocking only after operator confirms physical clear. */
  unlockReadyHint: string;
}

const SOFT_LIMIT: AlarmGuide = {
  kind: "soft-limit",
  headline: "Soft limit / travel exceeded",
  steps: [
    {
      title: "Stop and clear the cut",
      detail:
        "Spindle off if safe. Do not jog until unlocked — GRBL is alarm-locked.",
    },
    {
      title: "Check material zero and soft travel",
      detail:
        "Confirm WCO and Calibration soft max ($130–$132). Job or jog may be past the configured envelope.",
    },
    {
      title: "Unlock ($X)",
      detail:
        "Only after the machine is clear of hard stops. Then carefully jog back inside soft travel.",
    },
  ],
  unlockReadyHint: "Machine clear of stops? Then Unlock.",
};

const HARD_LIMIT: AlarmGuide = {
  kind: "hard-limit",
  headline: "Hard limit triggered",
  steps: [
    {
      title: "Power / E-stop awareness",
      detail:
        "Limit switch is active. Keep hands clear; do not force motion into the switch.",
    },
    {
      title: "Back off the switch",
      detail:
        "After Unlock you may need a careful jog away from the triggered axis home/limit.",
    },
    {
      title: "Unlock ($X)",
      detail: "Clear the fault in SharpCNC, then re-home if position is uncertain.",
    },
  ],
  unlockReadyHint: "Switch cleared / safe to unlock?",
};

const PROBE_FAIL: AlarmGuide = {
  kind: "probe-fail",
  headline: "Probe failed",
  steps: [
    {
      title: "Check plate and clip",
      detail:
        "Alarm 4 = probe was already touching (or reads as touching) before the move. Alarm 5 = no contact within the seek distance. Verify alligator clip, plate, and $6 invert.",
    },
    {
      title: "Raise Z / clear contact",
      detail:
        "If the bit is still on the plate, unlock then jog Z up before retrying.",
    },
    {
      title: "Unlock ($X) and retry",
      detail: "Return to Prepare / probe with a longer seek or slower feed if needed.",
    },
  ],
  unlockReadyHint: "Probe clear of the plate?",
};

const HOMING_FAIL: AlarmGuide = {
  kind: "homing-fail",
  headline: "Homing failed",
  steps: [
    {
      title: "Check home switches",
      detail: "Confirm wiring and that $22 homing is enabled. Clear debris from switches.",
    },
    {
      title: "Unlock ($X)",
      detail: "Clear the alarm, then retry Home ($H) from a safe start position.",
    },
  ],
  unlockReadyHint: "Axes free to seek home?",
};

const RESET_MOTION: AlarmGuide = {
  kind: "reset-motion",
  headline: "Reset while in motion",
  steps: [
    {
      title: "Assume position lost",
      detail:
        "Soft reset aborted motion. Material/machine may need re-zero or re-home.",
    },
    {
      title: "Unlock if locked, then re-establish zeros",
      detail:
        "Home if you use switches; otherwise carefully re-set material zero before cutting.",
    },
  ],
  unlockReadyHint: "Ready to unlock and re-zero?",
};

const GENERIC: AlarmGuide = {
  kind: "generic",
  headline: "Alarm lock",
  steps: [
    {
      title: "Read the alarm code",
      detail: "Use the banner text. Clear the physical cause before unlocking.",
    },
    {
      title: "Unlock ($X)",
      detail: "Motion stays blocked until unlock. Soft-reset from Alarm stays locked until $X.",
    },
  ],
  unlockReadyHint: "Fault cleared — unlock?",
};

export function classifyAlarm(code: number | null): AlarmGuideKind {
  if (code === 2) return "soft-limit";
  if (code === 1) return "hard-limit";
  if (code === 4 || code === 5) return "probe-fail";
  if (code === 6 || code === 7 || code === 8 || code === 9) return "homing-fail";
  if (code === 3) return "reset-motion";
  return "generic";
}

export function guideForAlarm(alarm: ParsedAlarm | null): AlarmGuide {
  if (!alarm) return GENERIC;
  const kind = classifyAlarm(alarm.code);
  switch (kind) {
    case "soft-limit":
      return SOFT_LIMIT;
    case "hard-limit":
      return HARD_LIMIT;
    case "probe-fail":
      return PROBE_FAIL;
    case "homing-fail":
      return HOMING_FAIL;
    case "reset-motion":
      return RESET_MOTION;
    default:
      return {
        ...GENERIC,
        headline: alarm.message || GENERIC.headline,
      };
  }
}

export function guideFromAlarmLine(line: string): AlarmGuide {
  return guideForAlarm(parseAlarmLine(line));
}
