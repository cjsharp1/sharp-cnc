import { useEffect, useRef, useState } from "react";

interface AppMenuProps {
  onOpenCalibration: () => void;
  onOpenMaterialTool: () => void;
}

export function AppMenu({
  onOpenCalibration,
  onOpenMaterialTool,
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
        className={`appmenu__trigger${open ? " is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Menu
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
              onOpenCalibration();
            }}
          >
            Calibration…
          </button>
          <p className="appmenu__hint">
            Guided wizard: zero, steps/mm, soft travel, manual settings.
          </p>
        </div>
      )}
    </div>
  );
}
