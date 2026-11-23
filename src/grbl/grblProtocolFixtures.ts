/**
 * Canonical GRBL v1.1 protocol fixtures recorded from the official gnea/grbl
 * docs (interface.md, commands.md, alarm_codes / error_codes CSVs).
 *
 * Use these as the source of truth for “real firmware” expectations when
 * comparing SharpCNC’s Virtual CNC mock (`mockSerial.ts`). They are not live
 * grbl-sim output — they are the documented wire format.
 *
 * Sources:
 * - https://github.com/gnea/grbl/blob/master/doc/markdown/interface.md
 * - https://github.com/gnea/grbl/blob/master/doc/markdown/commands.md
 * - https://github.com/gnea/grbl/blob/master/doc/csv/alarm_codes_en_US.csv
 * - https://github.com/gnea/grbl/blob/master/doc/csv/error_codes_en_US.csv
 */

/** Welcome banner after power-up or soft-reset (`0x18`). */
export const REAL_WELCOME = "Grbl 1.1h ['$' for help]";

/** Soft-reset / critical-event feedback (often after ALARM from limit). */
export const REAL_MSG_RESET_TO_CONTINUE = "[MSG:Reset to continue]";

/** Power-up with alarm lock (homing enabled, position unknown). */
export const REAL_MSG_UNLOCK_HINT = "[MSG:'$H'|'$X' to unlock]";

/** Emitted after a successful `$X` unlock (then `ok`). */
export const REAL_MSG_UNLOCKED = "[MSG:Caution: Unlocked]";

/**
 * Official GRBL v1.1 alarm codes → short description.
 * Note: probe 4 = wrong initial state; probe 5 = no contact in seek.
 */
export const REAL_ALARM_CODES: Record<number, string> = {
  1: "Hard limit triggered. Machine position is likely lost due to sudden halt. Re-homing is highly recommended.",
  2: "Soft limit alarm. G-code motion target exceeds machine travel. Machine position retained. Alarm may be safely unlocked.",
  3: "Reset while in motion. Machine position is likely lost due to sudden halt. Re-homing is highly recommended.",
  4: "Probe fail. Probe is not in the expected initial state before starting probe cycle (G38.2/G38.3 not triggered / G38.4/G38.5 triggered).",
  5: "Probe fail. Probe did not contact the workpiece within the programmed travel for G38.2 and G38.4.",
  6: "Homing fail. The active homing cycle was reset.",
  7: "Homing fail. Safety door was opened during homing cycle.",
  8: "Homing fail. Pull off travel failed to clear limit switch.",
  9: "Homing fail. Could not find limit switch within search distances.",
  10: "Homing fail. Second dual-axis limit switch failed to trigger.",
};

/**
 * Official GRBL v1.1 numeric error codes used by SharpCNC-relevant paths.
 * Full table lives in gnea/grbl `error_codes_en_US.csv`.
 */
export const REAL_ERROR_CODES: Record<number, string> = {
  1: "Expected command letter",
  2: "Bad number format",
  3: "Invalid statement / unsupported $ command",
  8: "Not idle ($ command while not Idle)",
  9: "G-code locked out during alarm or jog state",
  15: "Jog target exceeds machine travel (command ignored)",
  16: "Invalid jog command",
  20: "Unsupported or invalid g-code command",
  22: "Undefined feed rate",
  33: "Motion command target is invalid",
};

/** Real-time single-byte / character commands (no newline). */
export const REALTIME = {
  softReset: 0x18,
  statusQuery: "?",
  feedHold: "!",
  cycleStart: "~",
} as const;

/**
 * Recorded status-report lines (chevrons) from the interface.md examples and
 * common 1.1 field sets. Parsers must accept all of these.
 */
export const REAL_STATUS_REPORTS: readonly string[] = [
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0>",
  "<Idle|MPos:0.000,0.000,0.000|WPos:0.000,0.000,0.000|FS:0.0,0>",
  "<Idle|WPos:10.000,-2.500,0.000|FS:0,0>",
  "<Run|MPos:12.345,6.000,-1.250|FS:500.0,10000>",
  "<Hold:0|MPos:1.000,2.000,0.000|FS:0,0>",
  "<Hold:1|MPos:1.000,2.000,0.000|FS:0,0>",
  "<Jog|MPos:5.000,5.000,0.000|FS:800,0>",
  "<Alarm|MPos:0.000,0.000,0.000|FS:0,0>",
  "<Home|MPos:0.000,0.000,0.000|FS:0,0>",
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:10.000,5.000,0.000>",
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0|Ov:100,100,100>",
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0|Pn:H>",
  "<Idle|MPos:0.000,0.000,0.000|FS:0,0|Pn:SDR>",
  "<Door:0|MPos:0.000,0.000,0.000|FS:0,0>",
  "<Check|MPos:0.000,0.000,0.000|FS:0,0>",
  "<Sleep|MPos:0.000,0.000,0.000|FS:0,0>",
];

/** Recorded alarm push lines. */
export const REAL_ALARM_LINES: readonly string[] = [
  "ALARM:1",
  "ALARM:2",
  "ALARM:3",
  "ALARM:4",
  "ALARM:5",
  "ALARM:6",
  "ALARM:7",
  "ALARM:8",
  "ALARM:9",
];

/** Recorded error response lines (numeric codes only in v1.1+). */
export const REAL_ERROR_LINES: readonly string[] = [
  "error:1",
  "error:2",
  "error:3",
  "error:8",
  "error:9",
  "error:15",
  "error:16",
  "error:20",
  "error:22",
  "error:33",
];

/** ok / error response pair used by streaming protocols. */
export const REAL_RESPONSE_OK = "ok";

/**
 * Documented real-firmware behavior notes used by smoke + mock-diff docs.
 * These are expectations, not executable mock guarantees.
 */
export const REAL_BEHAVIOR_NOTES = {
  alarmLockError: "error:9",
  softLimitGcode: "ALARM:2 (when $20 soft limits enabled)",
  softLimitJog: "error:15 (jog ignored; does not enter Alarm)",
  feedHoldJog:
    "Feed hold (!) during Jog cancels the jog and returns to Idle (does not stay in Hold)",
  feedHoldIdle:
    "Feed hold (!) while Idle is accepted (enters Hold); otherwise ignored outside Idle/Run/Jog",
  softResetIdle:
    "Soft-reset (0x18) while Idle retains machine position; welcome banner + optional MSG",
  softResetMotion: "Soft-reset while in motion raises ALARM:3 (position may be lost)",
  unlock: "$X → [MSG:Caution: Unlocked] then ok",
  statusQuery: "? is real-time; reply is a single <…> status line (no ok)",
  probeAlarm4: "ALARM:4 = probe not in expected initial state",
  probeAlarm5: "ALARM:5 = probe did not contact within programmed travel",
} as const;

/** Mock-only commands that must never be sent to a real Demon Shield. */
export const MOCK_ONLY_COMMANDS = [
  "$Alarm",
  "$Alarm1",
  "$Alarm2",
  "$Alarm4",
  "$ExtHold",
  "$ExtResume",
  "$ExtAbort",
] as const;
