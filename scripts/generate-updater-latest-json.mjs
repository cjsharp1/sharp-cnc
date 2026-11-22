#!/usr/bin/env node
/**
 * Build Tauri updater `latest.json` for SharpCNC Windows NSIS.
 *
 * Usage (after release assets exist locally or after downloading .sig):
 *   node scripts/generate-updater-latest-json.mjs \
 *     --version 0.3.1 \
 *     --nsis-url https://github.com/cjsharp1/sharp-cnc/releases/download/v0.3.1/SharpCNC_0.3.1_x64-setup.exe \
 *     --sig-file path/to/SharpCNC_0.3.1_x64-setup.exe.sig \
 *     --out latest.json
 *
 * Or with --sig-text for the literal signature string.
 */
import { readFileSync, writeFileSync } from "node:fs";

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const version = arg("--version");
const nsisUrl = arg("--nsis-url");
const sigFile = arg("--sig-file");
const sigText = arg("--sig-text");
const notes = arg("--notes", "");
const out = arg("--out", "latest.json");

if (!version || !nsisUrl || (!sigFile && !sigText)) {
  console.error(
    "Usage: generate-updater-latest-json.mjs --version X.Y.Z --nsis-url URL (--sig-file PATH | --sig-text SIG) [--notes TEXT] [--out latest.json]",
  );
  process.exit(1);
}

const signature = (sigText ?? readFileSync(sigFile, "utf8")).trim();
if (!signature) {
  console.error("Signature is empty");
  process.exit(1);
}

const manifest = {
  version: String(version).replace(/^v/i, ""),
  notes: notes || `SharpCNC ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: nsisUrl,
    },
  },
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${out}`);
