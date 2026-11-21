# SharpCNC

Personal GRBL controller for one custom CNC. Windows desktop first (Tauri + native serial); the same React UI will also run in Chrome/Edge with Web Serial later.

## Status

Desktop **USB serial connect + live MPos/WPos**, **jog / work zeros**, **G-code load / run**, **activity log / safety**, **guided calibration / soft travel**, **SVG → simple G-code**, plus **AI debug bridge**:

- List / refresh serial ports; connect at **115200** baud (Demon Shield / Arduino)
- Soft reset (`0x18`) on connect + manual Reset
- Live MPos / WPos with smoothed machine-view toolhead + short motion trail while jogging / running
- Pre-run **Simulate** (Job tab + visualizer overlay): play / pause / stop animates the tool along the loaded path without serial motion
- Jog X/Y/Z with an 8-way XY pad (cardinals + all diagonals) via GRBL `$J=` — step or hold modes, step size + feed
- Soft-limit awareness from known travel (default X/Y **1000 mm**; Z unset until calibrated)
- Work zeros via `G10 L20` (per-axis or XYZ); go-to-zero with confirm (safe Z-up then XY)
- Load `.nc` / `.gcode` (picker + drag-drop); stream with Start / Pause (`!`) / Resume (`~`) / Stop (soft reset)
- Progress (line / %) and toolpath overlay on the machine view
- Live activity log (TX/RX + events); categories; clear / filter / export text+JSON / copy last N
- Optional **debug bridge** (desktop): localhost `127.0.0.1:17832` read-only status + logs for a same-machine Cursor agent — see project docs `debug-bridge.md`
- Safety: prominent E-Stop (feed hold + soft reset), Hold / Resume / Reset / Unlock (`$X`)
- Alarm banner + refuse jog / job start while locked; job soft-limit gate before start
- **Calibration:** Menu → Calibration… opens a stepped wizard (zero context → steps/mm → soft travel → manual `$$` / `$x=value`); not always-on chrome
- **Steps/mm:** known move → measured → write `$100`/`$101`/`$102` with before/after
- **Soft travel:** enter or use current MPos for max X/Y/Z → write `$130`–`$132`, enable `$20`; bed size persisted for the visualizer
- **SVG drop-in:** load `.svg` → path preview on the machine view → engrave/outline G-code (feed, depth, plunge; bit Ø from tool settings) → hand off to the job runner (one job at a time; not full CAM)
- **Material & tool:** stock width/length/thickness + bed offset (or SW/SE/NW/NE corner); bit type + diameter (V-bit tip angle); shown on the visualizer; persisted; Job tab + Menu
- **External jobs:** Menu → External jobs… (Job tab strip) — pick a **watched local folder** (`.nc` / `.gcode` / `.svg`), auto-refresh, open into the existing Job / SVG loaders; path persisted. **Google Drive** UI + OAuth scaffolding when `VITE_GOOGLE_DRIVE_CLIENT_ID` is set — see [docs/google-drive-setup.md](docs/google-drive-setup.md). Until then, point the watched folder at Drive for Desktop / USB / network.

Browser / cloud shells without Tauri use a **mock GRBL** port (including `$Alarm` / `$X`, `$$` / `$n=`). Web Serial parity is still stubbed. Folder pick requires the desktop app.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS  
  - **Windows:** WebView2 (usually present)  
  - **Linux:** `webkit2gtk` / related GTK deps (see Tauri docs)  
  - **macOS:** Xcode CLT

## Run (desktop)

```bash
npm install
npm run tauri dev
```

That starts the Vite frontend and opens the Tauri window with real USB serial.

Frontend-only (mock serial for smoke tests):

```bash
npm run dev
```

## Browser / Web Serial

Not wired yet. The plan is to reuse this React UI with a Web Serial transport under `src/grbl/webSerial.ts` for Chrome/Edge when the usual PC isn’t available.

## Layout

| Path | Role |
|------|------|
| `src/` | React + TypeScript UI |
| `src/grbl/` | Shared GRBL client, status parser, desktop / mock / Web Serial transports |
| `src-tauri/` | Tauri 2 / Rust desktop shell + `serialport` USB backend |

## Smoke checks (no hardware)

```bash
npm run smoke
```

## Build order (high level)

1. Scaffold — Tauri + React + GRBL stubs  
2. Desktop serial connect + status / position streaming  
3. Jog / zero + machine view  
4. G-code load and streaming sender  
5. Web Serial parity  
6. SVG → simple cut/engrave → G-code ← **this**  
7. Calibration wizard + soft travel setup  
8. Activity log + safety controls  
9. Debug bridge (structured export + localhost agent status) ← **this**  
10. External Demon Shield buttons  
