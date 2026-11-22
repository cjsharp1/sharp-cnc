# SharpCNC user guide

Friendly, practical docs for running **one** home CNC: Chris’s custom Demon Shield + Arduino + GRBL over USB, controlled from SharpCNC on Windows.

**Scope:** SharpCNC is a dedicated personal controller for that specific machine. Calibrate once, then for every job connect/home as needed, **load** the file, prepare (stock + zeros + Z probe), verify on the bed, simulate, and run. It is **not** a multi-machine CAM suite or Universal Gcode Sender replacement, and there is **no intention** to support other CNCs, controllers, or firmwares.

**Browse on GitHub Pages** (same workshop fonts as the app): [docs home](../index.html) · [this guide in the viewer](../guide.html) · **[visual setup](../setup-visual/index.html)**

## Order of operations

1. **[Calibration](05-calibration.md)** — once per machine (or after hardware change): `$3` direction · steps/mm · soft travel · optional bed travel test. Visual: [calibration](../setup-visual/calibration.html).
2. **[Per-job prepare](07-prepare-and-z-probe.md)** — every new job: connect · home as needed · **load G-code/SVG** · stock · XY work zero · Z probe · verify on bed · Simulate · then cut. Visual: [prepare](../setup-visual/prepare.html) · [load step](../setup-visual/prepare.html#p1).

Fresh install bootstrap (connect → home → into calibration): [First-run](../setup-visual/first-run.html). Do not treat Prepare as a substitute for calibration.

## How to use this guide

**First time on the machine:** finish [calibration](../setup-visual/calibration.html) (via [first-run](../setup-visual/first-run.html) if needed), then use [prepare](../setup-visual/prepare.html) for the first cut. Come back to these chapters for short reference tables.

Safety notes appear throughout. When something can crash the machine or hurt you, it is called out explicitly — take those seriously.

## Chapters

| # | Chapter | What you learn |
|---|---------|----------------|
| 1 | [Install & run](01-install-and-run.md) | Windows installer, `npm run tauri dev`, mock UI |
| 2 | [Connect](02-connect.md) | COM ports + [first-run bootstrap](../setup-visual/first-run.html) |
| — | [Calibration visual](../setup-visual/calibration.html) | **Once** · `$3` · steps/mm · soft travel · bed test |
| — | [Prepare visual](../setup-visual/prepare.html) | **Every job** · load · stock · zeros · Z probe |
| 3 | [Understanding the UI](03-understanding-the-ui.md) | Essentials strip, visualizer, Move / Job / Log, Menu |
| 4 | [Jogging & zeros](04-jogging-and-zeros.md) | Jog, home, G54–G59, XY probe, console, overrides |
| 5 | [Calibration](05-calibration.md) | Short appendix · prefer [visual](../setup-visual/calibration.html) |
| 6 | [Material & tool](06-material-and-tool.md) | Stock size, bed corners, bit diameter |
| 7 | [Prepare to run & Z probe](07-prepare-and-z-probe.md) | Every-job pre-start, touch plate, G38.2 |
| 8 | [Jobs, SVG & run](08-jobs-and-svg.md) | Load G-code / SVG, simulate, start / pause / stop |
| 9 | [External jobs](09-external-jobs.md) | Watched folder + Drive setup pointer |
| 10 | [Debug bridge](10-debug-bridge.md) | Debug mode, logs, export, localhost agent status |
| 11 | [Safety](11-safety.md) | E-Stop, alarms, unlock, good habits |
| 12 | [Hardware soak](12-hardware-soak.md) | Demon Shield home, `$3`, soft limits, probe, buttons, PWM |

## Quick start (experienced)

1. Install from [Releases](https://github.com/cjsharp1/sharp-cnc/releases/latest), or `npm install` then `npm run tauri dev` on the Windows PC next to the CNC.
2. **Calibration (once):** **Menu → Calibration…** — `$3`, steps/mm, soft travel (optional bed travel test). Fresh profile: **First-run** bootstraps connect → home → into that wizard.
3. **Every job:** Plug USB → **Connect** → **Home** as needed → load a job → **Prepare to run…** (stock, XY + Z probe) → **Simulate** → **Start**.

## Screenshots & diagrams

Illustrations live in [`assets/`](assets/). Diagrams are SVG (easy to read at a glance). Screenshots are from the current desktop UI.

## Related project docs

- [Demon Shield vendor page](https://www.designsbyphil.com/demon-shield-1.html) — PWM, limits/probe, feed-control buttons, touch plate
- [Demon Shield soak playbook](../demon-shield-soak-playbook.md) — home, `$3`, soft limits, Z probe, Abort/Hold/Resume, PWM
- [Demon Shield external controls](../demon-shield-controls.md) — how SharpCNC mirrors Abort / Hold / Resume
- [Google Drive setup](../google-drive-setup.md) — OAuth client ID for native Drive (optional; watched folder works without it)
- [Getting started (Pages)](../index.html) — download, what to open, first steps
