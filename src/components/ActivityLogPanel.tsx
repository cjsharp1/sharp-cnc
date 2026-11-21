import { useEffect, useMemo, useRef, useState } from "react";
import {
  entryMatchesFilter,
  formatActivityLine,
  type ActivityEntry,
  type ActivityFilter,
  type ActivityLog,
} from "../grbl";

interface ActivityLogPanelProps {
  log: ActivityLog;
}

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "serial", label: "TX/RX" },
  { id: "alarms", label: "Alarms" },
  { id: "raw", label: "Raw" },
];

export function ActivityLogPanel({ log }: ActivityLogPanelProps) {
  const [entries, setEntries] = useState<readonly ActivityEntry[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [pinned, setPinned] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => log.onChange(setEntries), [log]);

  const visible = useMemo(
    () => entries.filter((e) => entryMatchesFilter(e, filter)),
    [entries, filter],
  );

  useEffect(() => {
    if (pinned) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visible, pinned]);

  const handleExport = () => {
    const text = log.exportText(filter === "all" ? "raw" : filter);
    const blob = new Blob([text || "(empty)\n"], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sharpcnc-activity-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="alog" aria-label="Activity log">
      <header className="alog__head">
        <h2 className="alog__title">Activity</h2>
        <div className="alog__tools">
          <button
            type="button"
            className={`alog__tool${pinned ? " is-active" : ""}`}
            onClick={() => setPinned((p) => !p)}
            title={pinned ? "Resume auto-scroll" : "Pause auto-scroll"}
          >
            {pinned ? "Pinned" : "Live"}
          </button>
          <button
            type="button"
            className="alog__tool"
            onClick={() => log.clear()}
            disabled={entries.length === 0}
          >
            Clear
          </button>
          <button
            type="button"
            className="alog__tool"
            onClick={handleExport}
            disabled={entries.length === 0}
          >
            Export
          </button>
        </div>
      </header>

      <div className="alog__filters" role="tablist" aria-label="Log filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={`alog__filter${filter === f.id ? " is-active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="alog__scroller" ref={scrollerRef}>
        {visible.length === 0 ? (
          <p className="alog__empty">No entries yet — connect to see TX/RX.</p>
        ) : (
          <ul className="alog__list">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className={`alog__line is-${entry.kind}${entry.chatter ? " is-chatter" : ""}`}
              >
                <span className="alog__kind">
                  {entry.kind === "tx"
                    ? "TX"
                    : entry.kind === "rx"
                      ? "RX"
                      : entry.kind === "alarm"
                        ? "ALM"
                        : "EVT"}
                </span>
                <span className="alog__text" title={formatActivityLine(entry)}>
                  {entry.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
