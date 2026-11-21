export type WorkspaceTabId = "move" | "job" | "log";

const TABS: { id: WorkspaceTabId; label: string }[] = [
  { id: "move", label: "Move" },
  { id: "job", label: "Job" },
  { id: "log", label: "Log" },
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
  return (
    <div className="workspace__tabs" role="tablist" aria-label="Workspace">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`workspace-tab-${id}`}
          aria-selected={active === id}
          aria-controls={`workspace-panel-${id}`}
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
  );
}
