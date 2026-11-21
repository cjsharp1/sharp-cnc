# SharpCNC

Personal GRBL controller for one custom CNC. Windows desktop first (Tauri + native serial); the same React UI will also run in Chrome/Edge with Web Serial later.

## Status

Desktop **USB serial connect + live MPos/WPos**, **jog / work zeros**, and **G-code load / run**:

- List / refresh serial ports; connect at **115200** baud (Demon Shield / Arduino)
- Soft reset (`0x18`) on connect + manual Reset
- Live MPos / WPos and machine-view tool marker
- Jog X/Y/Z (and XY+ diagonal) via GRBL `$J=` — step or hold modes, step size + feed
- Soft-limit awareness from known travel (default X/Y **1000 mm**; Z unset until calibrated)
- Work zeros via `G10 L20` (per-axis or XYZ); go-to-zero with confirm (safe Z-up then XY)
- Load `.nc` / `.gcode` (picker + drag-drop); stream with Start / Pause (`!`) / Resume (`~`) / Stop (soft reset)
- Progress (line / %) and toolpath overlay on the machine view
- Start blocked when disconnected or in Alarm

Browser / cloud shells without Tauri use a **mock GRBL** port that simulates jog, zero, and job motion so the UX can be exercised without hardware. Web Serial parity is still stubbed.

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
4. G-code load and streaming sender ← **this**  
5. Web Serial parity  
6. SVG → simple cut/engrave → G-code  

