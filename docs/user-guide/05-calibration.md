# 5. Calibration (Phase 1)

**When:** once per machine, or after wiring / screws / travel change. **Before** trusting Prepare or cuts. Not a per-job step.

**After done:** next sessions skip Calibrate and open on **Prepare**. Re-enter anytime from the phase switcher or Menu → Calibrate….

**Prefer pictures:** [Calibration visual guide](../setup-visual/calibration.html) (zeros · `$3` · steps/mm · soft travel · bed test).

Phase switcher → **Calibrate** (also from First-run). Connect first.

| # | Step | Action |
|---|------|--------|
| 1 | Zero context | Confirm Material / Machine → optional **Home ($H)** → confirm → **Next** |
| 2 | Direction | Invert wrong axes → **Write $3** → Test ±5 mm |
| 3 | Steps/mm | Move → measure → **Write $100 / $101 / $102** |
| 4 | Soft travel | Jog far → Use MPos → **Write travel + $20** → **Continue to Prepare** |

Raw `$$` / `$x=value` edits live under **Menu → Advanced…** (not a Calibrate step). Homing and **Bed travel test…** are recommended, not required to mark calibrated.

Finishing Soft travel (all four steps confirmed) — or explicitly confirming “Machine already calibrated” on a returning profile — marks the machine calibrated and offers **Continue to Prepare**. Optional **Bed travel test…** (or Menu → Bed travel test…) walks all XY soft-limit corners after travel is written.

> **Safety:** Clear bed. Keep Z high for XY. E-Stop ready. Prefer Virtual CNC for the first pass.

## Quick reference

- `$3` bits: X=1, Y=2, Z=4 (sum to invert). Expect +X right, +Y back (up on the visualizer), +Z up.
- Steps formula: `new = old × commanded ÷ measured`.
- Soft travel: `$130`–`$132` + `$20=1`. Far rails are software on this machine.

## Verify with a cut-size sample

After steps/mm look close, cut a known size and measure:

1. Prepare → Load → SVG → **Samples → 100×100 mm** (true millimetre SVG).  
2. Generate a shallow engrave/outline → finish Prepare → Verify → cut on scrap.  
3. Measure X and Y. Adjust steps/mm with the formula above if needed, then re-check.

Also available: **50×50 mm** square and **100 mm line**. Details: [Jobs & SVG — cut-size samples](08-jobs-and-svg.md#cut-size-samples).

Screenshots (wizard UI): [step 1](assets/cal-step1-zero.png) · [steps](assets/cal-step2-steps.png) · [travel](assets/cal-step3-travel.png)

Next (every job): [Prepare & Z probe](07-prepare-and-z-probe.md) · [Prepare visual](../setup-visual/prepare.html)
