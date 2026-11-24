# 8. Jobs, SVG & run

Files become motion across phases: **Prepare** (load / generate + place) → **Verify** (soft-limit check, simulate, clear-path checklist, Start) → **Run** (progress, overrides on the safety strip, Hold / Stop). Start is only available in **Verify**.

Visual: [Load the job](../setup-visual/prepare.html#p4) · [Verify](../setup-visual/verify.html) · [Run](../setup-visual/run.html).

![Job flow](assets/diagram-job-flow.svg)

![Simulate controls](assets/job-simulate.webp)

Load **before** Mark ready: opening a new file clears the Prepared flag. See [Prepare & Z probe](07-prepare-and-z-probe.md).

## Load G-code (Prepare · Load step)

1. **Load** (or drag-drop) a `.nc` / `.gcode` / `.ngc` / `.tap` file.  
2. Confirm line count and path overlay on the visualizer — the drawing should sit on the stock rectangle.  
3. Soft-limit check runs against known travel — if the path is outside, Start stays blocked with a reason (shown again in Verify).

**Replace** swaps the file; **Clear** removes it.

**ELI5:** G-code is a ready-made shopping list of moves. Until you Load it, SharpCNC has nothing to draw on the bed or send to the machine.

## SVG → simple G-code (Prepare · Load step)

SharpCNC is **not** full CAM. For simple 2D engraving / outline:

1. **Load SVG** (or drop `.svg`), or tap a built-in **Sample**. Paths preview on the bed.  
2. Set **Mode**: Engrave (follow path) or Outline (closed contour).  
3. Set **Feed**, **Plunge**, **Depth**, **Safe Z**, and **Spindle RPM**. Bit Ø comes from Material & tool; use **Apply to SVG** there to pull material presets.  
4. **Generate → Job** hands the G-code to the job runner (one job at a time). Generated jobs include `M3 S…` before cuts and `M5` before program end (omit spindle words if RPM is 0).

**ELI5:** SVG is a picture. Generate turns that picture into cutting steps. Always check it on the stock before Start.

Always simulate after generate. Depth is into the material — double-check sign/convention and stock thickness before Start.

## Cut-size samples

SharpCNC ships **real-mm** sample SVGs so you can load → place on stock → cut → measure without guessing units. Each file sets `width`/`height` in `mm` and a matching `viewBox`, so **100 mm in the SVG is 100 mm in the app**.

| Sample | In app | File |
|--------|--------|------|
| **100×100 mm square** (primary) | Prepare → SVG → **Samples → 100×100 mm** | [sample-100mm-square.svg](assets/samples/sample-100mm-square.svg) |
| 50×50 mm square | **Samples → 50×50 mm** | [sample-50mm-square.svg](assets/samples/sample-50mm-square.svg) |
| 100 mm line (+ end ticks) | **Samples → 100 mm line** | [sample-100mm-line.svg](assets/samples/sample-100mm-line.svg) |

**How to use**

1. Finish [calibration](05-calibration.md) (especially steps/mm) if the machine is new or changed.  
2. Prepare → Load → **SVG** → pick a **Sample**. Confirm the size chip (e.g. `100.0×100.0 mm`).  
3. Choose **Engrave** or **Outline**, set a shallow depth, **Generate → Job**.  
4. Finish Prepare (stock, Material XY, Z) so the path sits on the scrap you will cut → **Mark ready**.  
5. **Verify → Simulate**, then **Start** (or spindle-off dry run first).  
6. Measure the cut with a ruler/calipers. If the square is not 100 mm, revisit steps/mm — do not “scale the SVG.”

Repo copies also live under `public/samples/` for the desktop/web build.

## Verify phase — Simulate, checklist, Start

**Entry:** Prepare ready + job loaded.

| Control | Role |
|---------|------|
| Soft-limit summary | Blocks Start if path is outside travel |
| **Simulate** | Preview only — no serial motion |
| Dry-run toggle | Spindle-off air cut; recommended **on** for first real-machine job |
| Checklist | Plate removed, clamps clear, spindle path free |
| **Start** | Streams G-code (needs Linked, Idle-capable, soft-limit OK, Prepare ready) |
| Crash recovery | Replaces this screen when a checkpoint exists |

### Simulate (preview only)

**Simulate** animates the toolhead along the path **without sending motion to the CNC**.

- **Play** / **Resume** / **Replay**  
- **Pause** / **Stop**  
- **Speed** — 0.25× / 0.5× / 1× (default) / 2× / 4×  

During play, SharpCNC shows Z cues (Retract / Plunge / Cut / Rapid). Banner: **Preview — not sending to CNC**. Disabled while a real job is streaming.

### Scrubber, skip-to-line, time estimate, dry run

With a job loaded (and not streaming):

- **Start at line** scrubber — next **Start** begins at that line. Starting mid-file, SharpCNC first runs a **resume setup**: it restores units, work offset, plane, feed, spindle, and coolant from the earlier lines, then retracts to the job's clearance height, moves over the start point, spins up (3 s dwell), and plunges slowly. The exact commands go to the activity log.  
- Rough **time estimate** from path length  
- **Dry run (spindle off, Z lifted)** — turns `M3`/`M4` into `M5`, strips `S`, and lifts every absolute Z so the deepest point of the job stays **5 mm above material Z0**. Use it to watch the whole path in the air. If the lift would push the job above Z home, Start is refused with the reason.

### Before Start: the soft-limit check

Start checks the whole job against soft travel in machine coordinates:

- **X/Y**, including the true extent of arcs (not just their end points)  
- **Z top**: a clearance/safe height that would go above Z home. Fix by lowering the CAM safe height, or by raising the spindle so material Z0 sits lower in Z travel  
- **Z bottom**: a cut deeper than Z travel  

`G53`/`G28`/`G30` moves are in machine coordinates, so they're left out of the job outline and the simulation.

## Run phase — supervise the cut

**Entry:** job streaming (or Hold mid-job).

| Control | What it does |
|---------|----------------|
| Progress | Line / %, time estimate if known |
| Feed / spindle overrides | On the safety strip |
| **Pause** | Feed hold (`!`) |
| **Resume** | Cycle start (`~`) from Hold |
| **Resume after tool change** | Continues past an `M6` pause |
| **Stop** | Soft reset / cancel stream — treat as abort |

**If GRBL rejects a line mid-job** (`error:N`), SharpCNC stops sending, sends a **feed hold**, and shows which line failed. The spindle may still be running: press **Stop** to cancel the job and turn it off.  
**If GRBL raises an alarm mid-job**, the job ends and the alarm panel explains the code. Recovery offers to resume about 20 lines before the last line GRBL accepted, because GRBL accepts lines before it finishes cutting them.

Not in Run: probe, calibrate, job load, Advanced.

When the stream hits **`M6`**, SharpCNC pauses for a tool change. Change the bit, then **Resume after tool change**.

Hardware **start / pause / stop** buttons on the Demon Shield stay in sync; Start from hardware respects the same Prepare gate.

**Exit:** job complete / Stop → back to **Verify** (same job) or **Prepare** (new blank). Disconnect → Connect.

> **Safety:** Stay at the machine while Running. Know where **E-Stop** is (UI and physical). Do not Start if clamps, bit, or soft travel look wrong. When in doubt, Simulate again or use **spindle-off dry run** with Z raised. Practice the full path once on Virtual CNC.

## Alarms during a job

If GRBL alarms (limit, abort, etc.):

1. Spindle / motion stop — respect the machine.  
2. Read the **Alarm lock** banner.  
3. Clear the physical cause.  
4. **Unlock** (`$X`) only when safe.  
5. Re-zero / re-check before Start again.

See [Safety](11-safety.md).

Next: [External jobs](09-external-jobs.md).
