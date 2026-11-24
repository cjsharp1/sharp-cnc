# Contributing to SharpCNC

SharpCNC is a **personal** GRBL controller for Chris’s custom Demon Shield + GRBL CNC. Outside contributions are welcome for clear bugs and small fixes, but scope stays narrow: **one machine only**, USB serial / Demon Shield, no multi-machine CAM suite or UGS replacement — and no intention to support other controllers or firmwares.

## Before you start

1. Read the [user guide](docs/user-guide/README.md) and the [project README](README.md).
2. Prefer issues that match the current product (connect, jog, jobs, calibration, safety, docs).
3. Keep the workshop steel + brass theme tokens in `src/theme.css` (and the mirrored copy under `docs/css/theme.css` for GitHub Pages).

## Dev loop

```bash
npm install
npm run tauri dev    # real USB serial (desktop)
npm run dev          # mock GRBL in the browser
npm run smoke:critical  # PR gate (CI)
npm run smoke           # full no-hardware suite
```

Virtual CNC is not bit-identical to GRBL 1.1h. Read [docs/mock-vs-real-grbl.md](docs/mock-vs-real-grbl.md) before trusting mock-only safety coverage. Use `createMockTransport({ strict: true })` (or `sharpcnc.mock.strictGrbl.v1`) when a smoke must match real hold/jog/error codes; `smoke-real-grbl` already runs both modes.

## Pull requests

- Branch from latest `main`.
- Keep PRs focused; include a short “how to verify” note.
- Update the user guide when behavior or UI labels change.
- If you change theme tokens in `src/theme.css`, copy the same file to `docs/css/theme.css` so the Pages site stays in sync.
- Do not commit secrets (Drive client secrets, machine-specific paths, etc.).
- Before a tagged cut, follow [docs/RELEASE.md](docs/RELEASE.md) (version bump, smokes, soak, release notes).

## Docs site

The GitHub Pages site lives in `docs/` (`index.html`, `guide.html`, `css/`, `js/`). Serve it locally with any static server from the `docs/` folder, for example:

```bash
npx --yes serve docs -p 4177
```

Then open `http://localhost:4177/`.
