/**
 * App version + GitHub Releases update check (SC-68).
 *
 * Current version comes from the Vite-injected package.json value (kept in sync
 * with `src-tauri/tauri.conf.json` / Cargo.toml by smoke). Desktop may also
 * read the Tauri bundle version via `@tauri-apps/api/app`.
 *
 * Updates are **manual**: we never auto-install. Desktop can open the NSIS
 * installer download; browser build only opens the release page.
 */

import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isDesktopShell } from "./session";

export const GITHUB_OWNER = "cjsharp1";
export const GITHUB_REPO = "sharp-cnc";
export const GITHUB_RELEASES_LATEST_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
export const GITHUB_API_LATEST_RELEASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/** Build-time version from package.json (Vite `define`). */
export function packagedAppVersion(): string {
  if (typeof __SHARPCNC_VERSION__ === "string" && __SHARPCNC_VERSION__.length > 0) {
    return __SHARPCNC_VERSION__;
  }
  return "0.0.0";
}

/** Normalize `v1.2.3` / `1.2.3` / `1.2.3-beta` → comparable parts. */
export function normalizeVersion(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^v/i, "")
    .split("+")[0]
    .trim();
}

type SemverParts = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
};

export function parseSemver(raw: string): SemverParts | null {
  const cleaned = normalizeVersion(raw);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-.]?(.*))?$/.exec(cleaned);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].toLowerCase() : "",
  };
}

/**
 * Compare two versions. Returns negative if a < b, 0 if equal, positive if a > b.
 * Prerelease is considered older than the same numeric triple without prerelease.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    return normalizeVersion(a).localeCompare(normalizeVersion(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (!pa.prerelease && !pb.prerelease) return 0;
  if (!pa.prerelease) return 1;
  if (!pb.prerelease) return -1;
  return pa.prerelease.localeCompare(pb.prerelease);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}

export function formatVersionLabel(raw: string): string {
  const n = normalizeVersion(raw);
  return n ? `v${n}` : "v?—";
}

export type ReleaseAsset = {
  name: string;
  browserDownloadUrl: string;
  size: number;
};

export type LatestReleaseInfo = {
  tagName: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string | null;
  nsisAsset: ReleaseAsset | null;
  assets: ReleaseAsset[];
};

export type UpdateCheckResult =
  | { status: "up-to-date"; current: string; latest: LatestReleaseInfo }
  | { status: "update-available"; current: string; latest: LatestReleaseInfo }
  | {
      status: "error";
      current: string;
      reason: "offline" | "rate-limit" | "not-found" | "invalid" | "unknown";
      message: string;
    };

type GithubAssetJson = {
  name?: string;
  browser_download_url?: string;
  size?: number;
};

type GithubReleaseJson = {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  html_url?: string;
  published_at?: string | null;
  assets?: GithubAssetJson[];
};

/** Prefer Windows NSIS setup exe from release assets. */
export function pickNsisAsset(assets: ReleaseAsset[]): ReleaseAsset | null {
  const nsis = assets.filter((a) =>
    /SharpCNC_.*_x64-setup\.exe$/i.test(a.name),
  );
  if (nsis.length > 0) return nsis[0];
  const fallback = assets.filter((a) => /x64-setup\.exe$/i.test(a.name));
  return fallback[0] ?? null;
}

export function parseGithubReleaseJson(data: unknown): LatestReleaseInfo | null {
  if (!data || typeof data !== "object") return null;
  const json = data as GithubReleaseJson;
  const tagName = typeof json.tag_name === "string" ? json.tag_name.trim() : "";
  if (!tagName) return null;
  const assets: ReleaseAsset[] = [];
  for (const raw of json.assets ?? []) {
    if (
      typeof raw?.name === "string" &&
      typeof raw?.browser_download_url === "string"
    ) {
      assets.push({
        name: raw.name,
        browserDownloadUrl: raw.browser_download_url,
        size: typeof raw.size === "number" ? raw.size : 0,
      });
    }
  }
  return {
    tagName,
    name: (json.name && String(json.name).trim()) || tagName,
    body: typeof json.body === "string" ? json.body : "",
    htmlUrl:
      typeof json.html_url === "string" && json.html_url.length > 0
        ? json.html_url
        : GITHUB_RELEASES_LATEST_URL,
    publishedAt:
      typeof json.published_at === "string" ? json.published_at : null,
    nsisAsset: pickNsisAsset(assets),
    assets,
  };
}

/** Truncate release body for a short “What’s new” summary. */
export function summarizeReleaseNotes(body: string, maxChars = 480): string {
  const trimmed = body.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "No release notes on GitHub for this tag.";
  // Prefer a Highlights / What's new section when present.
  const section =
    /(?:^|\n)#+\s*(?:highlights|what'?s new|changes)\s*\n([\s\S]*?)(?=\n#+\s|\n---|\s*$)/i.exec(
      `\n${trimmed}`,
    );
  const source = (section?.[1] ?? trimmed).trim();
  const plain = source
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars - 1).trimEnd()}…`;
}

export async function resolveAppVersion(): Promise<string> {
  if (isDesktopShell()) {
    try {
      const v = await getVersion();
      if (v && String(v).trim()) return normalizeVersion(v);
    } catch {
      // fall through to packaged version
    }
  }
  return normalizeVersion(packagedAppVersion());
}

export type FetchLatestOptions = {
  /** Injected for smoke / tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Override API URL (tests). */
  apiUrl?: string;
};

/**
 * Fetch the latest GitHub Release and compare to `currentVersion`.
 * Never installs anything — caller decides whether to open URLs.
 */
export async function checkLatestRelease(
  currentVersion: string,
  options: FetchLatestOptions = {},
): Promise<UpdateCheckResult> {
  const current = normalizeVersion(currentVersion);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return {
      status: "error",
      current,
      reason: "offline",
      message: "Network fetch is unavailable in this environment.",
    };
  }

  try {
    const res = await fetchImpl(options.apiUrl ?? GITHUB_API_LATEST_RELEASE, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: options.signal,
    });

    if (res.status === 403 || res.status === 429) {
      return {
        status: "error",
        current,
        reason: "rate-limit",
        message:
          "GitHub rate-limited the update check. Try again in a few minutes, or open the release page manually.",
      };
    }
    if (res.status === 404) {
      return {
        status: "error",
        current,
        reason: "not-found",
        message: "No GitHub Release found yet for this repository.",
      };
    }
    if (!res.ok) {
      return {
        status: "error",
        current,
        reason: "unknown",
        message: `GitHub returned HTTP ${res.status} while checking for updates.`,
      };
    }

    const data: unknown = await res.json();
    const latest = parseGithubReleaseJson(data);
    if (!latest) {
      return {
        status: "error",
        current,
        reason: "invalid",
        message: "GitHub release payload was missing a tag name.",
      };
    }

    if (isNewerVersion(latest.tagName, current)) {
      return { status: "update-available", current, latest };
    }
    return { status: "up-to-date", current, latest };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const offline =
      /failed to fetch|networkerror|load failed|offline|enotfound|econnrefused/i.test(
        message,
      );
    return {
      status: "error",
      current,
      reason: offline ? "offline" : "unknown",
      message: offline
        ? "Could not reach GitHub (offline or blocked). Open the release page when you have a connection."
        : `Update check failed: ${message}`,
    };
  }
}

/** Open an external URL (desktop opener plugin, else browser tab). */
export async function openExternalUrl(url: string): Promise<void> {
  if (isDesktopShell()) {
    await openUrl(url);
    return;
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
