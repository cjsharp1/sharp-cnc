# Google Drive setup (SharpCNC)

SharpCNC can load jobs from **Google Drive** once an OAuth client ID is configured. Until then, use the **watched local folder** (Drive for Desktop sync folder, USB, or network share) — that path is fully working in the desktop app.

## What works without credentials

1. Menu → **External jobs…** (or Prepare → Load → External).
2. **Pick…** a local folder containing `.nc` / `.gcode` / `.svg`.
3. Path is persisted; **Auto-refresh** re-lists every ~2.5s.
4. Click a file to open it into the existing Job / SVG loaders.

Point that folder at your Google Drive for Desktop mirror if you want Drive files without OAuth.

## Enable native Google Drive OAuth

### 1. Create a Google Cloud OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Enable the **Google Drive API**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Application type: **Desktop app** (or “Installed”).
6. Copy the **Client ID** (`….apps.googleusercontent.com`).  
   No client secret is required for the PKCE desktop flow SharpCNC uses.

### 2. Configure the authorized redirect

Add this redirect URI to the OAuth client (under Authorized redirect URIs):

```
http://127.0.0.1:17833/oauth/callback
```

The desktop app will listen on that loopback address when the OAuth exchange is finished (scaffolded in this release; connect opens the consent URL today).

### 3. Set the client ID for SharpCNC

Create a local env file (do not commit secrets; the client ID is public but keep it out of the repo if you prefer):

```bash
# .env.local (Vite)
VITE_GOOGLE_DRIVE_CLIENT_ID=YOUR_ID.apps.googleusercontent.com
```

Rebuild / restart `npm run tauri dev`.

When the client ID is present, External jobs shows **Connect…** instead of “Setup needed”.

### 4. Scopes

SharpCNC requests read-only Drive access:

- `https://www.googleapis.com/auth/drive.readonly`
- `openid` / `email` (account hint in the UI)

## Status of this release

| Piece | Status |
|-------|--------|
| Watched local folder pick / list / read / persist / auto-refresh | **Done** |
| Drive UI + “configured?” detection | **Done** |
| PKCE auth URL + open system browser | **Scaffolded** |
| Loopback code exchange + token storage | **Needs client ID + follow-up** |
| Drive folder picker + file list/download | **Needs tokens** |

## Repo pointers

- UI: `src/components/ExternalJobsPanel.tsx`
- Config: `src/grbl/driveConfig.ts`, `src/grbl/jobsFolderConfig.ts`
- OAuth helpers: `src/grbl/googleDrive.ts`
- Desktop FS: `src-tauri/src/jobs_folder.rs`
