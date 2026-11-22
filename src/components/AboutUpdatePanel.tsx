import { useEffect, useState } from "react";
import {
  checkLatestRelease,
  formatVersionLabel,
  GITHUB_RELEASES_LATEST_URL,
  installDesktopUpdateAndRelaunch,
  isDesktopShell,
  openExternalUrl,
  summarizeReleaseNotes,
  type DesktopUpdateProgress,
  type UpdateCheckResult,
} from "../grbl";

interface AboutUpdatePanelProps {
  currentVersion: string;
  /** When true, kick off a check as soon as the panel mounts. */
  autoCheck?: boolean;
  onUpdateAvailabilityChange?: (available: boolean) => void;
}

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return "…";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AboutUpdatePanel({
  currentVersion,
  autoCheck = true,
  onUpdateAvailabilityChange,
}: AboutUpdatePanelProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] =
    useState<DesktopUpdateProgress | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const desktop = isDesktopShell();

  const runCheck = async () => {
    setChecking(true);
    setInstallError(null);
    try {
      const next = await checkLatestRelease(currentVersion);
      setResult(next);
      onUpdateAvailabilityChange?.(next.status === "update-available");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!autoCheck) return;
    void runCheck();
    // Intentionally once on mount / when version changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVersion, autoCheck]);

  const openLatest = () => {
    void openExternalUrl(GITHUB_RELEASES_LATEST_URL);
  };

  const openReleasePage = () => {
    if (result && result.status !== "error") {
      void openExternalUrl(result.latest.htmlUrl);
      return;
    }
    openLatest();
  };

  const downloadNsis = () => {
    if (result?.status !== "update-available" || !result.latest.nsisAsset) {
      openReleasePage();
      return;
    }
    void openExternalUrl(result.latest.nsisAsset.browserDownloadUrl);
  };

  const installInApp = async () => {
    setInstalling(true);
    setInstallError(null);
    setInstallProgress({
      phase: "checking",
      downloadedBytes: 0,
      totalBytes: null,
    });
    try {
      const outcome = await installDesktopUpdateAndRelaunch((p) => {
        setInstallProgress(p);
      });
      if (outcome.status === "up-to-date") {
        setInstallError(null);
        setInstallProgress(null);
        await runCheck();
        return;
      }
      if (outcome.status === "error") {
        setInstallError(outcome.message);
        return;
      }
      // installed — relaunch should take over; keep a short status if we return.
      setInstallProgress({
        phase: "relaunching",
        downloadedBytes: installProgress?.downloadedBytes ?? 0,
        totalBytes: installProgress?.totalBytes ?? null,
      });
    } finally {
      setInstalling(false);
    }
  };

  const progressLabel = (() => {
    if (!installProgress) return null;
    if (installProgress.phase === "checking") return "Checking signed update…";
    if (installProgress.phase === "downloading") {
      return `Downloading ${formatBytes(installProgress.downloadedBytes)} / ${formatBytes(installProgress.totalBytes)}…`;
    }
    if (installProgress.phase === "installing") {
      return "Applying update (passive installer)…";
    }
    return "Relaunching SharpCNC…";
  })();

  return (
    <div className="about">
      <p className="about__lead">
        Dedicated personal controller for Chris’s Demon Shield + GRBL CNC — one
        machine only; not a multi-machine CAM or UGS replacement. Version comes
        from the packaged app build (kept in sync with{" "}
        <code>package.json</code> / Tauri config).
      </p>

      <div className="about__version-row">
        <div>
          <p className="about__label">Installed</p>
          <p className="about__version" data-testid="about-current-version">
            {formatVersionLabel(currentVersion)}
          </p>
        </div>
        <button
          type="button"
          className="about__btn about__btn--ghost"
          disabled={checking || installing}
          onClick={() => {
            void runCheck();
          }}
        >
          {checking ? "Checking…" : "Check for updates"}
        </button>
      </div>

      {result?.status === "up-to-date" && (
        <div className="about__status about__status--ok" role="status">
          <p className="about__status-title">You’re up to date</p>
          <p className="about__status-body">
            Latest GitHub Release is{" "}
            <strong>{formatVersionLabel(result.latest.tagName)}</strong>
            {result.latest.name && result.latest.name !== result.latest.tagName
              ? ` — ${result.latest.name}`
              : ""}
            .
          </p>
        </div>
      )}

      {result?.status === "update-available" && (
        <div className="about__status about__status--update" role="status">
          <p className="about__status-title">
            Update available — {formatVersionLabel(result.latest.tagName)}
          </p>
          <p className="about__status-body about__whats-new">
            <span className="about__whats-new-label">What’s new</span>
            {summarizeReleaseNotes(result.latest.body)}
          </p>

          <div className="about__actions">
            {desktop ? (
              <>
                <button
                  type="button"
                  className="about__btn about__btn--primary"
                  disabled={installing}
                  onClick={() => {
                    void installInApp();
                  }}
                  data-testid="about-install-update"
                >
                  {installing ? "Installing…" : "Install update & relaunch"}
                </button>
                <button
                  type="button"
                  className="about__btn about__btn--ghost"
                  disabled={installing}
                  onClick={downloadNsis}
                >
                  {result.latest.nsisAsset
                    ? "Download installer"
                    : "Open release"}
                </button>
                <button
                  type="button"
                  className="about__btn about__btn--ghost"
                  disabled={installing}
                  onClick={openReleasePage}
                >
                  Open release page
                </button>
              </>
            ) : (
              <button
                type="button"
                className="about__btn about__btn--primary"
                onClick={openLatest}
              >
                Open latest release
              </button>
            )}
          </div>

          {progressLabel && (
            <p className="about__progress" role="status" aria-live="polite">
              {progressLabel}
            </p>
          )}

          {installError && (
            <p className="about__install-error" role="alert">
              {installError} You can still use <strong>Download installer</strong>{" "}
              and run the NSIS setup over the existing install.
            </p>
          )}

          <ol className="about__install-steps">
            <li>
              Prefer <strong>Install update &amp; relaunch</strong> — SharpCNC
              downloads the signed NSIS package, applies it in place (passive
              progress), and restarts. No separate uninstall step.
            </li>
            <li>
              Fallback: download <code>SharpCNC_*_x64-setup.exe</code>
              {result.latest.nsisAsset
                ? ` (${result.latest.nsisAsset.name})`
                : ""}
              , quit, and run it over the existing install.
            </li>
            <li>
              If SmartScreen warns on an unsigned personal build:{" "}
              <strong>More info → Run anyway</strong> only on a PC you trust.
            </li>
            <li>
              After relaunch, confirm the version chip. The first hop from a
              build that predates the in-app updater may still need the manual
              NSIS once.
            </li>
          </ol>

          {!desktop && (
            <p className="about__hint">
              Browser builds open the release page only — use the Windows
              desktop app for USB serial and in-app install.
            </p>
          )}
        </div>
      )}

      {result?.status === "error" && (
        <div className="about__status about__status--error" role="alert">
          <p className="about__status-title">
            {result.reason === "offline"
              ? "Offline"
              : result.reason === "rate-limit"
                ? "Rate limited"
                : "Couldn’t check"}
          </p>
          <p className="about__status-body">{result.message}</p>
          <div className="about__actions">
            <button
              type="button"
              className="about__btn about__btn--ghost"
              onClick={openLatest}
            >
              Open latest release
            </button>
            <button
              type="button"
              className="about__btn about__btn--ghost"
              disabled={checking}
              onClick={() => {
                void runCheck();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!result && !checking && (
        <p className="about__hint">
          Updates come from{" "}
          <a
            href={GITHUB_RELEASES_LATEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault();
              openLatest();
            }}
          >
            GitHub Releases
          </a>
          . SharpCNC never installs an update without your confirmation.
        </p>
      )}
    </div>
  );
}
