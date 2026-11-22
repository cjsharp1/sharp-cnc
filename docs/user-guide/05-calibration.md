# 5. Calibration

**When:** once per machine, or after wiring / screws / travel change. **Before** trusting Prepare or cuts. Not a per-job step.

**Prefer pictures:** [Calibration visual guide](../setup-visual/calibration.html) (zeros · `$3` · steps/mm · soft travel · bed test).

Menu → **Calibration…** (also from First-run step 3). Connect first.

| # | Step | Action |
|---|------|--------|
| 1 | Zero | Confirm Work / Machine → **Zeros look good — Next** |
| 2 | Direction | Invert wrong axes → **Write $3** → Test ±5 mm |
| 3 | Steps/mm | Move → measure → **Write $100 / $101 / $102** |
| 4 | Soft travel | Jog far → Use MPos → **Write travel + $20** · optional **Bed travel test…** |
| 5 | Manual | Advanced `$$` / `$x=value` only if needed |

After soft travel (or **Done → Bed travel test** / **Menu → Bed travel test…**), SharpCNC can walk all XY soft-limit corners: safe Z retract, cruise in the open bed, slow approach near each edge, optional proximity beep. Confirm the safety gate before Start; Abort / Feed Hold cancel motion.

> **Safety:** Clear bed. Keep Z high for XY. E-Stop ready.

## Quick reference

- `$3` bits: X=1, Y=2, Z=4 (sum to invert). Expect +X right, +Y back (up on the visualizer), +Z up.
- Steps formula: `new = old × commanded ÷ measured`.
- Soft travel: `$130`–`$132` + `$20=1`. Far rails are software on this machine.

## Verify with a cut-size sample

After steps/mm look close, cut a known size and measure:

1. Job → SVG → **Samples → 100×100 mm** (true millimetre SVG).  
2. Generate a shallow engrave/outline → Prepare → cut on scrap.  
3. Measure X and Y. Adjust steps/mm with the formula above if needed, then re-check.

Also available: **50×50 mm** square and **100 mm line**. Details: [Jobs & SVG — cut-size samples](08-jobs-and-svg.md#cut-size-samples).

Screenshots (wizard UI): [step 1](assets/cal-step1-zero.png) · [steps](assets/cal-step2-steps.png) · [travel](assets/cal-step3-travel.png) · [manual](assets/cal-step4-manual.png)

Next (every job): load G-code/SVG → [Prepare to run & Z probe](07-prepare-and-z-probe.md) · [Prepare visual](../setup-visual/prepare.html#p1)
