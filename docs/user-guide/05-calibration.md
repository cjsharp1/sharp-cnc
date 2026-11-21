# 5. Calibration

**Prefer pictures:** [Calibration visual guide](../setup-visual/calibration.html) (zeros · `$3` · steps/mm · soft travel).

Menu → **Calibration…** (also from First-run step 3). Connect first.

| # | Step | Action |
|---|------|--------|
| 1 | Zero | Confirm Work / Machine → **Zeros look good — Next** |
| 2 | Direction | Invert wrong axes → **Write $3** → Test ±5 mm |
| 3 | Steps/mm | Move → measure → **Write $100 / $101 / $102** |
| 4 | Soft travel | Jog far → Use MPos → **Write travel + $20** |
| 5 | Manual | Advanced `$$` / `$x=value` only if needed |

> **Safety:** Clear bed. Keep Z high for XY. E-Stop ready.

## Quick reference

- `$3` bits: X=1, Y=2, Z=4 (sum to invert). Expect +X right, +Y back, +Z up.
- Steps formula: `new = old × commanded ÷ measured`.
- Soft travel: `$130`–`$132` + `$20=1`. Far rails are software on this machine.

Screenshots (wizard UI): [step 1](assets/cal-step1-zero.png) · [steps](assets/cal-step2-steps.png) · [travel](assets/cal-step3-travel.png) · [manual](assets/cal-step4-manual.png)

Next: [Material & tool](06-material-and-tool.md) · [First-run visual](../setup-visual/first-run.html)
