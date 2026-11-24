# Hardware checklist (running list)

Things that **can only be checked on the real machine**: the Virtual CNC can't prove them. Work through them with the [First real connection](user-guide/14-first-real-connection.md) guide (step IDs match), then keep this file as the running record.

**How to use it**
- Fill in **Result** with what you actually saw (numbers, not just ✓).
- Status: `todo` → `pass` / `fail` / `n/a`. A `fail` also gets a line under **Open issues**.
- When the app changes something that needs re-checking on hardware, add a row here (with the PR or commit) instead of keeping it in your head.

## Summary

| | |
|---|---|
| Date of first connection | |
| SharpCNC version | |
| GRBL version (`$I` VER) | |
| Build options (`$I` OPT) | |
| Original settings saved at | |
| Calibrated settings saved at | |
| Ready for Stage 3 (job, no tool)? | |

---

## Day one (First real connection)

| ID | Check | Why it matters | Result | Status |
|---|---|---|---|---|
| HW-01 | Connects at 115200 and stays Linked ≥ 1 min; welcome line seen | Basic link; Arduino resets on port open | | todo |
| HW-02 | `$$` saved; `$I` recorded; key settings table filled | Rollback point; `$13` must be 0 | | todo |
| HW-02a | `[OPT:…]` contains `Z` (homing force origin)? | **App assumes X/Y read positive after homing.** No `Z` → X/Y negative → X/Y soft-limit code must change before trusting soft limits | | todo |
| HW-03 | E-Stop latch at rest: banner, jog disabled, Clear works | New latch logic (review R1) | | todo |
| HW-03a | Enclosure Abort / Hold / Resume light the right **Inputs** pin and do the right thing | Hardware button mapping | | todo |
| HW-04 | +X right, +Y away, **+Z up**; final `$3` | Wrong Z direction turns retracts into plunges | | todo |
| HW-05 | Hold during a jog → jog cancelled, **Idle** | Real GRBL differs from Virtual CNC (stays Hold) | | todo |
| HW-05a | E-Stop during a jog → stops, latch shows, alarm code noted | Confirms latch + GRBL reset behavior | | todo |
| HW-06 | X/Y/Z limit switch lights only while pressed; final `$5` | Wrong invert = false trips or no homing | | todo |
| HW-07 | `$H`: Z up first, then X/Y to home corner; final `$23` | Homing direction | | todo |
| HW-07a | **MPos right after homing** X / Y / Z | Z ≈ −`$27` expected; X/Y sign answers HW-02a for certain | | todo |
| HW-07b | Home 3×: Z repeats within ~0.05 mm | Z repeatability = cut depth repeatability | | todo |
| HW-08 | Steps/mm X/Y (100 mm) and Z (20 mm **down**) within ±0.1 mm; final `$100`–`$102` | Dimensional accuracy | | todo |
| HW-09 | Soft travel written; Z "Use MPos" gives positive `$132`; jog past limit refused (`error:15` from console, stays Idle) | Z envelope fix (review R2); real GRBL soft-limit jog response | | todo |
| HW-10 | E-Stop mid bed-travel-test: **no further segment sent**; then full clean run | Confirms review R1 fix on real hardware | | todo |
| HW-11 | Probe light on only while touching; `$6`; plate thickness | Continuity / polarity | | todo |
| HW-11a | Probe already touching → **ALARM:4**; no contact → **ALARM:5**; app wording matches | Alarm 4/5 meanings fixed to official GRBL (review R9) | | todo |
| HW-11b | Full 30 mm seek at 80 mm/min never reports "timed out" early | Probe timeout fix (review R4) | | todo |
| HW-12 | Dry run stays ≥ 5 mm above Z0 the whole path (watch Z gauge) | Dry run now lifts Z | | todo |
| HW-12a | Start-at-line: retract → move over → plunge, in the air; log shows resume setup | Resume preamble (review R3) | | todo |
| HW-12b | Hold / Resume / Stop during a dry run | Streaming controls | | todo |
| HW-13 | Spindle on/off and override; `$30`/`$31` sensible | PWM range | | todo |
| HW-13a | E-Stop stops the spindle | Reset turns spindle off | | todo |
| HW-13b | Hold leaves the spindle **running** (expected on stock GRBL) | Hold is a pause, not a stop | | todo |
| HW-14 | Calibrated `$$` saved | Second rollback point | | todo |

## Later sessions

| ID | Check | Why it matters | Result | Status |
|---|---|---|---|---|
| HW-20 | Physical power cutoff kills steppers and spindle; tested | Software E-Stop can't help if USB/app fails | | todo |
| HW-21 | Unplug USB while idle → app shows offline, no crash; reconnect works | Serial robustness | | todo |
| HW-22 | PC sleep / screen lock disabled on the shop PC while connected | A sleeping PC stops the stream mid-job | | todo |
| HW-23 | Job whose clearance height is above Z home is **refused before Start** with the Z message | Pre-flight Z check (review R8) | | todo |
| HW-24 | A G-code `error:N` mid-job (e.g. an unsupported word in a test file, dry run) → job halts, motion held, message names the line; **Stop** turns spindle off | Stream error handling (review R6) | | todo |
| HW-25 | Mid-job alarm (e.g. soft limit in a test file, dry run) → job ends cleanly, alarm explained, no hang | Stream alarm handling (review R5) | | todo |
| HW-26 | Recovery checkpoint after Stop → resume line is a little **before** where it stopped | Checkpoint backoff (review R3) | | todo |
| HW-27 | **Tool change (M6)** in a dry-run test file: what does the machine do? Spindle state? | **Not fixed yet**: app doesn't stop the spindle or prompt a re-probe at M6. Avoid M6 in real jobs until it is | | todo |
| HW-28 | Z max rate / acceleration: 20 fast up/down Z cycles return to the same dial reading | Z skipping makes cuts progressively deeper | | todo |
| HW-29 | Hard limits (`$21=1`) don't false-trip with steppers and spindle running | Only if you turn hard limits on | | todo |
| HW-30 | Gamepad jog (if used) respects soft limits and stops on release | Continuous jog path | | todo |
| HW-31 | 100×100 mm sample cut on scrap measures 100 ± 0.2 mm in X and Y | End-to-end accuracy | | todo |

## Open issues

Add one line per failure or surprise: date, ID, what you saw, what you changed.

- 
