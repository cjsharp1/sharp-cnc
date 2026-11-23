# SharpCNC release checklist

Use this before tagging a cut you will run on wood. Brand spelling: **SharpCNC**.

## 0. Preconditions

- [ ] Latest `main` is green (or your release branch is rebased onto it)
- [ ] Version bumped in `package.json`, `src-tauri/tauri.conf.json`, **and** `src-tauri/Cargo.toml` (keep them equal; `smoke-app-update` checks)
- [ ] User guide / Pages still match UI labels (phase switcher: Connect · Calibrate · Prepare · Verify · Run; Material vs Machine)
- [ ] No secrets in the tree (Drive client IDs stay in env / local `.env`)

## 1. Critical smoke gates (no hardware)

```bash
npm ci
npm run smoke:critical
```

Then the full suite:

```bash
npm run smoke
```

Both must exit 0. CI also runs `smoke:critical` on PRs (see `.github/workflows/smoke.yml`).

Critical smokes (pre-test pack):

| Script | Guards |
|--------|--------|
| `smoke-parse-status` | Status parsing / Ov: / Pn: |
| `smoke-jog-zero` | Soft limits + jog / zero helpers |
| `smoke-gcode-stream` | Streamer start / pause / stop |
| `smoke-activity-safety` | E-Stop / unlock / alarm paths |
| `smoke-calibration` | Steps/mm, `$3`, soft travel writes |
| `smoke-bed-travel` | Full-bed corner walk planner + mock jogs |
| `smoke-stock-perimeter` | Stock blank perimeter planner + mock jogs |
| `smoke-probe` | Z probe helpers |
| `smoke-spindle-feeds` | PWM + override math |
| `smoke-overrides-presets` | Persisted feed/spindle % + material presets |
| `smoke-external-controls` | Demon Shield Abort/Hold/Resume mirror |
| `smoke-first-run` | Wizard order connect→home→calibrate→travel→stock |
| `smoke-job-recovery` | Mid-job checkpoint persist / resume label |
| `smoke-app-safety` | Mock connect → home → probe → SVG/sim → dry-run → M6 → overrides → alarm → E-stop |
| `smoke-app-update` | package/tauri/Cargo version sync + mocked GitHub Releases check + updater plugin config |

## 2. Desktop installer

- [ ] Windows: `npm run build:windows` **or** Actions → **Windows installer**
- [ ] Install NSIS `.exe` on a clean-ish PC; app launches; COM ports list
- [ ] Docs `#download` still points at [Releases](https://github.com/cjsharp1/sharp-cnc/releases)

## 3. Hardware soak (Demon Shield)

Run [demon-shield-soak-playbook.md](demon-shield-soak-playbook.md) sign-off:

- [ ] Home / `$3` / soft travel / Z probe / Abort·Hold·Resume / PWM

## 4. Tag & GitHub Release

```bash
# example
git tag -a v0.2.0 -m "SharpCNC v0.2.0"
git push origin v0.2.0
```

Tag `v*` triggers the Windows installer workflow. That job builds NSIS/MSI **with updater signatures**, attaches them (plus `latest.json` + `.sig`) to a **draft** Release, then **publishes (undrafts) only after** the `.exe`, `.sig`, and `latest.json` are on the Release.

**Required repo secret (once):** `TAURI_SIGNING_PRIVATE_KEY` — the Tauri minisign private key matching the `plugins.updater.pubkey` in `tauri.conf.json`. Optional: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key is password-protected. Without the private key, tagged installer builds fail on purpose (in-app updates would be unsigned).

**Do not** `gh release create` (or publish) a source-only Release before CI finishes. Prefer either:

1. Push the tag and let Actions create + publish the Release with assets, **or**
2. `gh release create vX.Y.Z --draft --notes-file …` early for notes, then wait for CI to attach installers and undraft (or undraft yourself once the `.exe` is present).

Never leave `/releases` or `/releases/latest` pointing at a published cut with no installer / no `latest.json` — Chris’s in-app updater would offer a useless or unverifiable update.

### Release notes template

Copy into the GitHub Release body (edit the bullets):

```markdown
## SharpCNC vX.Y.Z

Personal GRBL controller for one custom CNC (Demon Shield / USB).

### Install
- Windows NSIS: `SharpCNC_*_x64-setup.exe` (attached)
- Docs: https://cjsharp1.github.io/sharp-cnc/#download

### Highlights
- …
- …

### Smoke / soak
- [x] `npm run smoke:critical` (CI)
- [x] `npm run smoke` (local)
- [ ] Hardware soak playbook signed off on the machine

### Notes
- Unsigned builds may show SmartScreen — More info → Run anyway on trusted PCs only.
- Out of scope this release: Wi-Fi, multi-machine, generic CAM.
```

## 5. After release

- [ ] Spot-check Pages download + guide links
- [ ] Cut scrap before the real part
- [ ] File follow-ups for anything skipped in the soak

## Related

- [TESTING-HANDOFF.md](TESTING-HANDOFF.md) — Chris’s first-machine checklist
- [RELEASE-NOTES-v0.1.0-DRAFT.md](RELEASE-NOTES-v0.1.0-DRAFT.md)
- [scripts/build-windows-installer.md](../scripts/build-windows-installer.md)
- [user-guide/12-hardware-soak.md](user-guide/12-hardware-soak.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
