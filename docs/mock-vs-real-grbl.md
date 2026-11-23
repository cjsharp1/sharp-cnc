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
| Probe **ALARM:4** | Probe **not** in expected initial state | App/mock treat **4 = no contact** | Wrong operator guidance |
| Probe **ALARM:5** | **No contact** within seek | App/mock treat **5 = early contact** | Same (4/5 swapped vs firmware) |
| Soft-reset while **Idle** | **Retains** MPos | **Zeros** MPos/WCO to origin | False “back to zero” after Abort |
| Feed hold during **Jog** | Cancels jog → **Idle** | Stays in **Hold** | Hold/resume UI differs |
| Feed hold while **Idle** | Accepted (Hold) | Ignored | External Hold button sim may differ |
| Force-alarm helpers | N/A | `$Alarm`, `$Alarm2`, `$Alarm4`, … | **Never** send these to USB |
| External button sim | Hardware pins → `Pn:` | `$ExtHold` / `$ExtResume` / `$ExtAbort` | Mock-only |
| Settings / motion fidelity | Planner, accel, EEPROM quirks | Simplified timers + settings map | Timing/streamer edge cases |

## App copy note (probe 4/5)

`src/grbl/safety.ts`, `alarmGuide.ts`, and parts of the user guide follow the **mock polarity** (4 = no contact, 5 = early). Official GRBL CSVs are the opposite. Until those strings are aligned to firmware, treat probe alarm numbers on a real machine using the **official** table in `grblProtocolFixtures.ts`.

## Critical controls checklist (covered by smoke-real-grbl)

- [x] Alarms (`ALARM:n` parse + mock raise)
- [x] Errors (`error:N` catalog + mock human-string delta)
- [x] `ok` / error streaming responses
- [x] Status reports (`?`)
- [x] Soft limits (G-code vs jog delta)
- [x] Feed hold (`!`)
- [x] Soft-reset (`0x18`)
- [x] Unlock (`$X`)
