# SharpCNC review — November 2026 (v0.6.2)

**For:** Cursor (triage and implementation)
**Scope:** whole app: safety-critical code paths, UI/UX walkthrough in Virtual CNC, tests, docs
**Method:** read the code, ran `tsc` and every smoke script individually, and walked the UI in headless Chrome at 1400×900, 1920×1080 and 1366×768. Every finding below was checked against the code or reproduced; file and line references are as of commit `87b19ff` on `main`.

Related spec: [`calibration-steps-1-5.md`](calibration-steps-1-5.md). It covers calibration work, including the Z soft-limit bug (R2 below), so those items aren't repeated in full here.

## Status (updated after branch `fix/virtual-cnc-readiness`)

Most of this review was fixed and verified against the Virtual CNC on branch `fix/virtual-cnc-readiness`. **Cursor: work only the items marked OPEN** (collected under [Remaining work](#remaining-work-for-cursor) at the end). FIXED items are kept below for context; don't redo them.

| ID | Item | Status |
|---|---|---|
| R1 | E-Stop doesn't stop test loops | **FIXED** — latch + shared abort; feed hold first. Hardware check HW-10 |
| R2 | Z soft envelope inverted | **FIXED** for Z. X/Y sign **OPEN pending hardware** (HW-02a / HW-07a) |
| R3 | Start-at-line skips modal state; checkpoint skips lines | **FIXED** — resume preamble + 20-line backoff |
| R4 | Probe timeout too short | **FIXED** — derived timeout; hold + reset on timeout. Continuity check: **FIXED** (Prepare → Z probe gates Run Z probe on `status.pins.probe`) |
| R5 | Mid-job alarm hang / lost code | **FIXED** |
| R6 | `error:N` leaves spindle running | **FIXED** (feed hold + message). A "Skip line and continue" option: **OPEN, optional** |
| R7 | Tool change doesn't make spindle safe | **FIXED** (this PR) |
| R8 | Pre-flight ignores Z / arcs / G53 | **FIXED** for bounds and checks. Drawing arcs as arcs in the visualizer: **OPEN, optional** |
| R9 | Probe ALARM 4/5 swapped | **FIXED** in app, mock, docs |
| T1 | Full suite can't pass | **FIXED** — timed runner; critical includes E-Stop loop-abort Playwright smoke |
| T2 | Strict GRBL mock mode | **FIXED** |
| M1 | Jog pad in Calibrate | **FIXED** (Soft travel step) |
| M2 | Z side view | **FIXED** (Z gauge) |
| M3 | Settings backup / restore | **FIXED** (calibration spec PR 1) |
| M4 | Keyboard shortcuts for Hold / E-Stop | **FIXED** — Space = Hold (not in fields/buttons); Escape stays dialog-close |
| M5, M6 | Homing setup, speed & accel steps | **OPEN** (calibration spec PR 3, PR 4) |
| O1 | Overlapping setup wizards | **FIXED** — First-run is Connect → Home → Calibrate |
| O2 | "Zero context" step | **FIXED** — renamed **Start**, copy refocused on homing |
| O3 | Home story inconsistent | **FIXED** (copy). "Not homed" header chip: **OPEN, optional** |
| O4 | Duplicate controls | **FIXED** — one Connect after link (header); Reset on Safety only; Material/Machine tables removed from Calibrate Start + Prepare |
| O5 | Practice faults in the Safety strip | **FIXED** — labeled "Virtual CNC only · practice" |
| C1 | Back/Next below the fold | **FIXED** — pinned footer, verified at 1366×768 |
| C2 | Silent failures | **FIXED** — Soft travel + Prepare / Verify / Advanced / bed travel / stock perimeter show why when disabled or refused |
| C3 | Jargon in primary copy | **FIXED** — primary buttons/step titles lead with plain words; GRBL codes secondary |
| C4 | Raw GRBL text in errors | **FIXED** for job errors/alarms |
| D1 | Software E-Stop callout | **FIXED** |
| D2 | UI chapter outdated | **FIXED** |
| D3 | Docs for behavior changes | **FIXED** (text). Screenshots regenerated. New diagrams/screenshots: **OPEN** (see Remaining work) |
| D4 | mock-vs-real rows | **PARTLY** — probe row updated; X/Y sign row after hardware check |

Also added on the branch (not in the original review): **dry run lifts Z** so it's actually an air cut (it used to only turn the spindle off), a live **Inputs** row (limit switches, probe, buttons) under Position, Z steps/mm test moving **down**, and the [First real connection](../user-guide/14-first-real-connection.md) guide + [hardware checklist](../hardware-checklist.md).

## How to use this doc

Work top to bottom. **Section 1 items are safety bugs; fix them before the next real cut.** Each item has: what's wrong, how it was confirmed, and a suggested fix. Every fix ships with a smoke test and with any user-guide, visual-guide, screenshot, or diagram changes its UI changes require (same rule as the calibration spec).

---

## 1. Safety bugs (fix first)

### R1. E-Stop doesn't stop the bed travel test or stock perimeter trace

**What's wrong:** `handleSoftReset` sets `bedTravelAbortRef` and `stockPerimeterAbortRef`. `handleEstop` (`src/App.tsx` ~1258) sets neither. Both test loops only stop when those flags are set or when GRBL is in Alarm.

On real GRBL 1.1, the E-Stop sequence (`!` then `0x18`) during a `$J=` jog works like this: feed hold **cancels the jog and returns to Idle**, then the soft reset at Idle **doesn't raise an alarm**. So the loop sees Idle, no abort flag and no alarm, and **sends the next segment. The machine moves again after E-Stop.**

The Virtual CNC hides this because it stays in Hold on a feed hold during a jog (already listed in `docs/mock-vs-real-grbl.md`), so no smoke test catches it.

**Fix:**
- Make one `abortEverything()` used by E-Stop, Reset, Disconnect and external Abort. It stops the streamer, cancels continuous jog, sets every abort flag, clears the homed flag, and resets overrides.
- Add an "E-Stop latched" state that blocks all motion commands (jog, test loops, probe, start) until the operator explicitly clicks "Clear E-Stop".
- Send feed hold **first** in E-Stop. Today it awaits `stopContinuousJog()` (a jog-cancel write) before `feedHold()`.
- Smoke test: drive the bed travel loop against a transport that behaves like real GRBL for hold-during-jog, press E-Stop between segments, and assert no further `$J=` is written.

### R2. Z soft-limit envelope is inverted (reversed Z jogs)

The app treats Z soft travel as `[0, maxZ]`, but Z homes to the top, so useful Z is negative. Verified: from MPos Z −10, a "Z down 5" jog is sent as **Z up 10**, and from home Z can't jog down at all. Full details and the fix are in the calibration spec, PR 0. Also covers the X/Y sign check on real hardware.

### R3. "Start at line N" skips the spindle, units, and modal state

`handleStartJob` sends `job.lines.slice(startAt)` with nothing in front of it (`src/App.tsx` ~2500). Resuming mid-file skips everything that set up the job: `M3 S…` (spindle on), `G21`/`G20`, `G90`/`G91`, `G54`, and the current feed rate.

Typical outcome: the bit plunges into the stock **without spinning**, or moves in the wrong units or relative mode. The job-recovery flow uses the same path (`handleRecoveryResume` just sets the scrub index).

The recovery checkpoint also resumes from the wrong line. It saves `absoluteLine` = the next line to **send** (`lineOffset + sendIndex`). Lines that were sent but still sitting in GRBL's RX buffer, plus lines acked into the planner (an `ok` means "parsed", not "executed"; the planner holds about 15 moves), never ran. Resuming from the send index skips them, so part of the cut is silently missing.

**Fix:**
- Before streaming from line N > 0, scan lines `0..N-1` and build a preamble that restores the last units, distance mode, WCS, plane, feed, spindle state and speed, and coolant.
- Then send a safe-entry sequence: retract Z to the job's clearance height, rapid XY to the line's start point, spindle on and dwell, plunge.
- Show the preamble in the Verify step so the operator sees what will run.
- For recovery, default the resume line to a safe point **before** the last acked line (e.g. the start of the last motion block before it, or a fixed margin back), and let the operator scrub from there with the simulation showing where that is. Re-cutting a little air is better than skipping material.
- Smoke test: a job with `M3 S12000` on line 3, started at line 40, must send `M3 S12000` before line 40.

### R4. Probe timeout is shorter than the probe itself

`runZProbeCycle` times out after 15 s (`src/grbl/probe.ts`, `timeoutMs ?? 15_000`), and `App.tsx` doesn't override it. The default seek is 30 mm at 80 mm/min, which takes **22.5 s**. Any contact after about 20 mm of travel shows "Timed out", **while the machine is still probing**. Nothing sends a hold or reset on timeout, so the operator thinks it stopped when it hasn't. A late contact or an `ALARM` then arrives unexpectedly.

**Fix:**
- Derive the timeout: `seek / feed × 60 s + 5 s`.
- On timeout, send feed hold and soft reset, then say plainly what happened.
- Add a **probe continuity check** before seeking: "Touch the clip to the plate; the probe light should come on" (the `Pn:P` pin is already parsed). **DONE** in Prepare → Z probe (`canRunPrepareZProbe` + Inputs-style Probe light).
- Fix the known probe ALARM 4/5 polarity (R9) in the same PR, since it's the same message path.

### R5. Mid-job alarms hang the job and hide the alarm code

In `src/grbl/streamer.ts`:
- On `ALARM:` the streamer sets `phase = "error"` but **never calls `settleReject`**, so `streamer.start()` never resolves. `handleStartJob` waits forever, and "Job error" is never logged until someone presses Stop. Reproduced: `scripts/smoke-mock-stream.mts` hangs indefinitely for exactly this reason (see T1).
- Every `<Alarm|…>` status report that follows **overwrites `lastError`**, so the UI shows `<Alarm|MPos:10.000,10.000,0.000|FS:0,0>` instead of `ALARM:2` and its explanation.

**Fix:** settle (reject) the promise on `ALARM:`. Keep the first alarm line as `lastError`, and ignore status reports once in the error phase. Map the code through `alarmGuide.ts` in the Run panel.

### R6. On a G-code `error:N`, the spindle keeps running

On `error:` the streamer stops sending, but GRBL keeps executing whatever is already in its 128-byte buffer and then sits Idle with the **spindle still on** and the bit in the material. Nothing tells the operator what state the machine is in.

**Fix:** on stream error, send feed hold, then show a clear choice: "Stop job (reset, spindle off)" or "Skip line and continue" (advanced, off by default). Log the offending line number and text.

### R7. Tool change (M6) doesn't make the spindle safe — FIXED

Was: pause before `M6` with no spindle stop, no Idle wait, no Z re-probe gate.

**Now:** wait for Idle → send `M5` → full-width panel (Spindle stopped ✓ · Change the bit · Re-probe Z · Continue). Continue disabled until Z re-probed or "Same tool length". On Continue, restore `M3 S…` from `scanResumeState` with a dwell. Side-command oks during `tool-change` do not steal job-line acks (`sendDuringToolChange` / `smoke-tool-change`).

### R8. Job pre-flight ignores Z and undercounts arcs

`checkJobSoftLimits` (`src/grbl/safety.ts`) only checks XY corners. `extractToolpath` (`src/grbl/gcode.ts`) doesn't track Z bounds at all.

- **Z above home:** with Z0 touched off near the top of travel, a job's clearance retract (e.g. Z+15) lands above machine Z 0. Real GRBL with `$20=1` stops with **ALARM:2 mid-job**.
- **Z below travel:** cut depth past `−$132` isn't caught before Start.
- **Arcs:** G2/G3 are treated as straight chords, so an arc that bulges past the soft limit passes the check.
- **G53:** machine-coordinate moves (`G53 G0 Z0`, common in Fusion posts) are treated as work coordinates, so the simulation and bounds are wrong for those lines.

**Fix:** track min/max Z in `extractToolpath`. Expand arcs into segments (or compute arc extents) for bounds. Handle G53 as machine coordinates. Check all of X, Y, and Z in machine coordinates against the soft envelope (using the R2 Z range). Show the operator the failing axis and how far over it is ("Retract Z+15 would go 7 mm above Z home. Touch off lower or reduce the clearance height").

### R9. Probe ALARM 4/5 meanings are swapped vs real firmware (known, unfixed)

`docs/mock-vs-real-grbl.md` already says `safety.ts`, `alarmGuide.ts` and parts of the guide use the mock's polarity (4 = no contact, 5 = early contact), which is the reverse of official GRBL. On the real machine, the operator gets the wrong advice. Align the app, the mock, and the docs to the official table in `grblProtocolFixtures.ts`.

---

## 2. Tests and release process

### T1. `npm run smoke` can't pass

`npm run smoke:critical` passes (all critical scripts green; `tsc --noEmit` clean). The full suite, which `docs/RELEASE.md` requires before tagging, can't:

- **`smoke-mock-stream.mts` hangs forever.** Its sample ends with `G0 Z5`, which is above Z home in the mock's [−200, 0] envelope, so the mock raises `ALARM:2`, and then R5 means `start()` never resolves. Fix R5, and change the sample to stay below Z 0 (or turn soft limits off for that test).
- **`smoke-debug-bridge.mts` fails** on `json.schemaVersion === 1`. `activityLog.exportJson` now writes `schemaVersion: 2`. Update the test, and decide whether consumers of the export need a migration note.
- **No per-test timeout.** One hung script blocks the whole suite silently. Wrap each smoke in a runner with a timeout (e.g. 60 s) that prints which script hung.

### T2. The mock can't catch the real-hardware bugs

~~R1, R2 and R9 all slipped through because the Virtual CNC differs from real GRBL in exactly those areas (hold during jog, Z envelope, probe alarm polarity). Add a **"strict GRBL" mode** to `mockSerial.ts` that follows real 1.1h behavior for every row in the "known differences" table, and run the safety smokes against both modes.~~ **FIXED** — `createMockTransport({ strict: true })` / `sharpcnc.mock.strictGrbl.v1`; `smoke-real-grbl` runs default + strict; see `docs/mock-vs-real-grbl.md`.

---

## 3. Missing features

| # | What's missing | Why it matters |
|---|---|---|
| M1 | **Jog pad in Calibrate.** The Soft travel step says "Jog far → Use MPos", but the jog pad only exists in Prepare (`PrepareRunPanel.tsx`). Calibrate has only ±5 mm test buttons, so you can't reach the far end without a gamepad or leaving the step. | Blocks the step it's needed for. |
| M2 | **Z side view.** The visualizer is top-down only. Z shows up only as numbers. | Most crashes are Z mistakes. A slim vertical gauge next to the bed (Z travel 0 → −$132, stock top, Material Z0, tool tip now, job's min/max Z after R8) would make wrong touch-offs obvious. |
| M3 | **Settings backup / restore.** ~~No way to save or restore the full `$$` dump.~~ | **FIXED** — auto-backup on Calibrate, download link, Advanced restore + session Undo (calibration PR 1). |
| M4 | **Keyboard shortcuts for Hold and E-Stop.** The only global key handlers are Escape-to-close. | Common in senders (Space = Hold). Faster than finding the button with sawdust on your hands. Don't use Escape for E-Stop; it already closes dialogs. |
| M5 | **Homing / limit-switch setup.** Covered in calibration spec PR 4. | — |
| M6 | **Speed & acceleration tuning.** Covered in calibration spec PR 3. | — |

---

## 4. Out of place or duplicated

### O1. Two overlapping setup wizards

First-run (Connect → Home → Calibrate → Travel → Stock) and the Calibrate phase (Zero → Direction → Steps → Travel) overlap:
- First-run's "Calibrate" step is just a button that opens the other wizard, then you come back.
- **Soft travel is entered in both**, with different UI and behavior: First-run's inputs reset to a fallback value on bad input; Calibrate's silently refuse to write.
- First-run's "Stock seed" is a Prepare concept appearing in machine setup.

**Suggest:** First-run = Connect → (embedded) Calibrate wizard → done. Delete First-run's own Travel and Stock steps; Prepare already owns stock.

### O2. Calibrate step 1 "Zero context" is a Prepare step

It sets **material** zero (G10 L20), which calibration doesn't use: steps/mm is measured with a ruler, and travel is in machine coordinates. That's confusing in a once-per-machine wizard. Replace it with "Before you start": safety checklist, settings backup (M3), and Home if switches are set up.

### O3. Home appears in four places with four different stories

| Where | Copy |
|---|---|
| First-run step 2 | Required step |
| Calibrate step 1 | "Recommended if you use switches" |
| Calibrate rail subtitle | "Home and bed travel are optional" |
| Prepare step 1 | "Optional — when switches need it" |

Pick one rule and say it everywhere. Suggested: "Home once after every power-on (when homing is enabled). Everything else depends on it." Show a header chip "Not homed" when `$22=1` and the session isn't homed, and keep the button only in that chip plus the Homing step.

### O4. Duplicate controls

- On a fresh launch there are **three Connect buttons** at once (header chip, Connect rail, First-run modal).
- **RESET** is in both the header chip and the Safety strip.
- **E-STOP vs RESET**: E-Stop = hold + reset; Reset = reset only. There's no visible explanation of the difference. Add a one-line tooltip to each, or drop Reset from the Safety strip.
- **Position** is shown in the Position panel and again inside the Calibrate and Prepare panels.

### O5. Virtual-only fault buttons sit in the Safety strip

"Simulate hard limit / soft limit / probe fail" appear under E-Stop in Virtual mode. They're practice tools, but they sit in the most safety-critical spot on the screen. Move them to `SimControls`, or label the row "Virtual CNC only".

---

## 5. Confusing

| # | Issue | Suggested fix |
|---|---|---|
| C1 | **"No scroll" isn't true on common screens.** Prepare step 1's Next button sits at y = 911 px, below the fold at 1400×900 and 1366×768 (a typical shop laptop). The user guide promises "each step fits on one screen". | Pin each wizard's Back/Next footer to the bottom of the rail; let only the body scroll. Add a smoke check at 1366×768 that the primary button is in view. |
| C2 | **Silent failures.** Soft travel Write returns with no message on invalid input (`CalibrationPanel.tsx` ~719–727). | Every disabled or refused action says why, inline. |
| C3 | **Jargon in primary copy.** E.g. "Zero context", "MPos", "WCO", "`$3`", "Write travel + $20" as button text. | Plain words first, codes as secondary text (rule from the calibration spec). The `Material` vs `Machine` naming is good; extend it. |
| C4 | **Error text shows raw GRBL lines** (R5's `<Alarm|MPos…>` is one example). | Always route alarm and error codes through `alarmGuide.ts`. |

---

## 6. Docs

| # | Issue | Fix |
|---|---|---|
| D1 | `11-safety.md` doesn't say that the on-screen **E-STOP is a software command over USB**. It doesn't work if the app hangs, USB drops, or the PC sleeps. | Add a top-of-page callout: keep a physical power cutoff (spindle and steppers) within reach, and test it. |
| D2 | `03-understanding-the-ui.md` describes Calibrate as "Four dense guided steps" and says primary controls never scroll. | Update with the calibration spec work and C1. |
| D3 | Behavior changes from R1–R8 (E-Stop latch, resume preamble, tool-change flow, Z pre-flight) need user-guide sections, updated visual-guide pages, new screenshots, and diagrams (e.g. a tool-change flow, a Z gauge explainer). | Same docs, screenshots and diagrams rule as the calibration spec. Each PR updates its own docs. |
| D4 | `mock-vs-real-grbl.md` should gain rows for the Z envelope (R2) and the X/Y sign check, once verified on hardware. | — |

---

## 7. What's solid (keep)

- **Broad smoke coverage** for a personal tool: 33 scripts, a critical gate in CI, and real-protocol fixtures.
- **An honest mock-vs-real doc.** The table of known differences is exactly the right instinct; it just needs a strict mode (T2).
- **A character-counting streamer** with correct RX-buffer accounting and serialized fills.
- **Soft-limit clamping for continuous and gamepad jogs**, using a pending cursor so bursts can't outrun MPos (once R2 fixes the Z range).
- **Material vs Machine naming** instead of WPos/MPos in the main UI.
- **The phase model** (Connect → Calibrate → Prepare → Verify → Run) is a clear mental model; most of the fixes above are about making each phase consistent with it.

---

## Suggested order

1. R1, R3, R4, R5 + T1 (one safety PR each)
2. R2 (calibration spec PR 0)
3. R6, R7, R8, R9
4. T2 (strict mock), D1
5. Calibration spec PRs 1–5, which also resolve M1, M3, M5, M6, O2 and parts of O3
6. O1, O3, O4, O5, C1–C4, M2, M4


---

## Remaining work for Cursor

Same rules as before: every PR ships with smoke coverage and its user-guide / visual-guide / screenshot / diagram updates. Run `npm run smoke` (timed runner) before opening a PR.

### Safety
1. ~~**R7 Tool change (M6).**~~ **FIXED** — Idle → `M5` → full-width panel (re-probe Z / same tool length) → restore `M3 S…` + dwell; side-command oks do not steal job-line acks (`smoke-tool-change`).
2. **X/Y soft envelope sign (R2 follow-up)** — only if hardware check HW-02a/HW-07a shows X/Y read **negative** after homing. Then derive each axis's range from `$23` and the observed sign in `minForAxis`/`maxForAxis` (`machineConfig.ts`), update `bedTravelTest`, `stockPerimeterTest`, the machine view bed frame, and the mock. If X/Y read positive, just record it in `mock-vs-real-grbl.md`.
3. **Probe continuity step (R4 follow-up).** ~~In Prepare → Z probe, before the Probe button unlocks: "Touch the clip to the plate — the light should come on" using `status.pins.probe`.~~ **DONE** — continuity gate + Probe pin light; Virtual CNC `$ExtProbe` practice.
4. ~~**E-Stop loop abort smoke.**~~ **DONE** — `scripts/smoke-estop-loop-abort.mts` (critical): Virtual CNC bed travel → E-Stop after first `$J=` → no further `$J=` + latch banner. Seeds `sharpcnc.mock.strictGrbl.v1` so hold-during-jog → Idle like real GRBL (the bug class Virtual CNC used to hide).

### Tests
5. ~~**T2 strict GRBL mock mode**~~ **DONE** — `createMockTransport({ strict: true })` / `sharpcnc.mock.strictGrbl.v1` follows real 1.1h for every known-diff row in `mock-vs-real-grbl.md` (`error:9`/`error:20`/`error:15`, Idle soft-reset keeps MPos, hold@jog→Idle, hold@Idle→Hold). `smoke-real-grbl` runs default + strict; E-Stop smoke uses strict.

### Features
6. ~~Calibration spec PR 1 (backup / restore / undo)~~ **DONE**, PR 3 (speed & accel), PR 4 (homing setup), PR 5 (soft travel polish). PR 0, PR 1, and parts of PR 2 are done; see that spec's status table.
7. ~~**M4 keyboard shortcuts:**~~ **DONE** — Space = Hold (ignored in fields/buttons); Escape stays dialog-close; documented in `11-safety.md`.
8. **Optional:** "Not homed" header chip when `$22=1` and the session isn't homed; draw G2/G3 as arcs in the visualizer and simulation; "Skip line and continue" after a stream error.

### UX cleanup
9. ~~**O4:**~~ **DONE** — header Connect only after link; Reset on Safety only; Calibrate Start + Prepare no longer duplicate the Material/Machine table (`smoke-ux-cleanup`).
10. ~~**C2 sweep:**~~ **DONE** — Prepare / Verify / Advanced offsets / bed travel / stock perimeter show why when disabled or refused.
11. ~~**C3 jargon pass:**~~ **DONE** — primary buttons/step titles lead with plain words; GRBL codes secondary.

### Docs, screenshots, diagrams
12. **Screenshots** (regenerate with `CHROME_PATH=… npx tsx scripts/capture-guide-screenshots.mts`, then extend the script for new ones):
    - rename `cal-step1-zero.png` → `cal-step1-start.png` (and fix links)
    - new: E-Stop latch banner, Inputs row with a pin lit, Z gauge with material Z0 and a job range, First-run three steps, Calibrate Soft travel with the jog pad, Verify with dry run + resume note.
13. **Diagrams** (steel + brass style of the existing SVGs):
    - revise `docs/user-guide/assets/diagram-soft-limits.svg` to show Z as 0 at the top down to −`$132`
    - new `diagram-z-machine-coords.svg`: Z home at top, pull-off, negative travel, material Z0 on the stock, the Z gauge
    - new `diagram-dry-run-lift.svg`: original path vs lifted path, 5 mm above Z0
    - new `diagram-resume-preamble.svg`: retract → move over → spin up → plunge → continue
    - revise `docs/setup-visual/assets/cal-01-zero.svg` (rename to `cal-01-start.svg`) for the Start step
    - delete `fr-04-travel.svg` and `fr-05-stock.svg` (First-run no longer has those steps); revise `order-of-ops.svg` and `overview-flow.svg` if they show five First-run steps
