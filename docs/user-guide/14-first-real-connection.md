# 14. First real connection — do this first

**For:** the first time SharpCNC talks to the real Demon Shield / GRBL machine.
**Goal:** prove, in small safe steps, that what the app shows matches what the machine actually does, and record the values the app depends on.
**Time:** about 1–2 hours. Don't rush it, and don't cut anything today.

Each step says **Do**, **Expect**, and **Record**. Write results in the [hardware checklist](../hardware-checklist.md) as you go (each step names its checklist ID). If a step doesn't match **Expect**, stop at that step, record what you saw, and fix it before moving on.

After this guide: [First-test stages](13-first-test-stages.md) from Stage 3 (job with no tool) onward, then the [soak playbook](../demon-shield-soak-playbook.md).

---

## Before you power anything

1. **Run the latest build on the shop PC.** `npm ci` then `npm run tauri dev` (or install the latest release). Confirm the version chip in the header.
2. **Rehearse once on Virtual CNC** (about 10 minutes): connect, press **E-Stop**, read the banner, **Clear E-Stop**, jog Z down a few mm, watch the **Z gauge** move, disconnect.
3. **Physical safety:**
   - Know where the **power cutoff** for the steppers and the spindle is, and put it within arm's reach. The on-screen E-Stop is software over USB, and the enclosure Abort button is a GRBL reset; neither cuts power.
   - **Spindle unplugged or switched off at its own power.** It stays off until step 13.
   - **No bit in the collet.**
   - Bed clear of tools, clamps, and cables.
4. **Move the gantry to the middle by hand** (power off): X and Y mid-travel, Z about halfway down. Nothing knows where it is yet, so every first move should have room in both directions.
5. Have a **tape measure**, **calipers** (or a dial indicator), a **marker**, and the **touch plate + clip** nearby.

---

## 1. Connect and look — no motion `HW-01`

**Do**
1. Power the controller (Arduino / Demon Shield) and the stepper supply.
2. SharpCNC → port list → the Arduino's COM port → **Connect** (115200).
3. Wait 10 seconds. Don't touch any motion buttons.

**Expect**
- Header chip shows **Linked**. Position panel numbers update. State reads **Idle** or **Alarm**.
- **Alarm on connect is normal if homing is enabled** (`$22=1`): GRBL locks until homed. Don't Unlock yet.
- The Arduino resets when the port opens, so you may see the GRBL welcome line again in the activity log. That's expected.

**Record:** COM port, the GRBL welcome line (e.g. `Grbl 1.1h ['$' for help]`), state on connect.

**If not:** wrong port, wrong baud, or a non-GRBL board. Don't continue until Linked is stable for a full minute.

---

## 2. Save the machine's current settings `HW-02`

You'll change settings today. Save the starting point first so you can always go back.

**Do**
1. **Menu → Advanced…** → console. Send `$$`, then `$I`. (The console only confirms "Sent"; GRBL's replies land in the activity log.)
2. **Menu → Activity log…** → filter **TX/RX**. Copy every `$n=value` line into a text file named `sharpcnc-settings-original-YYYY-MM-DD.txt`, outside the repo. (Turn on **Debug mode** if you want **Copy last 100** or **Export**.) The raw settings list in **Advanced** shows the same values.
3. Copy the two `$I` reply lines into the same file.

**Expect:** `$$` prints about 30 settings. `$I` prints two lines like:
```
[VER:1.1h.20190825:]
[OPT:VNM,15,128]
```

**Record** (in the checklist): `$$` saved (where), and the full `[OPT:…]` line. Then these values from `$$`:

| Setting | What it is | Value |
|---|---|---|
| `$3` | direction invert mask | |
| `$5` | limit pins invert | |
| `$6` | probe pin invert | |
| `$10` | status report mask | |
| `$13` | report in inches (should be 0) | |
| `$20` / `$21` / `$22` | soft limits / hard limits / homing enabled | |
| `$23` | homing direction mask | |
| `$24` / `$25` / `$27` | homing feed / seek / pull-off | |
| `$30` / `$31` | spindle max / min RPM | |
| `$100`–`$102` | steps/mm X/Y/Z | |
| `$110`–`$112` | max rate X/Y/Z | |
| `$120`–`$122` | acceleration X/Y/Z | |
| `$130`–`$132` | max travel X/Y/Z | |

**Read the `[OPT:…]` letters before going on** — this answers an open question in the app without moving anything:
- **Contains `Z`** (homing force origin): after homing, X and Y read **0 at home and go positive** toward the far end. That matches what SharpCNC assumes. ✓
- **No `Z`**: stock GRBL behavior. After homing, **X and Y read negative** too. SharpCNC's X/Y soft-limit checks assume positive X/Y, so they'll refuse normal moves. **Record it and stop after step 8;** that needs a code change before soft limits can be trusted. Z is negative below home either way, which is what the app expects.

**If `$13=1`:** set `$13=0` in the console. SharpCNC works in millimeters.

---

## 3. Stop controls at rest `HW-03`

Test the stops while nothing is moving, so you know they work before you need them.

**Do**
1. Click **E-Stop**.
2. Try a jog button.
3. Click **Clear E-Stop**.
4. Click **Hold**, then **Resume**.
5. If the enclosure has Abort / Hold / Resume buttons: press each one and watch the **Inputs** row under Position and the activity log.

**Expect**
- After E-Stop: the red **E-Stop pressed — motion locked** banner. Jog buttons are disabled. Jog hints say "E-Stop latched".
- After Clear E-Stop: the banner goes away. (If GRBL was in Alarm, it also unlocks.)
- Hold/Resume at rest: state flickers to Hold and back.
- Enclosure buttons: the matching **Inputs** light (**Hold**, **Start**, **Reset**) comes on while held; the log shows the action.

**Record:** E-Stop latch works ✓/✗; each enclosure button and the Inputs light it triggers.

---

## 4. First moves: direction, 1 mm at a time `HW-04`

**Do**
1. If GRBL is in Alarm (homing enabled, not homed): click **Unlock**. The machine doesn't know where it is, so keep moves tiny and centered.
2. Go to **Calibrate → 2 · Direction**.
3. Press **Test +X**, then **Test +Y**, then **Test +Z** (each moves 5 mm), one at a time, watching the machine. Use the matching **Test −** button to bring it back.

**Expect**
- **+X** moves the spindle **right** (as you face the machine).
- **+Y** moves it **away from you** (up on the bed view).
- **+Z** moves the spindle **UP**, away from the bed. This is the most important one: if +Z goes down, every "safe" retract plunges into the work.

**If an axis is backwards:** tick **Invert** for that axis → **Write $3** → test again.

**Record:** final `$3` value; each axis direction ✓.

---

## 5. Feed hold and E-Stop while moving `HW-05`

This checks behavior the Virtual CNC can't simulate.

**Do**
1. Use the jog pad (Prepare step 2, or Calibrate step 4) with a **10 mm** step at the default feed.
2. Start a 10 mm X jog and click **Hold** mid-move.
3. Start another 10 mm X jog and click **E-Stop** mid-move.

**Expect**
- **Hold during a jog cancels the jog**; the machine stops and returns to **Idle** (real GRBL behavior; the Virtual CNC stays in Hold instead).
- **E-Stop during a jog** stops the machine, shows the latch banner, and blocks further motion until **Clear E-Stop**. GRBL may also show `ALARM:3` (reset while moving). Position may have shifted, so plan to home again.

**Record:** both behaviors ✓/✗, and any alarm code you saw.

---

## 6. Limit switches by hand `HW-06`

**Do:** power off the steppers or just keep clear, then press each limit switch with your finger (or a screwdriver), one at a time, while watching the **Inputs** row under Position.

**Expect:** **X lim**, **Y lim**, **Z lim** light up only while their switch is pressed, and go dark when released.

**If a light is on with nothing pressed:** that switch reads inverted. Flip that axis's bit in `$5` (X=1, Y=2, Z=4) in the console, and check again. If two axes light together, they share a pin (that's fine if wired that way, but record it).

**Record:** each switch ✓, final `$5`.

---

## 7. Home `HW-07`

Skip to step 8 if homing isn't enabled (`$22=0`); come back after setting it up.

**Do**
1. Move the gantry back near the middle.
2. **Calibrate → 1 · Start → Home ($H)**, hand on E-Stop.
3. Watch: **Z should go up first**, then X and Y head to their home corner.

**Expect**
- Each axis touches its switch, backs off, and stops. State becomes **Idle**. The session shows **Homed**.
- **Z reads about −1 mm** (minus the pull-off `$27`), not 0. The Z gauge shows the tool near the top.
- X/Y: per step 2's `[OPT:…]`: about 0 (with the `Z` option), or about −(travel) (without it).

**If any axis heads the wrong way:** hit E-Stop. That axis's bit in `$23` (homing direction) needs flipping. Fix it in the console and try again.

**Record:** MPos X / Y / Z right after homing. **This is the key reading** for the X/Y sign question.

**Repeat homing 3 times** with a marker line or a dial indicator on Z. **Expect** the same spot each time (within about 0.05 mm on Z). If Z drifts, lower `$24` (homing feed) and try again.

---

## 8. Steps per mm `HW-08`

**Do** (Calibrate → **3 · Steps/mm**):
1. **X:** mark the carriage, **Move +100 X**, measure with a tape or rule, type it in **How far it actually moved**, **Write $100**, then move again to check.
2. **Y:** same with 100 mm.
3. **Z:** set calipers or a dial indicator against the spindle body. **Move Z down 20 mm**, measure, **Write $102**, check again.

**Expect:** each axis within ±0.1 mm on a second move. If a correction is more than ±20%, suspect microstepping or screw pitch, not measuring.

**Record:** `$100`, `$101`, `$102` after correction.

**Stop here** if step 2 said X/Y will read negative (no `Z` in `[OPT:…]`) — soft travel won't work correctly until the app is fixed for that.

---

## 9. Soft travel `HW-09`

Needs homing (step 7) done this session.

**Do** (Calibrate → **4 · Soft travel**):
1. Using the jog pad on that step, move **X toward the far end**, slow down near it, and stop **about 5 mm short** of the hard stop. **Use MPos** for X.
2. Same for **Y**.
3. Jog **Z down** to the lowest point you'd ever want the spindle (well above the bed with no bit) → **Use MPos** for Z. It fills in as a positive number; that's correct.
4. Keep **Enable soft limits ($20=1)** ticked → **Write travel + $20**.
5. Jog toward the far end of X past the value you entered.

**Expect**
- Step 5: the app stops the jog at the edge with a hint. If you send a jog past the limit from the console, **real GRBL answers `error:15` and stays Idle** (the Virtual CNC raises an alarm instead).
- The Z gauge now shows the full travel (0 at top, −`$132` at the bottom).

**Record:** `$130`, `$131`, `$132`; soft-limit refusal ✓.

---

## 10. Bed travel test, with an E-Stop in the middle `HW-10`

This confirms the E-Stop fix on real hardware: before the fix, E-Stop between moves let the test continue.

**Do**
1. **Menu → Bed travel test…** → start it with the bed clear.
2. After it finishes the second corner, click **E-Stop**.
3. Wait 10 seconds.

**Expect:** the machine stops and **does not start the next segment**. The test shows **Aborted by E-Stop**. The latch banner is up.

**Then:** Clear E-Stop → **Home again** → run the full bed travel test once without interruption.

**Record:** stopped and stayed stopped ✓; full run ✓.

---

## 11. Probe and touch plate `HW-11`

No bit yet: clip onto a metal dowel or an old bit shank in the collet, or just test continuity.

**Do**
1. Touch the clip to the plate by hand. Watch the **Probe** light in the Inputs row.
2. Jog Z so the clip-holder is about **10 mm above** the plate. **Prepare → 3 · Z probe** → run the probe.
3. **Initial-state alarm check:** hold the clip on the plate and run the probe again.
4. **No-contact check:** move the plate away, set the seek to 5 mm, and run the probe in the air.

**Expect**
1. **Probe** light on only while the clip touches the plate. If it's on all the time (or never), flip `$6`.
2. The probe moves down slowly, stops on contact, sets material Z0, and retracts. The Z gauge shows the brass Z0 line.
3. **`ALARM:4`** (probe already active at start) — and the app explains it that way.
4. **`ALARM:5`** (no contact) after moving 5 mm, and the app explains it that way.

**Record:** `$6`, plate thickness, alarm 4/5 meanings ✓, probe never "timed out" early ✓.

---

## 12. Dry run in the air `HW-12`

**Do**
1. **Prepare → Load** → Samples → **50×50 mm** square → generate a shallow outline (1 mm deep).
2. Set material Z0 with the probe (step 11) on a piece of scrap.
3. **Verify** → tick **Dry run (spindle off, Z lifted above the stock)** → Simulate → **Start**.
4. Midway, click **Hold**, then **Resume**. Then **Stop** near the end.

**Expect**
- The whole path runs **above the stock**: the deepest point stays **5 mm above Z0**. Watch the Z gauge.
- No spindle command reaches the spindle (it's unplugged anyway).
- Hold/Resume pause and continue; Stop ends the job.

**Then try start-at-line:** move the scrubber to about the middle → Start (still dry run). **Expect:** retract → move over the start point → (spindle-on skipped in dry run) → slow plunge to the lifted depth → continue. The activity log shows the resume setup lines.

**Record:** dry run stays in the air ✓; Hold/Resume/Stop ✓; resume setup ✓.

---

## 13. Spindle, bit still out `HW-13`

**Do**
1. Plug the spindle back in / power it. Bit still out, spindle clear.
2. **Spindle On** at a low speed. Then try the spindle override (±10%).
3. **Spindle Off**.
4. Spindle on again → click **E-Stop**.
5. Spindle on again → click **Hold**.

**Expect**
1–3. Spindle speeds up and slows with the override; Off stops it.
4. **E-Stop stops the spindle** (GRBL's reset turns it off).
5. **Hold does NOT stop the spindle** on stock GRBL — it only pauses motion. Remember this: Hold is a pause, not a stop.

**Record:** `$30`/`$31` sensible ✓; E-Stop stops spindle ✓; Hold leaves it running (expected).

---

## 14. Wrap up `HW-14`

1. Console → `$$` again → save as `sharpcnc-settings-calibrated-YYYY-MM-DD.txt`.
2. Fill in the summary at the top of the [hardware checklist](../hardware-checklist.md).
3. Anything marked ✗ or "unexpected" goes on the checklist's **Open issues** list.

**Next session:** [First-test stages](13-first-test-stages.md), starting at **Stage 3 — Job with no tool, Z raised**, then Stage 4 (scrap cut).

Back to the [guide index](README.md).
