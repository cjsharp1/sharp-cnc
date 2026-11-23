# SharpCNC testing handoff (first real-machine cut)

For **Chris** before the first wood cut on Demon Shield. Brand: **SharpCNC**.

Companion Context copy: open `docs/testing-handoff.md` in the Project store when working from Cursor Context.

---

## 0. Before you touch the machine

On any PC with the repo:

```bash
npm ci
npm run smoke:critical   # PR / CI gate
npm run smoke            # full suite before tagging
```

Both must exit **0**. Critical now covers calibration, **bed travel test**, **stock perimeter**, overrides, first-run order, job recovery, **real GRBL protocol fixtures + mock-vs-firmware diffs** (`smoke-real-grbl`; see [mock-vs-real-grbl.md](mock-vs-real-grbl.md)), plus the full mock connect → home → probe → SVG/sim → dry-run → M6 → overrides → alarm → E-stop path (`smoke-app-safety`).

If smokes fail: **do not cut**. Fix or roll back first.

---

## 1. How to run the desktop app

### A — Dev next to the CNC (USB)

Windows PC with Node 20+, Rust, WebView2:

```powershell
npm ci
npm run tauri dev
```

Uses native serial. Prefer this while iterating.

### B — Installer (shop floor)

1. Prefer a [GitHub Release](https://github.com/cjsharp1/sharp-cnc/releases/latest) NSIS `SharpCNC_*_x64-setup.exe`, or build locally (see below).
2. Install → launch **SharpCNC** from Start menu.
3. Unsigned personal builds may hit SmartScreen → **More info → Run anyway** only on a PC you trust.
4. **Later updates:** header version chip or **Menu → About & updates…** → **Install update & relaunch** (preferred). Fallback: download newer NSIS → quit → run setup **over the existing install**. Confirm the version chip after relaunch.

### C — Build the Windows installer yourself

Exact commands (Windows PowerShell):

```powershell
npm ci
npm run build:windows
# or:
.\scripts\build-windows-installer.ps1 -SkipInstall
```

Artifacts:

| Bundle | Path |
|--------|------|
| NSIS | `src-tauri/target/release/bundle/nsis/SharpCNC_*_x64-setup.exe` |
| MSI | `src-tauri/target/release/bundle/msi/` |

Full notes: [scripts/build-windows-installer.md](../scripts/build-windows-installer.md) · tag/`v*` CI: Actions → **Windows installer**.

### D — Browser mock only (no USB)

```bash
npm run dev
```

Good for UI practice. **Not** a substitute for soak or scrap.

---

## 2. Order of operations

Chris’s model — keep these separate:

0. **Connect (every session)** — Virtual CNC (practice) or COM → Linked. Visual: `docs/setup-visual/connect.html`.
1. **Calibrate (once per machine**, or after hardware change) — `$3` direction · steps/mm · soft travel · optional **Bed travel test**. Phase switcher → **Calibrate**. Visual: `docs/setup-visual/calibration.html`.
2. **Prepare → Verify → Run (every new job)** — Prepare (stock · Material XY · Z · load · Mark ready) → Verify (Simulate → Start) → Run. Visuals: `docs/setup-visual/prepare.html` · `verify.html` · `run.html`.

Do **not** skip calibration and jump straight to Prepare on a new or rewired machine. Prepare does not write `$3` / steps / soft travel.

### First-run bootstrap (fresh profile only)

On a fresh profile the app opens **SharpCNC · First run** to get you linked and into calibration:

1. **Connect** — refresh ports → COM → **Connect** at **115200** → wait for **Linked**
2. **Home** — clear bed → **Home ($H)** (zero-side switches only)
3. **Calibrate** — open Calibration for `$3` direction + steps/mm *(machine phase)*
4. **Travel** — measure bed → set soft max X/Y/Z → save (`$130`–`$132`, `$20`) *(still machine phase)*
5. **Stock seed** — optional starter sizes for the first job only; later jobs use **Prepare**

Finish or **Skip for now** (you can re-open setup later). Do not skip Home + Travel before soft-limit soak.

After soft travel is written (Calibration Done → **Bed travel test**, or **Menu → Bed travel test…**), run the full-bed corner walk once: clear the bed, confirm the gate, watch safe-Z retract then SW→SE→NE→NW with slow approach near each edge. Abort stays ready.

After stock origin + size are set (Prepare → XY or Material & tool), optional **Trace stock perimeter…**: plate removed / path clear, confirm gate, safe-Z then rectangle corners of the blank. Stop / Abort cancel jogs like bed travel.

---

## 3. Demon Shield soak

Stay at the machine. Hand on Abort / E-Stop.

Follow the playbook end-to-end and tick every sign-off box:

→ **[Demon Shield soak playbook](demon-shield-soak-playbook.md)**  
→ Short guide link: [user-guide/12-hardware-soak.md](user-guide/12-hardware-soak.md)

Order in the playbook: connect → home → `$3` → soft limits → Z probe → Abort/Hold/Resume → PWM.

---

## 4. Scrap cut checklist

Do this **after** soak sign-off, on scrap only.

1. **Simulate first** — load job (`.nc` / SVG) → **Simulate** path with spindle conceptually off; scrub / dry-run if unsure.
2. **Soft limits on** — `$20=1` and measured `$130`–`$132` (wizard Travel / Calibration).
3. **E-Stop known** — UI E-Stop + physical Abort; know which enclosure color is Abort.
4. **Prepare to run** (every job — after calibration is already done) — stock, tool, XY zero, Z probe plate thickness, plate **removed** after probe.
5. **Spindle clear** — bit clear of stock for first Start; start at low feed/spindle override if nervous.
6. **Dry air / scrap** — Start; one hand near Abort; Hold then Resume once; Abort once and Unlock only after cause is clear.
7. Only then cut the real part.

---

## 5. What “green” looks like before wood

| Check | Green means |
|-------|-------------|
| `npm run smoke:critical` | Exit 0 (also CI on PRs) |
| `npm run smoke` | Exit 0 before a `v*` tag |
| Linked | Essentials show **Linked**; live Work/Machine coords |
| Homed | Session homed; `$H` completed without wrong-way crash |
| `$3` | Jog +X/+Y/+Z matches pad + visualizer |
| Soft travel | Far rails refuse illegal jogs; numbers ≤ physical bed |
| Probe | `G38.2` contacts; Work Z correct; plate removed |
| Buttons | Abort / Hold / Resume match UI + Demon Shield map |
| PWM | `M3`/`M5` + overrides behave; spindle stops on Off |
| Sim | Job simulate completes without surprise rapids into stock |
| Recovery | If you Abort mid-job, Crash recovery panel offers a sane resume/discard path |
| Scrap | One successful scrap pass with soft limits on and E-Stop proven |

If any row is red: **stop**. Fix hardware/settings before wood.

---

## 6. Release / tag (when ready)

Checklist + notes template: [RELEASE.md](RELEASE.md)  
Draft notes for first tagged cut: [RELEASE-NOTES-v0.1.0-DRAFT.md](RELEASE-NOTES-v0.1.0-DRAFT.md)

```bash
# after version bump in package.json + tauri.conf.json + Cargo.toml
git tag -a v0.2.0 -m "SharpCNC v0.2.0"
git push origin v0.2.0
```

Wait for Actions **Windows installer** to attach the NSIS `.exe`, `.sig`, and `latest.json` before treating the Release as published (workflow keeps it draft until assets land). Do not hand-publish a source-only Release — the in-app updater would offer it with nothing to download.

---

## Related

- [01-install-and-run.md](user-guide/01-install-and-run.md)
- [11-safety.md](user-guide/11-safety.md)
- [demon-shield-controls.md](demon-shield-controls.md)
