# Virtual CNC mock vs real GRBL

SharpCNC’s **Virtual CNC** (`src/grbl/mockSerial.ts`) is a convenience simulator for UI and smoke tests. It is **not** bit-identical to GRBL 1.1h on the Demon Shield. Prefer the checks in `scripts/smoke-real-grbl.mts` (recorded official protocol + mock deltas) over trusting the mock alone before a real cut.

Fixtures live in `src/grbl/grblProtocolFixtures.ts` (sourced from [gnea/grbl interface.md](https://github.com/gnea/grbl/blob/master/doc/markdown/interface.md), [commands.md](https://github.com/gnea/grbl/blob/master/doc/markdown/commands.md), and the alarm/error CSVs). Optional future work: drive the same cases through [grbl-sim](https://github.com/grbl/grbl-sim) when a CI binary is available.

## How to run

```bash
npx --yes tsx scripts/smoke-real-grbl.mts
# or (included in critical / full suites):
npm run smoke:critical
```

## Behavior that matches (or is close enough)

| Topic | Real GRBL 1.1 | Virtual CNC |
|-------|---------------|-------------|
| Welcome | `Grbl 1.1h ['$' for help]` | Same form |
| `ok` | Line ack after parsed commands | Same |
| Status `?` | Real-time `<…>` report, no `ok` | Same |
| Soft-limit **G-code** with `$20=1` | `ALARM:2`, position retained | Same |
| Unlock `$X` | `[MSG:Caution: Unlocked]` then `ok` | Same |
| Soft-reset `0x18` | Welcome banner; realtime | Banner emitted |
| Feed hold `!` / resume `~` during **Run** | Enter / leave Hold | Same |
| Alarm push | `ALARM:n` standalone line | Same for codes it raises |

## Intentional / known differences (do not trust mock here)

| Topic | Real GRBL 1.1 | Virtual CNC | Risk if you only test mock |
|-------|---------------|-------------|----------------------------|
| Alarm-lock refusal | `error:9` | `error:Alarm lock` | Parsers that only match `error:N` miss lock |
| Invalid / unsupported g-code | `error:20` (etc. numeric) | `error:Invalid gcode` | Same |
| Soft-limit **jog** (`$J=`) | `error:15`, jog ignored, **stays Idle** | `ALARM:2`, enters Alarm | Unlock UX / job gates differ |
| Soft-reset while **Idle** | **Retains** MPos | **Zeros** MPos/WCO to origin | False “back to zero” after Abort |
| Feed hold during **Jog** | Cancels jog → **Idle** | Stays in **Hold** | Hold/resume UI differs |
| Feed hold while **Idle** | Accepted (Hold) | Ignored | External Hold button sim may differ |
| Force-alarm helpers | N/A | `$Alarm`, `$Alarm2`, `$Alarm5`, … | **Never** send these to USB |
| External button sim | Hardware pins → `Pn:` | `$ExtHold` / `$ExtResume` / `$ExtAbort` / `$ExtProbe` | Mock-only — never send to USB |
| Settings / motion fidelity | Planner, accel, EEPROM quirks | Simplified timers + settings map | Timing/streamer edge cases |

## Probe alarms 4/5

App, mock, and user guide now use the **official** GRBL 1.1 meanings: **ALARM:4** = probe not in the expected initial state (already touching, or `$6` inverted); **ALARM:5** = no contact within the seek distance. Confirm on the Demon Shield during the first real connection (see [first real connection](user-guide/14-first-real-connection.md)).

## Critical controls checklist (covered by smoke-real-grbl)

- [x] Alarms (`ALARM:n` parse + mock raise)
- [x] Errors (`error:N` catalog + mock human-string delta)
- [x] `ok` / error streaming responses
- [x] Status reports (`?`)
- [x] Soft limits (G-code vs jog delta)
- [x] Feed hold (`!`)
- [x] Soft-reset (`0x18`)
- [x] Unlock (`$X`)
