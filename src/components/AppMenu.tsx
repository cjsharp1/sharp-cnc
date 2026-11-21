import { useEffect, useRef, useState } from "react";

interface AppMenuProps {
  onOpenCalibration: () => void;
  onOpenPrepareRun: () => void;
  onOpenMaterialTool: () => void;
  onOpenExternalJobs: () => void;
  /** When true, Log tab shows Export / Copy / Debug bridge chrome. */
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
}

export function AppMenu({
  onOpenCalibration,
  onOpenPrepareRun,
  onOpenMaterialTool,
  onOpenExternalJobs,
  debugMode,
  onDebugModeChange,
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
            Guided wizard: zero, steps/mm, soft travel, manual settings.
          </p>
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
        </div>
      )}
    </div>
  );
}
