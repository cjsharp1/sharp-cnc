# Demon Shield hardware soak playbook

Operator checklist for Chris’s CNC: **Demon Shield** on Arduino + GRBL over USB, controlled by **SharpCNC**.

Vendor reference: [Designs By Phil — Demon Shield](https://www.designsbyphil.com/demon-shield-1.html)  
Related: [external Abort / Hold / Resume mapping](demon-shield-controls.md) · [user guide — Safety](user-guide/11-safety.md)

Use this **before trusting soft limits, probe, or a wood cut**. Stay at the machine. Keep spindle power and E-Stop within reach. Prefer mock/UI practice first if you are new to the app.

## What you are verifying

| Area | Pass means |
|------|------------|
| Homing | `$H` reaches the **zero-side** limit switches only; machine reports a known origin |
| Status `$3` | Direction invert mask matches how axes actually move |
| Soft limits | Far-end travel is software (`$130`–`$132` + `$20`) — no far-end mechanical switches assumed |
| Z probe | `G38.2` contact on the touch plate; plate thickness applied for Z0 |
| Abort / Hold / Resume | Physical buttons match Soft reset / Feed hold / Cycle start |
| PWM spindle | `M3 S…` / overrides change speed in the expected `$30`/`$31` range |

---

## 0. Pre-flight (power off motion)

1. Clear the bed of tools, loose clamps, and cables in the travel envelope.
2. Confirm USB from PC → Demon Shield / Arduino.
3. Confirm limit switch wiring on the **home / zero side** only (X−, Y−, Z+ or as built — match your gantry).
4. Confirm probe lead continuity: plate ↔ GRBL probe pin (noise-filtered probe socket on the shield).
5. Confirm spindle PWM (and optional direction / relay) matches the shield silk.
6. Note which enclosure colors map to **Abort / Hold / Resume** (red / yellow / green recommended by vendor — **verify yours**).

Power on controller + steppers only when ready to watch motion. Spindle off until the PWM step.

---

## 1. Connect in SharpCNC

1. Launch SharpCNC (installer or `npm run tauri dev`).
2. **Refresh** ports → select COM → **Connect** at **115200**.
3. Wait for **Linked** and live Material / Machine coordinates.
4. Open **Log** — confirm status polls (`?`) without constant errors.

If Alarm on connect: clear the physical cause, then **Unlock** (`$X`). Do not unlock blindly.

---

## 2. Homing (`$H`)

Homing uses the **zero-side** micro limits. Far rails are **not** assumed to have switches.

1. Jog carefully toward mid-travel if already against a rail (manual nudge with power off if jammed).
2. In **Calibrate** or **Prepare**, use **Home** (sends `$H`) when SharpCNC allows it (Idle, linked, not streaming).
3. Watch each axis approach its home switch and pull off.
4. Confirm status leaves Alarm; Machine coordinates look consistent with your home corner.
5. Mark session **homed** in the UI if prompted / shown.

**Fail:** axis runs the wrong way into the far end, switch never trips, or Alarm (homing fail). Power down, check `$23` / invert / wiring, fix before soft-limit soak.

---

## 3. Direction mask (`$3`)

`$3` is the **direction port invert** bitmask. Wrong bits feel like “jog +X goes −X”.

1. After a successful home (or with soft limits off and plenty of clearance), jog **+X**, **+Y**, **+Z** one small step each.
2. Confirm physical motion matches the pad labels and the visualizer.
3. If inverted: use **Menu → Calibration… → Axis direction**, or set `$3` via the calibration / console path, then re-test.
4. Dump settings (`$$`) and record the working `$3` value in your shop notes.

Do not proceed to soft-limit soak until jog direction is trustworthy.

---

## 4. Soft limits soak (`$20`, `$130`–`$132`)

Far-end protection is **software travel**. Measure the real bed; do not guess.

1. Run **Calibration → Soft travel** (or write `$130`/`$131`/`$132` max travel and enable `$20=1`).
2. With soft limits on, jog toward each **far** rail slowly — SharpCNC / GRBL should refuse or alarm before a crash.
3. Confirm UI soft-limit hints appear when a jog would exceed stored travel.
4. Run **Menu → Bed travel test…** (or Calibration **Done → Bed travel test**): clear bed, confirm gate, watch full-corner walk with slow approach; Abort ready.
5. Intentionally request a tiny illegal jog in mock or with spindle off to see Alarm → Unlock flow once.

**Fail:** numbers larger than the physical bed. Re-measure after belts, endstops, or table changes.

---

## 5. Z probe (`G38.2`)

1. Place the conductive plate on the **stock top** (not bare bed for top-of-stock Z0). Clip the bit.
2. Open **Prepare to run…** or use the probe path that runs `G38.2`.
3. Confirm plate thickness in probe settings matches the physical plate (~15–20 mm for Chris’s plate).
4. Run Z probe; watch seek → contact → retract. **Remove the plate before cutting.**
5. Confirm Work Z is correct for stock top (or your chosen Z0).
6. Remove the plate before any cutting move.

Also confirm `$6` (probe pin invert) if contact never registers or is always active — see shield probe wiring.

**XY probe / corners** (optional same session): edge/corner cycles on Prepare → **Material XY** with clear approaches.

---

## 6. Abort / Hold / Resume (external buttons)

Hardware mapping (typical Demon Shield; confirm on your enclosure):

| Button (typical) | GRBL action | SharpCNC expectation |
|------------------|-------------|----------------------|
| Abort | Soft reset (Ctrl-X) | Job → idle; welcome / reset banner |
| Hold | Feed hold (`!`) | Job → paused; buffer fill stops |
| Resume | Cycle start (`~`) | Job continues from hold |

Soak:

1. Load a short benign job (or mock stream). **Simulate** first.
2. **Start** with spindle **off** (or dry air cut) and hand on Abort.
3. Press **Hold** mid-path → UI shows Held; motion stops.
4. Press **Resume** → motion continues the same job.
5. Start again; press **Abort** → UI idle; no second soft-reset from the app.
6. Confirm UI Hold / Resume / E-Stop still work over USB independently.

Details: [demon-shield-controls.md](demon-shield-controls.md).

---

## 7. PWM spindle

1. Confirm `$30` (max RPM) / `$31` (min RPM) match the VFD / ESC expectation.
2. With bit clear of stock, **Spindle On** at a low `S` / UI RPM; verify PWM response.
3. Exercise feed / spindle override strip (±10%, 100%) while Idle or during a dry job.
4. **Spindle Off** (`M5`) — confirm stop. Optional direction / IoT relay: verify on/off separately from PWM.

Never leave a spinning spindle unattended during soak.

---

## 8. Sign-off (ready for wood)

Check each box only after a live pass:

- [ ] Linked over USB at 115200  
- [ ] Homing to zero-side limits OK  
- [ ] `$3` jog directions correct  
- [ ] Soft max travel measured and `$20` on  
- [ ] Z probe thickness + contact verified; plate removed after  
- [ ] Abort / Hold / Resume colors confirmed on the enclosure  
- [ ] PWM spindle on/off + overrides sane  
- [ ] Simulate → careful Start on scrap before the real part  

If any box fails, fix hardware or settings before cutting wood. Soft limits and probe are not optional comfort features on this machine — they are the far-end and Z safety story.
