# 1. Install & run (Windows)

SharpCNC’s primary shell is a **Windows desktop** app (Tauri). That is the path that talks to real USB serial on your Demon Shield / Arduino.

## What you need

- A Windows PC next to the machine (USB cable reach)
- [Node.js](https://nodejs.org/) **20+**
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) — on Windows that mainly means **WebView2** (usually already installed)
- This repo cloned locally

Optional later: a second PC can use a browser shell with mock serial for UI practice; real jogging still needs the desktop app.

## Install dependencies

From the repo root:

```bash
npm install
```

## Run the desktop app (real USB)

```bash
npm run tauri dev
```

That starts the Vite frontend and opens the SharpCNC window with native serial. Use this whenever you are connected to the CNC.

### Build a release binary

When you want a packaged app instead of the dev loop:

```bash
npm run tauri build
```

Tauri writes installers / binaries under `src-tauri/target/release/` (and bundle output under `src-tauri/target/release/bundle/` depending on target). Prefer `tauri dev` while iterating; use a release build when the machine PC should not run a full toolchain every day.

## Frontend-only (mock GRBL)

For UI smoke tests without hardware:

```bash
npm run dev
```

You get a mock port (including fake alarms / settings). There is **no USB**. Folder pick for external jobs also needs the desktop app.

## First launch checklist

1. Power the CNC / controller board safely.
2. Plug the USB cable into the PC.
3. Start SharpCNC with `npm run tauri dev` (or your release `.exe`).
4. Continue with [Connect](02-connect.md).

> **Safety:** Do not leave the spindle armed or the axes free to crash while you install software. Power the machine only when you are ready to connect and watch it.
