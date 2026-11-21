/**
 * Google Drive job-source preferences + credential detection.
 * Full OAuth runs only when a client ID is configured (see docs/google-drive-setup.md).
 */

export interface DriveConfig {
  /** Last-selected Drive folder id (empty until connected + picked). */
  folderId: string;
  /** Display name of that folder. */
  folderName: string;
  /** Google account email hint after a successful connect (not a secret). */
  accountHint: string;
}

export const DEFAULT_DRIVE_CONFIG: DriveConfig = {
  folderId: "",
  folderName: "",
  accountHint: "",
};

const DRIVE_STORAGE_KEY = "sharpcnc.drive.v1";

/**
 * Public OAuth client ID for an installed / desktop app (PKCE).
 * Set via Vite env: `VITE_GOOGLE_DRIVE_CLIENT_ID=....apps.googleusercontent.com`
 */
export function getDriveClientId(): string {
  const fromEnv =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID === "string"
      ? import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID.trim()
      : "";
  return fromEnv;
}

/** True when SharpCNC can attempt Google OAuth (client ID present). */
export function isDriveConfigured(): boolean {
  const id = getDriveClientId();
  return id.length > 0 && id.includes(".apps.googleusercontent.com");
}

export function loadDriveConfig(): DriveConfig {
  try {
    const raw = localStorage.getItem(DRIVE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DRIVE_CONFIG };
    const parsed = JSON.parse(raw) as Partial<DriveConfig>;
    return {
      folderId: typeof parsed.folderId === "string" ? parsed.folderId : "",
      folderName: typeof parsed.folderName === "string" ? parsed.folderName : "",
      accountHint:
        typeof parsed.accountHint === "string" ? parsed.accountHint : "",
    };
  } catch {
    return { ...DEFAULT_DRIVE_CONFIG };
  }
}

export function saveDriveConfig(config: DriveConfig): void {
  try {
    localStorage.setItem(
      DRIVE_STORAGE_KEY,
      JSON.stringify({
        folderId: config.folderId,
        folderName: config.folderName,
        accountHint: config.accountHint,
      }),
    );
  } catch {
    /* private mode / quota — ignore */
  }
}

export function clearDriveConfig(): void {
  saveDriveConfig({ ...DEFAULT_DRIVE_CONFIG });
}
