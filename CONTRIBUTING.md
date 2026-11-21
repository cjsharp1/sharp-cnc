# Contributing to SharpCNC

SharpCNC is a **personal** GRBL controller for one custom CNC. Outside contributions are welcome for clear bugs and small fixes, but scope stays narrow: one machine, USB serial / Demon Shield, no multi-firmware CAM suite.

## Before you start

1. Read the [user guide](docs/user-guide/README.md) and the [project README](README.md).
2. Prefer issues that match the current product (connect, jog, jobs, calibration, safety, docs).
3. Keep the workshop steel + brass theme tokens in `src/theme.css` (and the mirrored copy under `docs/css/theme.css` for GitHub Pages).

## Dev loop

```bash
npm install
npm run tauri dev    # real USB serial (desktop)
npm run dev          # mock GRBL in the browser
npm run smoke        # no-hardware checks
```

## Pull requests

- Branch from latest `main`.
- Keep PRs focused; include a short “how to verify” note.
- Update the user guide when behavior or UI labels change.
- If you change theme tokens in `src/theme.css`, copy the same file to `docs/css/theme.css` so the Pages site stays in sync.
- Do not commit secrets (Drive client secrets, machine-specific paths, etc.).

## Docs site

The GitHub Pages site lives in `docs/` (`index.html`, `guide.html`, `css/`, `js/`). Serve it locally with any static server from the `docs/` folder, for example:

```bash
npx --yes serve docs -p 4177
```

Then open `http://localhost:4177/`.
