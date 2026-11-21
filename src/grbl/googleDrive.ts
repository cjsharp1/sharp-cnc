/**
 * Google Drive job source — OAuth scaffolding + list/read stubs.
 *
 * When `VITE_GOOGLE_DRIVE_CLIENT_ID` is set, `beginDriveConnect` opens the
 * Google consent URL (PKCE). Token exchange + Drive API calls land once Chris
 * has a client ID and we wire the loopback redirect. Until then the UI shows
 * setup guidance and the watched local folder remains the primary path.
 */

import { openUrl } from "@tauri-apps/plugin-opener";
import {
  getDriveClientId,
  isDriveConfigured,
  type DriveConfig,
} from "./driveConfig";
import { isDesktopShell } from "./session";

export interface DriveFileEntry {
  id: string;
  name: string;
  kind: "gcode" | "svg";
  modifiedTime: string | null;
}

export type DriveConnectResult =
  | { ok: true; message: string }
  | { ok: false; reason: string };

/** RFC 7636 PKCE verifier / challenge (browser crypto). */
async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64Url(bytes);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = base64Url(new Uint8Array(digest));
  return { verifier, challenge };
}

function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "openid",
  "email",
].join(" ");

/**
 * Start Google OAuth (authorization code + PKCE).
 * Opens the system browser; full token capture needs the loopback listener
 * (not finished until credentials are configured and tested on Windows).
 */
export async function beginDriveConnect(): Promise<DriveConnectResult> {
  if (!isDriveConfigured()) {
    return {
      ok: false,
      reason:
        "Google Drive client ID not configured. Add VITE_GOOGLE_DRIVE_CLIENT_ID (see docs/google-drive-setup.md).",
    };
  }

  const clientId = getDriveClientId();
  const { verifier, challenge } = await createPkcePair();

  // Persist verifier for the future redirect handler.
  try {
    sessionStorage.setItem("sharpcnc.drive.pkce", verifier);
  } catch {
    /* ignore */
  }

  const redirectUri = "http://127.0.0.1:17833/oauth/callback";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  try {
    if (isDesktopShell()) {
      await openUrl(authUrl);
    } else if (typeof window !== "undefined") {
      window.open(authUrl, "_blank", "noopener,noreferrer");
    } else {
      return { ok: false, reason: "Cannot open browser for OAuth" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Failed to open Google sign-in: ${message}` };
  }

  return {
    ok: true,
    message:
      "Opened Google sign-in. Complete consent in the browser; token exchange requires the OAuth loopback (next step after client ID is set).",
  };
}

/** List job files in a Drive folder — requires a live access token (not yet stored). */
export async function listDriveJobFiles(
  _folderId: string,
  _accessToken: string,
): Promise<DriveFileEntry[]> {
  throw new Error(
    "Drive file listing needs a completed OAuth token. Use the watched local folder, or finish Drive setup (docs/google-drive-setup.md).",
  );
}

/** Download Drive file text — requires a live access token. */
export async function readDriveJobFile(
  _fileId: string,
  _accessToken: string,
): Promise<string> {
  throw new Error(
    "Drive file download needs a completed OAuth token. Use the watched local folder for now.",
  );
}

export function driveStatusLabel(
  configured: boolean,
  config: DriveConfig,
): string {
  if (!configured) return "Not configured";
  if (config.accountHint && config.folderName) {
    return `${config.accountHint} · ${config.folderName}`;
  }
  if (config.accountHint) return `${config.accountHint} · pick a folder`;
  return "Ready to connect";
}

export { isDriveConfigured, getDriveClientId };
