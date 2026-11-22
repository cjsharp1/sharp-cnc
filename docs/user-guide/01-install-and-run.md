# 1. Install & run (Windows)

SharpCNC’s primary shell is a **Windows desktop** app (Tauri). That is the path that talks to real USB serial on your Demon Shield / Arduino.

## Option A — Download the installer (preferred)

1. Open the [docs download section](../index.html#download) or the [GitHub Releases](https://github.com/cjsharp1/sharp-cnc/releases) page.
2. Download the latest **NSIS** setup: `SharpCNC_*_x64-setup.exe`.
3. Run the installer (current-user install; no admin required for the default bundle).
4. Launch **SharpCNC** from the Start menu / desktop shortcut.
5. Continue with [Connect](02-connect.md).

If Windows SmartScreen warns on an **unsigned** personal build, choose **More info → Run anyway** only on a PC you trust. Signed release builds are optional and configured separately in CI.

MSI packages are also published when available — use them for managed / IT installs. Day-to-day shop use should prefer the NSIS `.exe`.

## Updating to a newer release

SharpCNC never auto-installs without confirmation. The header shows the installed version (e.g. `v0.3.0`); **Menu → About & updates…** checks [GitHub Releases](https://github.com/cjsharp1/sharp-cnc/releases/latest) and, when newer, shows What’s new.

**Preferred (desktop app with the in-app updater):** click **Install update & relaunch**. SharpCNC downloads the signed NSIS package from the Release, applies it in place (passive progress — no uninstall step), and restarts. Confirm the version chip after relaunch.

**Fallback / first hop from an older build:** download `SharpCNC_*_x64-setup.exe`, quit, and run it **over the existing install**. Uninstall first only if that upgrade fails.

Offline or GitHub rate-limit: the About panel says so and still offers **Open latest release**. Browser builds show the version and open the release page only (no in-app install).

## Option B — Build from source (dev PC)

### What you need

- A Windows PC next to the machine (USB cable reach)
- [Node.js](https://nodejs.org/) **20+**
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) — on Windows that mainly means **WebView2** (usually already installed)
- This repo cloned locally

### Install dependencies

From the repo root:

```bash
npm install
```

### Run the desktop app (real USB)

```bash
npm run tauri dev
```

That starts the Vite frontend and opens the SharpCNC window with native serial. Use this whenever you are iterating next to the CNC.

### Build a release installer locally

On a Windows machine with the same prerequisites:

```powershell
npm ci
npm run build:windows
```

Or:

```powershell
.\scripts\build-windows-installer.ps1
```

Tauri writes:

- NSIS: `src-tauri/target/release/bundle/nsis/`
- MSI: `src-tauri/target/release/bundle/msi/`

Full notes (CI tags, SmartScreen, signing): [scripts/build-windows-installer.md](../../scripts/build-windows-installer.md).

GitHub Actions can also produce the same artifacts: **Actions → Windows installer → Run workflow**, or push a `v*` tag for a Release upload.

## Frontend-only (Virtual CNC)

For UI smoke tests without hardware:

```bash
npm run dev
```

The Connect port list offers **Virtual CNC** (in-app GRBL simulator, including fake alarms / settings). There is **no USB** in this shell. The desktop app lists Virtual CNC alongside real COM ports. Folder pick for external jobs needs the desktop app.

## First launch checklist

1. Power the CNC / controller board safely.
2. Plug the USB cable into the PC.
3. Start SharpCNC (installer shortcut, or `npm run tauri dev`).
4. Continue with [Connect](02-connect.md).

> **Safety:** Do not leave the spindle armed or the axes free to crash while you install software. Power the machine only when you are ready to connect and watch it.
