# SharpCNC user guide

Friendly, practical docs for running **one** home CNC: Demon Shield + Arduino + GRBL over USB, controlled from SharpCNC on Windows.

SharpCNC is a personal controller — connect, see where the tool is, jog and zero, calibrate, load a job, simulate, then run. It is not a multi-machine CAM suite.

## How to use this guide

Read chapters in order the first time you set up the machine. After that, jump to the chapter you need (calibration, jobs, alarms, etc.).

Safety notes appear throughout. When something can crash the machine or hurt you, it is called out explicitly — take those seriously.

## Chapters

| # | Chapter | What you learn |
|---|---------|----------------|
| 1 | [Install & run](01-install-and-run.md) | Prerequisites, `npm run tauri dev`, mock UI |
| 2 | [Connect](02-connect.md) | COM ports, 115200 baud, Linked status |
| 3 | [Understanding the UI](03-understanding-the-ui.md) | Essentials strip, visualizer, Move / Job / Log, Menu |
| 4 | [Jogging & zeros](04-jogging-and-zeros.md) | Jog pad, soft limits, work zeros, go-to-zero |
| 5 | [Calibration wizard](05-calibration.md) | Zero → steps/mm → soft travel → manual settings |
| 6 | [Material & tool](06-material-and-tool.md) | Stock size, bed corners, bit diameter |
| 7 | [Jobs, SVG & run](07-jobs-and-svg.md) | Load G-code / SVG, simulate, start / pause / stop |
| 8 | [External jobs](08-external-jobs.md) | Watched folder + Drive setup pointer |
| 9 | [Debug bridge](09-debug-bridge.md) | Debug mode, logs, export, localhost agent status |
| 10 | [Safety](10-safety.md) | E-Stop, alarms, unlock, good habits |

## Quick start (experienced)

1. `npm install` then `npm run tauri dev` on the Windows PC next to the CNC.
2. Plug USB → **Refresh** ports → pick COM → **Connect** (115200).
3. Confirm **Linked** and live Work / Machine coordinates.
4. Menu → **Calibration…** once, so soft travel matches the real bed.
5. Set **Material & tool**, load a job, **Simulate**, then **Start**.

## Screenshots & diagrams

Illustrations live in [`assets/`](assets/). Diagrams are SVG (easy to read at a glance). Screenshots are from the current desktop UI.

## Related project docs

- [Google Drive setup](../google-drive-setup.md) — OAuth client ID for native Drive (optional; watched folder works without it)
