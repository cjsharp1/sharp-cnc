# SharpCNC user guide

Friendly, practical docs for running **one** home CNC: Chris’s custom Demon Shield + Arduino + GRBL over USB, controlled from SharpCNC on Windows.

**Scope:** SharpCNC is a dedicated personal controller for that specific machine. The app walks you through **task phases** — Connect → Calibrate → Prepare → Verify → Run — so you only see the controls for the job at hand. It is **not** a multi-machine CAM suite or Universal Gcode Sender replacement, and there is **no intention** to support other CNCs, controllers, or firmwares.

**Browse on GitHub Pages** (same workshop fonts as the app): [docs home](../index.html) · [this guide in the viewer](../guide.html) · **[visual setup](../setup-visual/index.html)**

## Order of operations

| Phase | When | What you do |
|-------|------|-------------|
| **0 · [Connect](02-connect.md)** | Every session | Link USB **or** practice on **Virtual CNC** first |
| **1 · [Calibrate](05-calibration.md)** | Once per machine (or after hardware change) | `$3` direction · steps/mm · soft travel · optional bed test. Visual: [calibration](../setup-visual/calibration.html) |
| **2 · [Prepare](07-prepare-and-z-probe.md)** | Every new job | Stock + tool · Material XYZ · Z probe · load path · Mark ready. Visual: [prepare](../setup-visual/prepare.html) |
| **3 · Verify** | After Mark ready | Soft-limit check · Simulate · clear-path checklist · **Start** |
| **4 · Run** | While cutting | Progress · feed/spindle overrides · Hold / Stop |

**Next session after calibration is done:** Connect → Prepare → Verify → Run. Calibrate stays one click away (phase switcher / Menu), not in the daily path.

**Practice path:** Finish Calibrate + one Prepare → Verify dry-run on **Virtual CNC** before trusting real USB and soft limits.

Fresh install bootstrap (connect → home → into Calibrate): [First-run](../setup-visual/first-run.html).

## How to use this guide

**First time:** Connect with Virtual CNC → finish [calibration](../setup-visual/calibration.html) → one full Prepare → Verify practice cut (dry-run) → then real USB. Come back to these chapters for short reference tables.

Safety notes appear throughout. When something can crash the machine or hurt you, it is called out explicitly — take those seriously.

**Advanced** (console, macros, G54–G59, raw `$$`) lives under **Menu → Advanced…** only — see the short [appendix in Jogging & zeros](04-jogging-and-zeros.md#advanced-appendix). You should never need it for a normal cut.

## Chapters

| # | Chapter | What you learn |
|---|---------|----------------|
| 1 | [Install & run](01-install-and-run.md) | Windows installer, `npm run tauri dev`, mock UI |
| 2 | [Connect](02-connect.md) | Phase 0 · COM ports · Virtual CNC first · [first-run](../setup-visual/first-run.html) |
| — | [Calibration visual](../setup-visual/calibration.html) | **Phase 1 · once** · `$3` · steps/mm · soft travel · bed test |
| — | [Prepare visual](../setup-visual/prepare.html) | **Phase 2 · every job** · stock · Material XYZ · Z · load |
| 3 | [Understanding the UI](03-understanding-the-ui.md) | Safety strip, phase switcher, Material vs Machine, Menu |
| 4 | [Jogging & zeros](04-jogging-and-zeros.md) | Jog in Prepare/Calibrate, material origin, XY probe · Advanced appendix |
| 5 | [Calibration](05-calibration.md) | Phase 1 short table · prefer [visual](../setup-visual/calibration.html) |
| 6 | [Material & tool](06-material-and-tool.md) | Stock size, bed corners (map layout), bit diameter — Prepare step |
| 7 | [Prepare & Z probe](07-prepare-and-z-probe.md) | Phase 2 stepped wizard · Mark ready → Verify |
| 8 | [Jobs, SVG & run](08-jobs-and-svg.md) | Load in Prepare · Simulate/Start in Verify · overrides in Run |
| 9 | [External jobs](09-external-jobs.md) | Watched folder + Drive setup pointer |
| 10 | [Debug bridge](10-debug-bridge.md) | Menu · Debug, logs, export, localhost agent status |
| 11 | [Safety](11-safety.md) | Always-on strip, soft limits, Virtual practice, unlock |
| 12 | [Hardware soak](12-hardware-soak.md) | Demon Shield home, `$3`, soft limits, probe, buttons, PWM |
| 13 | [First-test stages](13-first-test-stages.md) | Connect → air jog → no-tool raised Z → scrap; pass/fail each stage |

## Quick start (experienced)

1. Install from [Releases](https://github.com/cjsharp1/sharp-cnc/releases/latest), or `npm install` then `npm run tauri dev` on the Windows PC next to the CNC.
2. **Connect:** Prefer **Virtual CNC** once for practice; then real COM → **Connect**.
3. **Calibrate (once):** Phase switcher → **Calibrate** (or First-run) — `$3`, steps/mm, soft travel. Optional bed travel test. Next sessions skip to Prepare.
4. **Every job:** **Prepare** (stock, Material XY + Z, load) → **Mark ready** → **Verify** (Simulate) → **Start** → **Run**.

## Screenshots & diagrams

Illustrations live in [`assets/`](assets/). Diagrams are SVG (easy to read at a glance). Screenshots show the current **task-phase** UI (Connect · Calibrate · Prepare · Verify · Run) on **Virtual CNC**, with **Material** (not Work) on the position strip.

## Related project docs

- [Demon Shield vendor page](https://www.designsbyphil.com/demon-shield-1.html) — PWM, limits/probe, feed-control buttons, touch plate
- [Demon Shield soak playbook](../demon-shield-soak-playbook.md) — home, `$3`, soft limits, Z probe, Abort/Hold/Resume, PWM
- [Demon Shield external controls](../demon-shield-controls.md) — how SharpCNC mirrors Abort / Hold / Resume
- [Google Drive setup](../google-drive-setup.md) — OAuth client ID for native Drive (optional; watched folder works without it)
- [Getting started (Pages)](../index.html) — download, what to open, first steps
