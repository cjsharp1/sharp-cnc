# SharpCNC v0.1.0 — release notes draft

Copy into the GitHub Release body when tagging. Adjust version / date if you bump past `0.1.0`.

**Do not tag until:** `npm run smoke:critical` + `npm run smoke` are green, and you are ready for Chris’s hardware soak (installer can land unsigned).

---

## SharpCNC v0.1.0

Personal GRBL controller for one custom CNC (Demon Shield / USB). First tagged cut aimed at a real-machine soak and scrap before wood.

### Install

- Windows NSIS: `SharpCNC_*_x64-setup.exe` (attached when CI/tag build finishes)
- Docs / download: https://cjsharp1.github.io/sharp-cnc/#download
- Dev next to the machine: `npm ci` then `npm run tauri dev`

### Build the installer on Windows (if CI artifact is missing)

```powershell
npm ci
npm run build:windows
# or: .\scripts\build-windows-installer.ps1 -SkipInstall
```

Outputs under `src-tauri/target/release/bundle/nsis/` and `msi/`.  
Details: [scripts/build-windows-installer.md](../scripts/build-windows-installer.md).

### Highlights

- USB serial link + live Work/Machine position
- Move / Probe / Job workspace with jog, soft limits, Z + XY probe
- SVG drop-in → simple toolpath, path simulate (speed / Z cues), job dry-run
- First-run wizard: connect → home → calibrate → soft travel → stock
- Calibration wizard including `$3` axis direction invert
- Feed / spindle overrides + material presets (persisted)
- Demon Shield Abort / Hold / Resume mirrored in the UI
- Crash / mid-job recovery checkpoint UX
- Activity log, Debug mode, safety unlock / E-stop paths
- GitHub Pages user guide + hardware soak playbook

### Smoke / soak

- [x] `npm run smoke:critical` (CI on PRs + this pack)
- [x] `npm run smoke` (full suite before tag)
- [ ] Hardware soak playbook signed off on the machine — [demon-shield-soak-playbook.md](demon-shield-soak-playbook.md)
- [ ] Scrap cut with soft limits on and E-Stop proven — [TESTING-HANDOFF.md](TESTING-HANDOFF.md)

### Tag checklist

1. Bump `version` in `package.json` **and** `src-tauri/tauri.conf.json` (keep equal).
2. Confirm `main` green; merge pretest / docs PRs you want in the tag.
3. `npm run smoke:critical && npm run smoke`
4. Tag and push:

```bash
git tag -a v0.1.0 -m "SharpCNC v0.1.0"
git push origin v0.1.0
```

5. Confirm Actions **Windows installer** attached the NSIS/MSI to the Release (or upload the local build).
6. Paste these notes into the Release body; tick soak/scrap after Chris signs off.

### Notes

- Unsigned builds may show SmartScreen — **More info → Run anyway** on trusted PCs only.
- Out of scope this release: Wi-Fi, multi-machine, generic CAM.
- Ikea-style visual setup docs (if still open) are docs-only; smoke does not depend on them.
