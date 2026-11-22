/**
 * Smoke: app version sync + GitHub Releases update check helpers (SC-68).
 * Mocks fetch — no live GitHub calls.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkLatestRelease,
  compareVersions,
  formatVersionLabel,
  isNewerVersion,
  normalizeVersion,
  parseGithubReleaseJson,
  pickNsisAsset,
  summarizeReleaseNotes,
} from "../src/grbl/appVersion.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// --- Version files stay in sync ---
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  version: string;
};
const tauri = JSON.parse(
  readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"),
) as {
  version: string;
  bundle?: { createUpdaterArtifacts?: boolean | string };
  plugins?: { updater?: { pubkey?: string; endpoints?: string[] } };
};
const cargoToml = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
const cargoMatch = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml);
assert(cargoMatch, "Cargo.toml missing package version");
assert(
  pkg.version === tauri.version && pkg.version === cargoMatch[1],
  `version mismatch: package.json=${pkg.version} tauri.conf=${tauri.version} Cargo.toml=${cargoMatch[1]}`,
);
assert(normalizeVersion(pkg.version) === pkg.version, "package version should be bare semver");

assert(normalizeVersion("v0.1.0") === "0.1.0", "strip v");
assert(formatVersionLabel("0.1.0") === "v0.1.0", "label");
assert(compareVersions("0.1.0", "0.1.0") === 0, "equal");
assert(isNewerVersion("0.2.0", "0.1.0"), "0.2 > 0.1");
assert(isNewerVersion("0.1.1", "0.1.0"), "patch newer");
assert(!isNewerVersion("0.1.0", "0.1.0"), "same not newer");
assert(!isNewerVersion("0.0.9", "0.1.0"), "older not newer");
assert(isNewerVersion("1.0.0", "0.9.9"), "major newer");
assert(compareVersions("0.1.0-beta", "0.1.0") < 0, "prerelease older");

const sampleRelease = {
  tag_name: "v0.2.0",
  name: "SharpCNC v0.2.0",
  body: "## Highlights\n- Faster jog\n- Safer soft limits\n\n## Install\n- NSIS attached",
  html_url: "https://github.com/cjsharp1/sharp-cnc/releases/tag/v0.2.0",
  published_at: "2026-11-22T00:00:00Z",
  assets: [
    {
      name: "SharpCNC_0.2.0_x64-setup.exe",
      browser_download_url:
        "https://github.com/cjsharp1/sharp-cnc/releases/download/v0.2.0/SharpCNC_0.2.0_x64-setup.exe",
      size: 1_583_043,
    },
    {
      name: "SharpCNC_0.2.0_x64_en-US.msi",
      browser_download_url:
        "https://github.com/cjsharp1/sharp-cnc/releases/download/v0.2.0/SharpCNC_0.2.0_x64_en-US.msi",
      size: 2_281_472,
    },
  ],
};

const parsed = parseGithubReleaseJson(sampleRelease);
assert(parsed, "parse release");
assert(parsed.tagName === "v0.2.0", "tag");
assert(parsed.nsisAsset?.name === "SharpCNC_0.2.0_x64-setup.exe", "nsis pick");
assert(
  pickNsisAsset(parsed.assets)?.browserDownloadUrl.includes("x64-setup.exe"),
  "pick helper",
);
const summary = summarizeReleaseNotes(parsed.body);
assert(summary.includes("Faster jog"), "highlights in summary");
assert(!summary.includes("## Install"), "install section dropped from highlights extract");

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const update = await checkLatestRelease("0.1.0", {
  fetchImpl: async () => mockResponse(200, sampleRelease),
});
assert(update.status === "update-available", "detect update");
if (update.status === "update-available") {
  assert(update.latest.nsisAsset?.name.includes("setup.exe"), "nsis on update");
}

const current = await checkLatestRelease("0.2.0", {
  fetchImpl: async () => mockResponse(200, sampleRelease),
});
assert(current.status === "up-to-date", "up to date when equal");

const rate = await checkLatestRelease("0.1.0", {
  fetchImpl: async () => mockResponse(403, { message: "rate limit" }),
});
assert(rate.status === "error" && rate.reason === "rate-limit", "rate limit");

const offline = await checkLatestRelease("0.1.0", {
  fetchImpl: async () => {
    throw new TypeError("Failed to fetch");
  },
});
assert(offline.status === "error" && offline.reason === "offline", "offline");

const missing = await checkLatestRelease("0.1.0", {
  fetchImpl: async () => mockResponse(404, { message: "Not Found" }),
});
assert(missing.status === "error" && missing.reason === "not-found", "not found");

// UI copy contract: in-app install (no uninstall-first happy path)
const aboutSrc = readFileSync(
  join(root, "src/components/AboutUpdatePanel.tsx"),
  "utf8",
);
assert(
  /Install update & relaunch/i.test(aboutSrc),
  "About panel must offer Install update & relaunch",
);
assert(
  /over the existing install/i.test(aboutSrc),
  "About panel must keep NSIS over-existing-install fallback",
);
assert(
  !/uninstall.*then run the installer/i.test(aboutSrc),
  "About panel must not instruct uninstall-then-install as the happy path",
);

// Official Tauri updater config present
assert(
  tauri.bundle?.createUpdaterArtifacts === true,
  "tauri.conf bundle.createUpdaterArtifacts must be true",
);
const updater = (tauri as { plugins?: { updater?: Record<string, unknown> } })
  .plugins?.updater;
assert(updater && typeof updater.pubkey === "string" && updater.pubkey.length > 40, "updater pubkey");
const endpoints = updater.endpoints as string[] | undefined;
assert(
  Array.isArray(endpoints) &&
    endpoints.some((u) => /releases\/latest\/download\/latest\.json/.test(u)),
  "updater endpoints must include GitHub latest.json",
);

const libRs = readFileSync(join(root, "src-tauri/src/lib.rs"), "utf8");
assert(/tauri_plugin_updater/.test(libRs), "lib.rs registers updater plugin");
assert(/tauri_plugin_process/.test(libRs), "lib.rs registers process plugin");

const caps = JSON.parse(
  readFileSync(join(root, "src-tauri/capabilities/default.json"), "utf8"),
) as { permissions?: string[] };
assert(
  caps.permissions?.includes("updater:default"),
  "capabilities include updater:default",
);
assert(
  caps.permissions?.includes("process:default"),
  "capabilities include process:default",
);

const cargo = readFileSync(join(root, "src-tauri/Cargo.toml"), "utf8");
assert(/tauri-plugin-updater/.test(cargo), "Cargo.toml has updater");
assert(/tauri-plugin-process/.test(cargo), "Cargo.toml has process");

const pkgJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};
assert(
  pkgJson.dependencies?.["@tauri-apps/plugin-updater"],
  "npm dependency @tauri-apps/plugin-updater",
);
assert(
  pkgJson.dependencies?.["@tauri-apps/plugin-process"],
  "npm dependency @tauri-apps/plugin-process",
);

console.log("smoke-app-update: ok");
