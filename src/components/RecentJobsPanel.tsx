import {
  recentJobThumbnailSvg,
  type RecentJobEntry,
} from "../grbl";

interface RecentJobsPanelProps {
  entries: RecentJobEntry[];
  busy: boolean;
  onOpen: (entry: RecentJobEntry) => void;
  onRemove: (id: string) => void;
}

export function RecentJobsPanel({
  entries,
  busy,
  onOpen,
  onRemove,
}: RecentJobsPanelProps) {
  if (entries.length === 0) return null;

  return (
    <section className="recentjobs" aria-label="Recent jobs">
      <div className="recentjobs__meta">
        <h2 className="recentjobs__title">Recent</h2>
        <p className="recentjobs__hint">
          Last opened files with path thumbnails — reopen without hunting the
          folder.
        </p>
      </div>
      <ul className="recentjobs__list">
        {entries.map((entry) => {
          const svg = recentJobThumbnailSvg(entry, 56);
          return (
            <li key={entry.id} className="recentjobs__item">
              <button
                type="button"
                className="recentjobs__card"
                disabled={busy}
                onClick={() => onOpen(entry)}
              >
                <span
                  className="recentjobs__thumb"
                  dangerouslySetInnerHTML={{ __html: svg }}
                  aria-hidden
                />
                <span className="recentjobs__info">
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.kind} · {entry.lineCount} lines ·{" "}
                    {new Date(entry.openedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="recentjobs__remove"
                aria-label={`Remove ${entry.name} from recent`}
                disabled={busy}
                onClick={() => onRemove(entry.id)}
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
