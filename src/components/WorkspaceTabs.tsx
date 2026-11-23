import { useRef } from "react";

export type WorkspaceTabId = "move" | "probe" | "job" | "log";

const TABS: {
  id: WorkspaceTabId;
  label: string;
  purpose: string;
}[] = [
  {
    id: "move",
    label: "Move",
    purpose: "Jog, home, material zero, offsets, and spindle",
  },
  {
    id: "probe",
    label: "Probe",
    purpose: "XY edge/corner probe and tool-length Z",
  },
  {
    id: "job",
    label: "Job",
    purpose: "Material, files, prepare, simulate, and run",
  },
  {
    id: "log",
    label: "Log",
    purpose: "Activity log and optional debug bridge",
  },
];

interface WorkspaceTabsProps {
  active: WorkspaceTabId;
  onChange: (id: WorkspaceTabId) => void;
  jobBadge?: string | null;
}

export function WorkspaceTabs({
  active,
  onChange,
  jobBadge,
}: WorkspaceTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const clamped = (index + TABS.length) % TABS.length;
    tabRefs.current[clamped]?.focus();
    onChange(TABS[clamped].id);
  };

  return (
    <div className="workspace__tabs-wrap">
      <p id="workspace-tabs-help" className="visually-hidden">
        Workspace panels: Move for jogging and zeros, Probe for touch-offs, Job
        for files and run, Log for activity. Use Left and Right arrow keys on
        the tab list.
      </p>
      <div
        className="workspace__tabs"
        role="tablist"
        aria-label="Workspace"
        aria-describedby="workspace-tabs-help"
        onKeyDown={(event) => {
          const index = TABS.findIndex((t) => t.id === active);
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            focusTab(index + 1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            focusTab(index - 1);
          } else if (event.key === "Home") {
            event.preventDefault();
            focusTab(0);
          } else if (event.key === "End") {
            event.preventDefault();
            focusTab(TABS.length - 1);
          }
        }}
      >
        {TABS.map(({ id, label, purpose }, index) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`workspace-tab-${id}`}
            aria-selected={active === id}
            aria-controls={`workspace-panel-${id}`}
            aria-label={`${label}: ${purpose}`}
            title={purpose}
            tabIndex={active === id ? 0 : -1}
            className={`workspace__tab${active === id ? " is-active" : ""}`}
            onClick={() => onChange(id)}
          >
            {label}
            {id === "job" && jobBadge ? (
              <span className="workspace__badge">{jobBadge}</span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="workspace__purpose" aria-live="polite">
        {TABS.find((t) => t.id === active)?.purpose}
      </p>
    </div>
  );
}
