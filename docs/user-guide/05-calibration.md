# 5. Calibration (Phase 1)

**When:** once per machine, or after wiring / screws / travel change. **Before** trusting Prepare or cuts. Not a per-job step.

**After done:** next sessions skip Calibrate and open on **Prepare**. Re-enter anytime from the phase switcher or Menu → Calibrate….

**Prefer pictures:** [Calibration visual guide](../setup-visual/calibration.html) (start · `$3` · steps/mm · soft travel · bed test).

**First time on the real machine?** Follow [First real connection](14-first-real-connection.md) — it walks through these steps in a safe order and says what to record.

Phase switcher → **Calibrate** (also from First-run). Connect first.

| # | Step | Action |
|---|------|--------|
| 1 | Start | Clear the bed → **Home ($H)** once per power-on (if homing is set up) → confirm → **Next**. Material zero here is optional. |
| 2 | Direction | **Z first** (expected: +Z up / tool lifts) → Test ±5 mm → **Yes / No** (No ticks Invert) → same for X/Y → **Write $3** |
| 3 | Steps/mm | Move a known distance (X/Y: 50–200 mm; **Z: 10/20/25 mm down**) → measure → if change &gt; ±20% read the warning → **Write** → **Move again to check** (±0.1 mm) |
| 4 | Soft travel | Use the jog pad on this step to reach the far end of each axis (Z: the lowest safe point) → **Use MPos** → **Write travel + $20** → **Continue to Prepare** |

Raw `$$` / `$x=value` edits live under **Menu → Advanced…** (not a Calibrate step). Homing and **Bed travel test…** are recommended, not required to mark calibrated.

Finishing Soft travel (all four steps confirmed) — or explicitly confirming “Machine already calibrated” on a returning profile — marks the machine calibrated and offers **Continue to Prepare**. Optional **Bed travel test…** (or Menu → Bed travel test…) walks all XY soft-limit corners after travel is written.

> **Safety:** Clear bed. Keep Z high for XY. E-Stop ready. Prefer Virtual CNC for the first pass.

## Backup, restore, and undo

Calibrate never writes without a click, and every write can be undone in the same session.

1. **Auto-backup** — the first time Calibrate loads settings after you connect, SharpCNC stores a full `$$` snapshot (`sharpcnc.settingsBackup.v1`, last 5 kept). You do not have to remember to save before the first write.
2. **Back up settings** — in the wizard meta bar (next to **Reload**), download a `.txt` of `$n=value` lines. Desktop uses the save dialog; Virtual CNC / browser downloads the file.
3. **Undo** — after a successful write, the result line shows **Undo $n (new → old)**. That writes the previous value back and logs to the activity log. The undo stack is session-only (cleared on disconnect).
4. **Restore** — **Menu → Advanced… → Restore settings** lists saved snapshots, shows only settings that differ from the live controller (live → backup), then writes those one at a time and re-reads `$$` to confirm.

Screenshots: [meta bar with Back up settings](assets/cal-step1-zero.png) · [restore diff in Advanced](assets/cal-restore-diff.png)

## Direction (step 2)

Start with **Z**. Expected wording next to each test: **+X → right**, **+Y → away from you**, **+Z → up (tool lifts off the work)**. After each Test ± jog, answer **Did it go the expected way? Yes / No**. **No** auto-ticks Invert for that axis — you still click **Write $3**.

If +Z goes down, every “safe” retract would drive the tool into the work. Fix Z before anything else.

When homing is on (`$22=1`) and you change `$3`, the wizard notes that homing direction (`$23`) can flip too — check Homing after you write.

## Steps/mm (step 3)

- X/Y distances: 50 / 100 / 200 mm. **Z:** 10 / 20 / 25 mm, default 20, button **Move Z down …** (Z homes to the top).
- Measure tip for Z: calipers or a dial indicator against the spindle body.
- Formula: `new = old × |commanded| ÷ |measured|` (negative Z moves still use positive distance).
- **±20% warning** before Write if the new value jumps that much — usually microstepping or screw pitch is wrong, not a measuring slip. Write is still allowed.
- After Write: **Move again to check**. Pass when measured is within **±0.1 mm** of commanded (✓).
- Optional helper (collapsed): motor steps/rev × microsteps ÷ mm per rev for a starting estimate.

## Quick reference

- `$3` bits: X=1, Y=2, Z=4 (sum to invert). Expect +X right, +Y away (up on the visualizer), +Z up (tool lifts).
- Steps formula: `new = old × commanded ÷ measured`.
- Soft travel: `$130`–`$132` + `$20=1`. Far rails are software on this machine.
- **Z is negative below home.** Z homes to the top, so with `$132=80` the allowed range is 0 down to −80. Enter `$132` as a positive travel length; **Use MPos** on Z converts it for you.
- Invalid travel values (zero, negative, text) show an error under **Write travel + $20** instead of silently doing nothing.
- Back up / restore / Undo — see above; Advanced restore is for bringing an earlier snapshot back after many changes.

## Verify with a cut-size sample

After steps/mm look close, cut a known size and measure:

1. Prepare → Load → SVG → **Samples → 100×100 mm** (true millimeter SVG).  
2. Generate a shallow engrave/outline → finish Prepare → Verify → cut on scrap.  
3. Measure X and Y. Adjust steps/mm with the formula above if needed, then re-check.

Also available: **50×50 mm** square and **100 mm line**. Details: [Jobs & SVG — cut-size samples](08-jobs-and-svg.md#cut-size-samples).

Screenshots (wizard UI): [step 1](assets/cal-step1-zero.png) · [direction](assets/cal-step-direction.png) · [steps](assets/cal-step2-steps.png) · [travel](assets/cal-step3-travel.png)

Next (every job): [Prepare & Z probe](07-prepare-and-z-probe.md) · [Prepare visual](../setup-visual/prepare.html)
