# SharpCNC

Personal GRBL controller for one custom CNC. **Windows desktop first** (Tauri + native USB serial); the same React UI also runs in the browser with mock GRBL for practice.

**Docs site (GitHub Pages):** after Pages is enabled from the `docs/` folder → [cjsharp1.github.io/sharp-cnc](https://cjsharp1.github.io/sharp-cnc/)  
**User guide (in repo):** [docs/user-guide/](docs/user-guide/)

## Getting started

### 1. Download (Windows installer)

Prefer a packaged install on the machine PC:

- [Latest GitHub Release](https://github.com/cjsharp1/sharp-cnc/releases/latest) — NSIS `SharpCNC_*_x64-setup.exe`
- Docs landing download section: [cjsharp1.github.io/sharp-cnc/#download](https://cjsharp1.github.io/sharp-cnc/#download)

**Updating day-to-day:** in SharpCNC, check the header version chip or **Menu → About & updates…**. If a newer GitHub Release exists, quit the app and run the newer NSIS setup **over the existing install** (no uninstall needed). Uninstall first only if that upgrade fails. SmartScreen on unsigned personal builds: **More info → Run anyway** only on a PC you trust. Browser/`npm run dev` shows the version and can open the release page only.

Build locally on Windows (`npm run build:windows`) or via **Actions → Windows installer** / a `v*` tag. Details: [scripts/build-windows-installer.md](scripts/build-windows-installer.md).

Or clone for development:

```bash
git clone https://github.com/cjsharp1/sharp-cnc.git
cd sharp-cnc
```

### 2. Prerequisites (source / `tauri dev`)

- [Node.js](https://nodejs.org/) **20+**
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/)  
  - **Windows:** WebView2 (usually already installed)  
  - **Linux:** `webkit2gtk` / related GTK deps  
  - **macOS:** Xcode CLT

### 3. Install and open the app (dev)

```bash
npm install
npm run tauri dev
```

That starts the Vite frontend and opens the SharpCNC **desktop** window with real USB serial. This is what you use next to the machine while iterating.

Frontend-only (mock serial, no USB):

```bash
npm run dev
```

### 4. First things to do

**Order:** calibrate the machine once, then prepare every job.

1. Power the CNC safely and plug USB into the Demon Shield / Arduino.
2. In SharpCNC: **Refresh** ports → pick COM → **Connect** at **115200** baud.
3. Confirm **Linked** and live Work / Machine coordinates.
4. **Calibration (once):** **Menu → Calibration…** — `$3`, steps/mm, soft travel (optional bed travel test). Fresh profile: First-run bootstraps connect → home → into that wizard.
5. **Every job:** load a `.nc` / `.gcode` (or SVG) → **Prepare to run…** (stock, XY + Z probe) → **Simulate** → **Start**.

Full walkthrough with screenshots: [docs/user-guide/](docs/user-guide/) or the [Pages guide](https://cjsharp1.github.io/sharp-cnc/guide.html).

## What works today

- USB serial connect + live MPos/WPos; jog / work zeros; G-code load & run
- Live machine view (toolhead + path); pre-run simulate
- Activity log, E-Stop / Hold / Unlock, alarm surfacing
- Guided calibration + soft travel; SVG → simple engrave/outline G-code
- Material & tool, prepare / Z probe wizard, spindle & feed overrides
- External Demon Shield start / pause / stop mirroring
- Optional watched jobs folder + Drive scaffolding; AI debug bridge (desktop, Debug mode)

Web Serial for a second PC is still stubbed; mock GRBL covers UI without hardware.

## Hardware

Controller: **Demon Shield** on Arduino + GRBL over USB.

- Vendor page: [Designs By Phil — Demon Shield](https://www.designsbyphil.com/demon-shield-1.html)
- Hardware soak playbook: [docs/demon-shield-soak-playbook.md](docs/demon-shield-soak-playbook.md)
- In-repo button mapping: [docs/demon-shield-controls.md](docs/demon-shield-controls.md)

## Docs & Pages

| Path | Role |
|------|------|
| [docs/index.html](docs/index.html) | GitHub Pages landing + download + getting started |
| [scripts/build-windows-installer.md](scripts/build-windows-installer.md) | Local / CI Windows NSIS+MSI build notes |
| [docs/guide.html](docs/guide.html) | Themed Markdown viewer for the user guide |
| [docs/user-guide/](docs/user-guide/) | Chapter source (install → safety) |
| [docs/css/theme.css](docs/css/theme.css) | Theme tokens mirrored from `src/theme.css` |

**Recommended Pages setup:** **Settings → Pages → Deploy from a branch → `main` / `/docs`**.

That publishes the docs site at the repo Pages root (so `guide.html` is at `/guide.html`, not under a blank Vite shell). Keep [docs/.nojekyll](docs/.nojekyll) so Jekyll does not process the site and omit raw Markdown under `user-guide/` (the guide viewer fetches those `.md` files as static assets). A root [`.nojekyll`](.nojekyll) is also present for the case where Pages source is still the repo `/` root.

Preview locally:

```bash
npm run pages:preview
```

## Layout

| Path | Role |
|------|------|
| `src/` | React + TypeScript UI |
| `src/grbl/` | Shared GRBL client, transports, settings |
| `src/theme.css` | Workshop steel + brass tokens (dark / light) |
| `src-tauri/` | Tauri 2 / Rust desktop shell + serial |
| `docs/` | User guide + GitHub Pages site |

## Smoke checks (no hardware)

Critical gates (also run on every PR via GitHub Actions):

```bash
npm run smoke:critical
```

Full suite before a tagged release:

```bash
npm run smoke
```

Release process / notes template: [docs/RELEASE.md](docs/RELEASE.md).  
First real-machine handoff: [docs/TESTING-HANDOFF.md](docs/TESTING-HANDOFF.md).

## License & contributing

- [LICENSE](LICENSE) — MIT
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
