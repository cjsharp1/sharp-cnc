# Spec: Calibration wizard — complete steps 1–5 (with Z focus)

**For:** Cursor (implementation)
**App:** SharpCNC (Tauri + React, `src/`), one machine only (Demon Shield + GRBL 1.1h)
**Status:** PR 0, PR 1, and PR 2 done on branch `fix/virtual-cnc-readiness` (except the X/Y check, which waits on hardware). PRs 3, 4, 5 ready to build.

| PR | Status |
|---|---|
| 0 — Z envelope | **Done.** Z range `[−$132, 0]`, clamp never reverses, Z Use MPos positive, travel input errors, smoke `smoke-safety-fixes.mts`. **Still open:** X/Y sign follow-up if hardware check HW-02a / HW-07a shows negative X/Y (see the review's Remaining work #2). |
| 1 — Backup / undo | **Done.** Auto-backup on first Calibrate `$$` load (`sharpcnc.settingsBackup.v1`, last 5); meta-bar **Back up settings**; Advanced restore with changed-only diff; session Undo next to result. Smoke: `smoke-calibration.mts`. |
| 2 — Direction + steps | **Done.** Expected-direction wording + Yes/No (No ticks Invert); Z row first + retract warning; `$3`↔`$23` note when `$22=1`; Z steps/mm down 10/20/25; ±20% Write warning; re-test ±0.1 mm; starting-value helper. Smoke: `smoke-calibration.mts`. |
| 3 — Speed & accel | **Done.** Wizard step + `smoke-rates-test.mts`. |
| 4 — Homing setup | **Done** on branch (this PR). Wizard step + `smoke-homing-setup.mts`. Limit pin parse, `$ExtLimit*`, `$H`→`error:5` when `$22=0`. |
| 5 — Soft travel polish | Partly done: the jog pad is now on this step. Rest open |

Calibrate step 1 is now **Start** (was "Zero context"); use that name below. Steps are `Start → Direction → Steps/mm → Soft travel` today, and become `Start → Direction → Steps/mm → Speed & accel → Homing → Soft travel` after PRs 3–4.

## Goal

The guided Calibrate wizard (`src/components/CalibrationPanel.tsx`) should cover all five core GRBL calibration steps, in plain language, with the Z axis treated carefully. Today it covers direction, steps/mm, and soft travel. It's missing **max rates/acceleration** and **homing setup**, and it has a **Z soft-limit bug** that must be fixed first.

Every new screen must feel like the existing wizard: same `cal__*` styles, same step-confirm gate (`wizardStepGate.tsx`), same theme tokens, same "Write $n=…" button pattern.

## Ground rules (all PRs)

- **Plain language first, GRBL code second.** Lead with "How fast Z can move", then show `$112` as small secondary text. Existing copy that leads with the setting number can stay; new copy follows this rule.
- **Show old → new before every write.** Pattern: `Before: 500 → After: 375 mm/min` and then a `Write $112=375` button. Nothing is written without a click. The steps/mm result block already does this; reuse it.
- **Undo for every write made in this wizard** (see PR 1).
- **Real GRBL beats the mock.** Read `docs/mock-vs-real-grbl.md` first. Match real GRBL 1.1h behavior and error codes. If you add mock behavior, add a row to that doc and a case to `scripts/smoke-real-grbl.mts` where it applies.
- **Tests:** each PR adds or extends a `scripts/smoke-*.mts` and wires it into `smoke:critical` when it touches motion, settings writes, or limits. `npm run smoke:critical` must pass.
- **Docs, screenshots, and diagrams ship with the code.** Every PR that changes what the operator sees also updates the docs in the same PR. A PR isn't done until these match the new UI (see "Docs, screenshots, and diagrams" below for the per-PR list).
  - **User guide:** `docs/user-guide/05-calibration.md` (step table, quick reference, safety notes), plus any other chapter that mentions the changed behavior (e.g. `04-jogging-and-zeros.md` for Z soft limits and homing, `11-safety.md`, `12-hardware-soak.md`, `README.md` table of contents).
  - **Visual guide:** `docs/setup-visual/calibration.html` (one section per wizard step, in the new order) and any other `docs/setup-visual/*.html` page that references calibration or homing (`first-run.html`, `index.html` overview).
  - **Screenshots:** regenerate the wizard screenshots with `scripts/capture-guide-screenshots.mts` against Virtual CNC. Update the existing `cal-step*.png` files and add new ones for every new step or sub-screen (e.g. `cal-step-rates.png`, `cal-step-homing-switches.png`, `cal-step-homing-first-home.png`). Extend the capture script so new screenshots are reproducible, not hand-taken.
  - **Diagrams:** update the SVGs that describe calibration and add new ones where a picture explains it better than text. Use the existing steel + brass theme and the style of the current diagrams. Existing ones to revise: `docs/user-guide/assets/diagram-calibration-flow.svg`, `diagram-soft-limits.svg`, `diagram-axis-direction.svg`, `docs/setup-visual/assets/cal-0*.svg`, `order-of-ops.svg`, `overview-flow.svg`.
  - Keep the GitHub Pages copy in sync (`docs/guide.html` / `docs/index.html` if they list the steps).
- **Never send mock-only commands** (`$Alarm`, `$Ext*`, any new ones) to a real port.

---

## PR 0 — Fix the Z soft-limit envelope — DONE (kept for reference)

### Problem

The app treats every axis's soft range as `[min, max]` with `min.z = 0` (`machineConfig.ts` `DEFAULT_SOFT_TRAVEL`, `minForAxis`). But Z homes to the **top** of travel, so after homing Z sits at 0 and every useful Z position is **negative**. The Virtual CNC already models this correctly (`mockSerial.ts` `violatesSoftLimits`: Z ∈ [−$132, 0]). The app-side checks don't.

Verified by calling `clampJogDelta` directly:

| Situation | Expected | Actual |
|---|---|---|
| MPos Z = 0 (just homed), jog Z −5 | Moves down 5 | Blocked: "Z soft min (0 mm)" |
| MPos Z = −10, jog Z −5 | Moves down 5 | **Sends Z +10 (moves up, wrong direction)** |
| MPos Z = −10, `checkSoftLimits` Z +5 | Allowed | Refused: "below soft min" |
| Soft travel step, Z "Use MPos" at the bottom | Fills 80 | Fills −80, then **Write silently does nothing** (`parseTravel` rejects ≤ 0, `onClick` returns with no message) |

Also, `clampJogDelta` can produce a delta with the **opposite sign** to what the operator asked for whenever the start position is already outside `[min, max]`. That must never happen on any axis.

### Fix

1. Give Z a negative envelope: allowed machine Z = `[−$132, 0]` when `$132` is known; when unknown, Z is unblocked downward and still blocked above 0. Do this in one place (`minForAxis` / `maxForAxis` or a new `softRangeForAxis(limits, axis) → { min, max }`). Keep `$132` stored as a **positive** number, since that's how GRBL takes it.
2. In `clampJogDelta`, if clamping would reverse the sign of an axis's delta, drop that axis instead and set the reason (e.g. "Z already outside soft travel — home first").
3. Soft travel step: Z "Use MPos" fills `Math.abs(mpos.z)`. Any invalid travel field shows an inline error instead of silently returning.
4. Calibration test moves (`onCalibrateMove` in `App.tsx`) and the Steps/mm step: from a homed Z (at the top), a **+Z** test move will hit the top. For Z, the steps/mm move goes **down** (−Z) by default. See PR 2.
5. Check the other consumers of `minForAxis` / `maxForAxis` (`bedTravelTest.ts`, `stockPerimeterTest.ts`, `workZero.ts`, `safety.ts`) still behave correctly with a negative Z range.

### Verify on the real machine before merging (Chris)

The mock assumes X/Y machine coordinates are **positive** after homing ([0, $130]). Stock GRBL 1.1 puts **all** homed axes in negative space unless the firmware was compiled with `HOMING_FORCE_SET_ORIGIN`. Before trusting PR 0:

- Home on the Demon Shield, then jog X/Y toward the far side and note whether MPos X/Y read **positive or negative**.
- Note MPos Z right after homing (stock GRBL shows about `−$27`, e.g. `−1.000`, not exactly 0).

If X/Y come out negative on the real machine, the X/Y envelope has the same class of bug, and the fix should derive each axis's range from `$23` and the observed sign rather than hard-coding it. Record the result in `docs/mock-vs-real-grbl.md`.

### Tests

New `scripts/smoke-soft-envelope-z.mts` (add to `smoke:critical`) covering the four rows in the table above, plus "a clamp never reverses the sign of a delta" on X, Y, and Z.

---

## PR 1 — Settings backup, restore, and undo

There's currently no way to save or restore the full `$$` dump.

1. **Auto-backup on entering Calibrate:** the first time the wizard loads settings in a session, store a snapshot (`sharpcnc.settingsBackup.v1`: timestamp + full map). Keep the last 5.
2. **Download backup:** a link in the wizard's meta bar ("Back up settings") saves a `.txt` of `$n=value` lines. Use the desktop save dialog in Tauri, a browser download in mock mode.
3. **Restore:** in Menu → Advanced…, list saved snapshots. Show a diff of only the changed settings (old → new), then write them one at a time via `writeGrblSettings`, then re-read `$$` to confirm.
4. **Undo last write:** every successful write from the Calibrate wizard pushes `{ id, before, after }` onto a session stack. Show "Undo $112 (375 → 500)" next to the result message. Undo is itself a normal write and is logged to the activity log.

Tests: extend `smoke-calibration.mts` (snapshot round-trip, diff, undo).

---

## PR 2 — Polish steps 1 & 2 (direction + steps/mm)

### Direction (`$3`)

Already works. Add:
- Show the **expected** direction next to each test button in plain words: "+X → right", "+Y → away from you", "+Z → **up** (tool lifts off the work)".
- After a test move, ask "Did it go the expected way?" **Yes / No**. "No" auto-ticks Invert for that axis (operator still clicks Write).
- Put the Z row **first**, with one line of extra copy: "If +Z goes down, every 'safe' retract would drive the tool into the work. Fix this before anything else."
- If `$3` changes and `$22=1` (homing on), show a note: "Changing direction can also flip which way homing goes. Check the Homing step."

### Steps/mm (`$100`–`$102`)

Already works. Add:
- **Per-axis distance options.** X/Y keep 50/100/200. Z uses **10/20/25 mm**, default 20, and moves **down** (−Z). Label the button "Move Z down 20 mm". Fix `computeStepsPerMm` calls so a negative commanded move is measured as a positive distance.
- **Sanity guard:** if the computed change is more than ±20%, show a warning before the Write button: "That's a big change. Usually this means a microstepping or screw setting is wrong, not a measuring error." Still allow the write.
- **Measure tip for Z:** "Use calipers or a dial indicator against the spindle body. A small Z error makes every cut the wrong depth."
- **Re-test prompt:** after a write, offer "Move again to check". Pass when the measured distance is within ±0.1 mm of commanded (show ✓).
- **Optional helper**, collapsed by default ("Don't know your starting value?"): motor steps/rev (default 200) × microsteps (1–32) ÷ mm per rev (lead screw lead, or pulley teeth × belt pitch). Show it next to the current value.

---

## PR 3 — New step: Max speed & acceleration (`$110`–`$112`, `$120`–`$122`)

Insert after Steps/mm. New wizard order:

```
Start → Direction → Steps/mm → Speed & accel → Homing → Soft travel
```

(Update `CALIBRATION_GUIDED_STEPS`, `STEP_CHROME`, and `STEP_CONFIRM_LABELS`.)

### Explain (top of step)

> "GRBL can't tell when a motor skips a step. So we move an axis fast, back and forth, and check it comes back to exactly where it started. Then we back off a bit for safety."

### Flow (per axis; Z on its own tab, done last)

1. Axis tabs X / Y / Z. Show the current max rate and acceleration in plain words.
2. **Set up a reference:** "Put a dial indicator or a pencil mark at the carriage. Click Ready." The operator also confirms test distance (default: X/Y 50 mm, Z 15 mm). It must fit inside soft travel (use the PR 0 range helpers).
3. **Run test:** N cycles (default 10; Z 20) out and back at the trial rate. Send as a single queued G1 sequence at the trial feed (not `$J=`, so the planner uses full accel), then poll until Idle. STOP / E-Stop stays live.
4. **Ask:** "Did it come back to the mark?" **Yes, same spot** / **It's off** / **It stalled or made a grinding noise**.
5. **Ramp:** on Yes, offer the next trial at +20%. On failure, stop ramping.
6. **Recommend:** last passing value × 0.75, adjustable 0.7–0.8 with a slider. Show old → new and write.
7. Repeat the same pattern for acceleration.

Rate changes must actually take effect for the test. GRBL limits feed to `$11x`, so the trial rate has to be **written temporarily** before each trial. Record the original values and restore them if the operator leaves the step without accepting a result (and on disconnect or E-Stop, restore at next connect — persist the "pending restore" in localStorage).

### Z callout (show on the Z tab)

> "Z lifts the spindle against gravity, so lower numbers than X/Y are normal. Z usually skips going **up**. If it loses steps on the way up, SharpCNC thinks the tool is higher than it really is, so every plunge after that goes deeper than planned, and it gets worse through the job."

On the Z tab, the out-and-back starts with a **down** move from the current position, and the Yes/No question specifically mentions checking after the final **up** move.

### Guardrails

- Refuse to start if the test distance would leave soft travel. Refuse if the state isn't Idle.
- Hard ceiling on trial values (configurable constants; start at 2× the current value) so a runaway ramp can't happen.
- Log every trial and result to the activity log.

Tests: `scripts/smoke-rates-test.mts` (trial-write, restore-on-cancel, pending-restore-after-disconnect, ceiling, Z down-first ordering). The mock doesn't need to simulate skipped steps.

---

## PR 4 — New step: Homing setup (`$22`, `$23`, `$24`, `$25`, `$27`, `$5`)

Today homing is only a `$H` button. This step sets homing up properly. This machine has switches on the **zero side only** (see `docs/user-guide/04-jogging-and-zeros.md`).

### Part A — Check the switches (no motion)

1. Extend `GrblActivePins` (`types.ts`) and `parseStatus.ts` with `limitX`, `limitY`, `limitZ` from the `X`/`Y`/`Z` letters in `Pn:`.
2. Show three switch "lights". Copy: "Press each limit switch by hand. Its light should come on."
3. Each axis gets ✓ once it's been seen on and then off.
4. If a light is **on with nothing pressed**, show: "This switch reads backwards." Offer to flip that axis in `$5` (limit pins invert) with old → new.
5. Can't continue until all three are ✓.
6. Mock: add mock-only `$ExtLimitX` / `$ExtLimitY` / `$ExtLimitZ` toggles (same pattern as `$ExtHold`) plus a dev-only button in `SimControls`.

### Part B — Homing direction (`$23`)

- Show a top-down bed diagram. The operator clicks the corner where the X/Y switches are. Z: confirm "Z switch is at the **top**" (only option offered; anything else shows "Not supported on this machine").
- Compute `$23` from the answer (X=1, Y=2, Z=4 when homing toward negative). Show old → new and write.
- Copy: "GRBL homes Z first, so the tool lifts clear before X and Y move."

### Part C — Speeds and pull-off

- `$25` homing seek, "how fast it looks for the switch". Default to the current value; suggest ≤ 50% of the slowest axis max rate.
- `$24` homing feed, "how slowly it makes the final touch. Slower = more repeatable." Suggest 25–50 mm/min.
- `$27` pull-off, "how far it backs off after touching. 1–2 mm is typical."
- Write each with old → new.

### Part D — First home

- Enable `$22=1` (old → new).
- Big warning panel: "Keep your hand near E-Stop. If any axis heads the wrong way, hit it." Operator ticks to arm the button.
- Run `$H` via the existing handler. Show the result per axis. Map failures with `alarmGuide.ts` (real codes: ALARM:6 reset during homing, ALARM:8 couldn't clear the switch on pull-off, ALARM:9 couldn't find the switch).
- Show MPos after homing with copy explaining the numbers: "Z now reads about −1 mm. That's the pull-off; the switch trigger point is 0. Every Z position below the top is negative, which is normal."

### Part E — Repeatability (Z first)

- "Home 3 times. After each, check your dial indicator or mark." Record a Yes/No per run.
- If Z drifts: "Try a slower final touch," with a shortcut to lower `$24`.

Tests: `scripts/smoke-homing-setup.mts` (Pn limit parsing, `$5`/`$23` encoding, `$H` with `$22=0` → **error:5** on real GRBL; add that to the mock and to `mock-vs-real-grbl.md` if the mock differs).

---

## PR 5 — Polish step 5 (soft travel)

Already works (after the PR 0 fix). Add:

- **Prerequisite:** if `$22` is 0, show "Soft limits need homing turned on. Finish the Homing step first" with a link back. Real GRBL returns **error:10** on `$20=1` without homing; surface that in plain English if it ever comes back.
- **Z copy:** "Enter Z travel as a positive number (e.g. 80). Because Z homes to the top, GRBL allows Z from 0 down to −80."
- **Verify button:** "Test the limit". Jogs toward the Z bottom limit and expects real GRBL's **error:15** (jog refused, stays Idle). Shows "Soft limits working ✓". Do the same for X/Y max.
- **Hard limits (`$21`), optional:** checkbox with copy: "Extra backstop: stops instantly if a home-side switch is hit mid-job. Can false-trigger on noisy wiring." Default off (matches current behavior).
- **Must-show callout**, not hidden behind a tooltip:

> "Soft limits protect the **machine**, not your **work**. They know how far each axis can travel, but not where your stock or spoilboard is. If your Z zero is set wrong, the machine will still plunge into the spoilboard. Your Z probe in Prepare is what protects the work."

---

## Docs, screenshots, and diagrams (per PR)

| PR | User guide | Visual guide | Screenshots | Diagrams |
|---|---|---|---|---|
| 0 — Z envelope | `04-jogging-and-zeros.md`: explain Z is 0 at the top and negative below; fix any text implying Z soft travel is `[0, max]`. `mock-vs-real-grbl.md`: record the real X/Y sign result. | `calibration.html` soft-travel section: Z copy | Soft travel step with a Z value filled from MPos | `diagram-soft-limits.svg`: show the Z range as 0 at top down to −$132. **New** `diagram-z-machine-coords.svg`: Z home at top, pull-off, negative travel, and work Z0 on the stock |
| 1 — Backup/undo | `05-calibration.md`: backup, restore, undo. Advanced chapter: restore flow | Short "Back up first" callout on `calibration.html` | Meta bar with "Back up settings"; restore diff in Advanced | — |
| 2 — Direction + steps | `05-calibration.md`: expected-direction wording, Z moves down for steps/mm, ±20% warning, re-test | `calibration.html` direction + steps sections | Regenerate `cal-step2-steps.png` and direction step (Z row first) | Revise `diagram-axis-direction.svg` (+Z = up, tool lifts off the work); revise `cal-02-direction.svg`, `cal-03-steps.svg` (Z measured with calipers/indicator) |
| 3 — Speed & accel | New section in `05-calibration.md` with the Z callout | **New** section on `calibration.html` | **New** `cal-step-rates.png` (X tab and Z tab) | **New** `cal-05-rates.svg`: out-and-back test with indicator, "came back to the mark?" |
| 4 — Homing | New section in `05-calibration.md`; update the Homing part of `04-jogging-and-zeros.md` (it currently only covers the `$H` button) | **New** section on `calibration.html`; update `first-run.html` if First-run homes | **New** `cal-step-homing-switches.png`, `cal-step-homing-direction.png`, `cal-step-homing-first-home.png` | **New** `cal-06-homing.svg`: switch lights, corner picker, Z homes first; revise `fr-02-home.svg` if it changes |
| 5 — Soft travel | `05-calibration.md`: prerequisite, verify test, hard limits, "protects the machine, not the work" callout | `calibration.html` travel section | Regenerate `cal-step3-travel.png` (rename to match new step numbering) | Revise `cal-04-travel.svg`, `diagram-calibration-flow.svg`, `order-of-ops.svg`, `overview-flow.svg` for the six-step order |

Rename step-numbered files (e.g. `cal-step3-travel.png`, `cal-04-travel.svg`) to match the new six-step order, and fix every link to them. A broken image on the Pages site counts as a failed PR.

## Returning profiles

Profiles already marked calibrated (`sharpcnc.calibration.v1`) must **not** be forced back through the wizard. Show a one-time, dismissible banner in Calibrate: "New: Speed & accel and Homing setup steps." Store dismissal in localStorage.

## Out of scope

Gantry squaring, spindle tramming, spoilboard surfacing, and test cuts. Also any multi-machine or other-firmware support.

## Definition of done

- PR 0 table rows all behave as "Expected", confirmed by smoke and on the real machine.
- All six wizard steps complete in Virtual CNC with no copy that requires knowing GRBL setting numbers.
- Every settings write in Calibrate has an old → new preview and an Undo.
- A full `$$` backup exists before the first write in a session, and restore works.
- `npm run smoke:critical` passes.
- The user guide, visual guide, and Pages site describe all six steps in the new order, with regenerated screenshots, updated and new diagrams, and no broken image links.
