# SharpCNC

Personal GRBL controller for one custom CNC. Windows desktop first (Tauri + native serial); the same React UI will also run in Chrome/Edge with Web Serial later.

This repo is an early scaffold: UI shell + shared GRBL client stubs. Serial, jog, job streaming, and SVG paths come next.

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

That starts the Vite frontend and opens the Tauri window.

Frontend-only (no native shell):

```bash
npm run dev
```

## Browser / Web Serial

Not wired yet. The plan is to reuse this React UI with a Web Serial transport stub under `src/grbl/webSerial.ts` for Chrome/Edge when the usual PC isn’t available.

## Layout

| Path | Role |
|------|------|
| `src/` | React + TypeScript UI |
| `src/grbl/` | Shared GRBL types, transport interface, desktop & Web Serial stubs |
| `src-tauri/` | Tauri 2 / Rust desktop shell |

## Build order (high level)

1. Scaffold (this) — Tauri + React + GRBL stubs  
2. Desktop serial connect + status / position streaming  
3. Jog / zero + machine view  
4. G-code load and streaming sender  
5. Web Serial parity  
6. SVG → simple cut/engrave → G-code  
