# 13. First-test stages (air → scrap)

**For:** First time running this CNC with SharpCNC on real hardware.  
**Goal:** Prove the link and motion in small safe steps before any finished part.  
**Do not skip stages.** Each stage must **Pass** before the next. Stay at the machine. Keep one hand near **Abort** and know how to kill **spindle power**.

Longer checklists: [Hardware soak](12-hardware-soak.md) · [Safety](11-safety.md) · [Soak playbook](../demon-shield-soak-playbook.md).  
Phase pictures: [Connect](../setup-visual/connect.html) · [Calibrate](../setup-visual/calibration.html) · [Prepare](../setup-visual/prepare.html) · [Verify](../setup-visual/verify.html) · [Run](../setup-visual/run.html).

---

## Before stage 1 (once)

1. Practice on **Virtual CNC**: Connect → Calibrate practice → one Prepare → Verify dry-run → try Simulate Alarm / Unlock.  
2. Clear the bed: no tools, loose clamps, or cables in the travel path.  
3. Spindle **unplugged or powered off** until Stage 4 says otherwise.  
4. No bit in the collet for Stages 1–3.  
5. Know: UI **E-Stop** and enclosure **Abort** are soft reset / hold — they are **not** a wall-power kill switch.

---

## Stage 1 — Connect only

**What you are proving:** The PC talks to GRBL. Nothing should move yet on purpose.

### Steps

1. Power the controller (Arduino / Demon Shield). Prefer steppers at low risk until positions look sane.  
2. Open SharpCNC → real COM port → **Connect** (115200).  
3. Wait until status shows connected and **Machine XYZ** numbers update.  
4. Glance at Debug / activity: status polls should look healthy.  
5. Do **not** jog, home, or Start a job yet.  
6. **Disconnect**, then Connect again once.

### Pass

- Connect stays linked for at least a minute.  
- Live Machine (and Material) readouts update.  
- Disconnect / reconnect works without freezing.  
- No unexpected motion.

### Fail — stop here

- Port missing, connect errors, or status stuck offline.  
- Constant serial errors / unexpected motion.  
- Alarm on connect you cannot explain — clear the cause before Unlock; do not Unlock blindly.

---

## Stage 2 — Jog in air

**What you are proving:** Directions, soft travel, Hold / Abort, and that you can stop.

**Prerequisite:** Stage 1 Pass. Soft travel from Calibrate (`$130`–`$132`, `$20=1`) — or only tiny center jogs with Abort ready while you finish Calibrate.

### Steps

1. **Home** (`$H`) if zero-side switches are wired — recommended before trusting soft limits.  
2. Small **+X**, **+Y**, **+Z** jogs must match the pad and visualizer (+X right, +Y back = up on screen, +Z up). Fix `$3` if inverted.  
3. Jog slowly near mid-travel. Try **Hold**, then **Resume** (UI and enclosure if wired).  
4. Tap UI **E-Stop** or enclosure **Abort** once while jogging carefully — recover with Unlock only if Alarm and the machine is clear.  
5. Jog toward a **far** soft limit slowly — refuse or alarm **before** a crash.  
6. Optional: **Bed travel test** once with the bed clear.

### Pass

- Axes move the expected way and distance.  
- Hold / Resume / E-Stop / Abort work.  
- Soft limits feel conservative vs the real rails.

### Fail — stop here

- Axis inverted or wrong distance; soft travel larger than the bed.  
- Hold / Abort useless; crash into a rail or switch.  
Re-do Calibrate; re-run [hardware soak](12-hardware-soak.md). No jobs yet.

---

## Stage 3 — Job with no tool, Z raised

**What you are proving:** Streaming without cutting — Start / Hold / Stop, dry-run, soft-limit gate.

**Prerequisite:** Stage 2 Pass. **No cutting bit.** Spindle still **off / unplugged**.

### Steps

1. Keep Z **high** (safe air above anything on the bed). Stock optional as a visual only.  
2. Prepare: rough stock size, safe **Material XYZ**, manual Z well above the stock. Mark ready.  
3. Load a **short** simple path. **Simulate** in Verify.  
4. **Dry run ON**. Checklist: plate removed, clamps clear, path free.  
5. **Start.** Hand on Abort. Mid-path: **Hold** → **Resume**. Then **Stop** / Abort once.  
6. Confirm Idle / Verify is sane; re-home if unsure.

### Pass

- Job streams; no spindle spin (dry-run); path stays in air.  
- Hold / Resume / Stop behave; soft-limit gate blocks an obviously out-of-bed path.

### Fail — stop here

- Unexpected Z dive; path into clamps/bed; stream error while machine still moves; spindle starts despite dry-run.  
Fix zeros / Safe Z / soft travel / PWM. Re-run Stage 3. Do not add a tool.

---

## Stage 4 — Scrap material

**What you are proving:** A shallow cut on throwaway stock.

**Prerequisite:** Stage 3 Pass. Probe + PWM soak done if the spindle will spin ([hardware soak](12-hardware-soak.md)).

### Steps

1. Clamp **scrap** solidly; clamps outside the path. Install the bit.  
2. Prepare: Material XY, **Z probe** with correct plate thickness → retract → **remove plate**. Mark ready.  
3. Tiny shallow job. Simulate. Optional: one more dry-run over the scrap if zeros changed.  
4. Dry run **OFF**, checklist confirmed, feed override maybe **70–90%**.  
5. Start spindle with Z clear, then **Start**. Stay at the machine.  
6. Hold / Abort ready; kill spindle power if needed.  
7. When finished: spindle off, inspect scrap — do not jump to a good part yet.

### Pass

- Shallow cut completes or stops cleanly under your control.  
- No rail crash, no plate left on, no clamp hit.  
- You used Hold or Abort at least once in Stages 3–4.

### Fail — stop cutting

- Wrong depth/XY; alarm from a real crash risk; spindle ignores Off; serial drops.  
Safe abort, Unlock only when clear, re-probe, return to Stage 3 before another scrap attempt.

---

## After Stage 4 Pass

You are cleared for careful real parts — still Simulate every new path, keep soft travel honest, never leave a Running job unattended.

---

## What you could not verify without the real machine

Virtual CNC and reading the code are not enough for:

1. Limit switch wiring, polarity, pull-off, false trips.  
2. True bed size vs `$130`–`$132`.  
3. Direction and steps/mm under real mechanics.  
4. Probe contact, `$6`, plate thickness → real Z0.  
5. PWM spindle on/off and `$30`/`$31` range.  
6. Enclosure Abort / Hold / Resume feel.  
7. USB unplug mid-job (dangerous — only a deliberate drill after Stage 3).  
8. EMI with spindle running.  
9. Whether `$21` hard limits help or nuisance-trip on home-side-only switches.  
10. Crash recovery after real power loss mid-cut.

Until Stages 1–4 Pass on iron, do not treat a good Virtual CNC session as a green light for a finished part.

Back to the [guide index](README.md).
