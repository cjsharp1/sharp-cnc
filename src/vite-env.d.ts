/// <reference types="vite/client" />

/** Injected from package.json by vite.config.ts */
declare const __SHARPCNC_VERSION__: string;

interface ImportMetaEnv {
  /** Google OAuth desktop client ID for Drive job loading (optional). */
  readonly VITE_GOOGLE_DRIVE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Navigator {
  readonly serial?: unknown;
}
