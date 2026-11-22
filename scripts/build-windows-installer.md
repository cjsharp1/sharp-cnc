# Build the SharpCNC Windows installer

SharpCNC ships as a **Tauri 2** desktop app. The preferred end-user artifact is an **NSIS** `.exe` installer (optional **MSI**). Full signed builds need a Windows runner; this cloud Linux environment cannot produce the `.exe` itself.

## Quick path (Windows PC)

Prerequisites:

- [Node.js](https://nodejs.org/) **20+**
- [Rust](https://www.rust-lang.org/tools/install) stable
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually already installed)
- [Tauri 2 Windows prerequisites](https://v2.tauri.app/start/prerequisites/)

From the repo root in **PowerShell**:

```powershell
npm ci
.\scripts\build-windows-installer.ps1 -SkipInstall
```

Or the npm alias:

```powershell
npm run build:windows
```

Output (typical):

| Bundle | Path |
|--------|------|
| NSIS installer | `src-tauri/target/release/bundle/nsis/SharpCNC_*_x64-setup.exe` |
| MSI | `src-tauri/target/release/bundle/msi/SharpCNC_*_x64_en-US.msi` |
| Raw exe | `src-tauri/target/release/sharpnc.exe` |

Copy the NSIS `.exe` to the machine PC and install. No Node/Rust required on the shop floor after that.

## CI path (GitHub Actions)

Workflow: [`.github/workflows/windows-installer.yml`](../.github/workflows/windows-installer.yml)

Triggers:

- **Manual:** Actions → *Windows installer* → Run workflow
- **Version tags:** push `v*` (e.g. `v0.2.0`) → builds installers, attaches them to a **draft** GitHub Release, then publishes only after the NSIS `.exe` is present

Do **not** publish a source-only Release by hand before that job finishes — the in-app updater would see a newer tag with nothing to download. If you need notes early, create a **draft** Release (`gh release create … --draft`) and let CI attach + undraft.

Download the `windows-installer` artifact (or Release assets) and put the link on the [docs download section](../docs/index.html#download).

Code signing is **not** configured by default. Windows SmartScreen may warn on first run of an unsigned personal build — choose *More info → Run anyway* for machines you trust. To add signing later, set Tauri `bundle.windows.certificateThumbprint` / CI secrets; do not commit PFXs.

## Dev loop (no installer)

```bash
npm install
npm run tauri dev
```

## Verify without hardware

```bash
npm run smoke
```
