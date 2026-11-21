# SharpCNC

Personal GRBL controller for one custom CNC. Windows desktop first (Tauri + native serial); the same React UI will also run in Chrome/Edge with Web Serial later.

## Status

Desktop **USB serial connect + live MPos/WPos** is wired:

- List / refresh serial ports
- Connect / disconnect at **115200** baud (Demon Shield / Arduino)
- Soft reset (`0x18`) on connect + manual Reset
- Parse GRBL `<…|MPos:…|WPos:…|WCO:…>` status reports
- Live work + machine coordinates and machine-view tool marker

Browser / cloud shells without Tauri use a **mock GRBL** port so the UX can be exercised without hardware. Web Serial parity is still stubbed.

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

## Build order (high level)

1. Scaffold — Tauri + React + GRBL stubs  
2. Desktop serial connect + status / position streaming ← **this**  
3. Jog / zero + machine view  
4. G-code load and streaming sender  
5. Web Serial parity  
6. SVG → simple cut/engrave → G-code  
