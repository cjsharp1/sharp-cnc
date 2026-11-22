import { useEffect, useRef, useState } from "react";
import type { UiTheme } from "../grbl";

interface AppMenuProps {
  onOpenCalibration: () => void;
  onOpenBedTravelTest?: () => void;
  onOpenPrepareRun: () => void;
  onOpenMaterialTool: () => void;
  onOpenExternalJobs: () => void;
  onOpenFirstRun?: () => void;
  onOpenAbout?: () => void;
  /** When true, Log tab shows Export / Copy / Debug bridge chrome. */
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  theme: UiTheme;
  onThemeChange: (theme: UiTheme) => void;
  /** Optional version label shown in the menu footer (e.g. v0.1.0). */
  versionLabel?: string;
  updateAvailable?: boolean;
}

export function AppMenu({
  onOpenCalibration,
  onOpenBedTravelTest,
  onOpenPrepareRun,
  onOpenMaterialTool,
  onOpenExternalJobs,
  onOpenFirstRun,
  onOpenAbout,
  debugMode,
  onDebugModeChange,
  theme,
  onThemeChange,
  versionLabel,
  updateAvailable = false,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="appmenu" ref={rootRef}>
      <button
        type="button"
        className={`appmenu__trigger${open ? " is-open" : ""}${debugMode ? " is-debug" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Menu{debugMode ? " · Debug" : ""}
      </button>
      {open && (
        <div className="appmenu__panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="appmenu__item"
            onClick={() => {
              setOpen(false);
              onOpenMaterialTool();
            }}
          >
            Material &amp; tool…
          </button>
          <p className="appmenu__hint">
            Stock size, bed placement, and bit diameter.
          </p>
          <button
            type="button"
            role="menuitem"
            className="appmenu__item"
            onClick={() => {
              setOpen(false);
              onOpenExternalJobs();
            }}
          >
            External jobs…
          </button>
          <p className="appmenu__hint">
            Watched local folder and Google Drive job sources.
          </p>
          {onOpenFirstRun ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="appmenu__item"
                onClick={() => {
                  setOpen(false);
                  onOpenFirstRun();
                }}
              >
                First-run setup…
              </button>
              <p className="appmenu__hint">
                Connect → home → calibrate → travel → stock.
              </p>
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="appmenu__item"
            onClick={() => {
              setOpen(false);
              onOpenCalibration();
            }}
          >
            Calibration…
          </button>
          <p className="appmenu__hint">
            Guided wizard: zero, axis direction, steps/mm, soft travel, manual.
          </p>
          {onOpenBedTravelTest ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="appmenu__item"
                onClick={() => {
                  setOpen(false);
                  onOpenBedTravelTest();
                }}
              >
                Bed travel test…
              </button>
              <p className="appmenu__hint">
                After calibration: full soft-limit corner walk with slow approach.
              </p>
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="appmenu__item"
            onClick={() => {
              setOpen(false);
              onOpenPrepareRun();
            }}
          >
            Prepare to run…
          </button>
          <p className="appmenu__hint">
            Pre-start wizard: stock, tool, XY zero, Z probe, then Start.
          </p>
          <div className="appmenu__divider" role="separator" />
          <div className="appmenu__theme" role="group" aria-label="Color theme">
            <span className="appmenu__theme-label">Appearance</span>
            <div className="appmenu__theme-switch">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={theme === "dark"}
                className={`appmenu__theme-btn${theme === "dark" ? " is-active" : ""}`}
                onClick={() => onThemeChange("dark")}
              >
                Dark
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={theme === "light"}
                className={`appmenu__theme-btn${theme === "light" ? " is-active" : ""}`}
                onClick={() => onThemeChange("light")}
              >
                Light
              </button>
            </div>
          </div>
          <p className="appmenu__hint">
            Workshop steel &amp; brass — saved for next launch.
          </p>
          <div className="appmenu__divider" role="separator" />
          <label className="appmenu__toggle" role="menuitemcheckbox" aria-checked={debugMode}>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => onDebugModeChange(e.target.checked)}
            />
            <span>Debug mode</span>
          </label>
          <p className="appmenu__hint">
            {debugMode
              ? "On — Log tab shows Export, Copy, and Debug bridge."
              : "Off — keep the Log tab clean for everyday use."}
          </p>
          {onOpenAbout ? (
            <>
              <div className="appmenu__divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="appmenu__item"
                onClick={() => {
                  setOpen(false);
                  onOpenAbout();
                }}
              >
                About &amp; updates…
                {updateAvailable ? " · New" : ""}
              </button>
              <p className="appmenu__hint">
                Version, What’s new, and download from GitHub Releases.
              </p>
            </>
          ) : null}
          {versionLabel ? (
            <p className="appmenu__version" aria-label={`SharpCNC ${versionLabel}`}>
              SharpCNC {versionLabel}
              {updateAvailable ? " · update available" : ""}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
