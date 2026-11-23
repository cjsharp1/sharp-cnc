import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEBUG_BRIDGE_DEFAULT_PORT,
  activityKindTag,
  debugBridgeBaseUrl,
  entryMatchesFilter,
  formatActivityLine,
  formatTimestampLocal,
  isDesktopShell,
  type ActivityEntry,
  type ActivityFilter,
  type ActivityLog,
  type DebugBridgeStatus,
} from "../grbl";

interface ActivityLogPanelProps {
  log: ActivityLog;
  /** When false, hide Export / Copy / Debug bridge chrome. */
  debugMode?: boolean;
  /** Desktop-only: bridge enable wiring from App. */
  bridgeEnabled?: boolean;
  bridgeStatus?: DebugBridgeStatus | null;
  bridgeError?: string | null;
  onBridgeEnabledChange?: (enabled: boolean) => void;
}

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "events", label: "Events" },
  { id: "serial", label: "TX/RX" },
  { id: "alarms", label: "Alarms" },
  { id: "raw", label: "Raw" },
];

/** Everyday filters — Raw stays behind Debug mode. */
const EVERYDAY_FILTERS = FILTERS.filter((f) => f.id !== "raw");

const COPY_N_OPTIONS = [50, 100, 200] as const;

function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents || "(empty)\n"], {
    type: `${mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function ActivityLogPanel({
  log,
  debugMode = false,
  bridgeEnabled = false,
  bridgeStatus = null,
  bridgeError = null,
  onBridgeEnabledChange,
}: ActivityLogPanelProps) {
  const [entries, setEntries] = useState<readonly ActivityEntry[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [pinned, setPinned] = useState(false);
  const [copyN, setCopyN] = useState<(typeof COPY_N_OPTIONS)[number]>(100);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const desktop = isDesktopShell();

  useEffect(() => log.onChange(setEntries), [log]);

  useEffect(() => {
    if (!debugMode && filter === "raw") setFilter("all");
  }, [debugMode, filter]);

  const filterTabs = debugMode ? FILTERS : EVERYDAY_FILTERS;

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

  const exportFilter: ActivityFilter = filter === "all" ? "raw" : filter;

  const handleExportText = () => {
    downloadBlob(
      `sharpcnc-activity-${stamp()}.log`,
      log.exportText(exportFilter),
      "text/plain",
    );
  };

  const handleExportJson = () => {
    downloadBlob(
      `sharpcnc-activity-${stamp()}.json`,
      log.exportJson(exportFilter),
      "application/json",
    );
  };

  const handleExportSerial = () => {
    downloadBlob(
      `sharpcnc-serial-${stamp()}.log`,
      log.exportSerialTranscript(),
      "text/plain",
    );
  };

  const handleCopyLast = async () => {
    const slice = log.getLast(copyN);
    const text = slice.map(formatActivityLine).join("\n");
    try {
      await navigator.clipboard.writeText(text || "(empty)");
      setCopyHint(`Copied ${slice.length} line(s)`);
    } catch {
      setCopyHint("Clipboard blocked — use Export instead");
    }
    window.setTimeout(() => setCopyHint(null), 2200);
  };

  const bridgeUrl = debugBridgeBaseUrl(
    bridgeStatus?.port ?? DEBUG_BRIDGE_DEFAULT_PORT,
  );

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
          {debugMode && (
            <>
              <button
                type="button"
                className="alog__tool"
                onClick={handleExportText}
                disabled={entries.length === 0}
                title="Export filtered activity as text (ISO + local timestamps)"
              >
                Export
              </button>
              <button
                type="button"
                className="alog__tool"
                onClick={handleExportSerial}
                disabled={entries.length === 0}
                title="Export TX/RX/ALARM transcript with ISO timestamps for replay"
              >
                Serial
              </button>
              <button
                type="button"
                className="alog__tool"
                onClick={handleExportJson}
                disabled={entries.length === 0}
                title="Export filtered log as JSON (includes atIso)"
              >
                JSON
              </button>
            </>
          )}
        </div>
      </header>

      {debugMode && (
        <div className="alog__copy-row">
          <label className="alog__copy-label" htmlFor="alog-copy-n">
            Copy last
          </label>
          <select
            id="alog-copy-n"
            className="alog__copy-select"
            value={copyN}
            onChange={(e) =>
              setCopyN(Number(e.target.value) as (typeof COPY_N_OPTIONS)[number])
            }
          >
            {COPY_N_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="alog__tool"
            onClick={() => {
              void handleCopyLast();
            }}
            disabled={entries.length === 0}
          >
            Copy
          </button>
          {copyHint && <span className="alog__copy-hint">{copyHint}</span>}
        </div>
      )}

      {debugMode && onBridgeEnabledChange && (
        <div className="alog__bridge">
          <label className="alog__bridge-toggle">
            <input
              type="checkbox"
              checked={bridgeEnabled}
              disabled={!desktop}
              onChange={(e) => onBridgeEnabledChange(e.target.checked)}
            />
            <span>Debug bridge</span>
          </label>
          <p className="alog__bridge-note">
            {desktop
              ? bridgeEnabled
                ? `Listening on ${bridgeUrl} — localhost only, read-only. Do not expose this port.`
                : "Optional localhost HTTP for a Cursor agent on this PC (read-only status + logs)."
              : "Requires the SharpCNC desktop app (Tauri). In the browser, use Export / Copy instead."}
          </p>
          {bridgeEnabled && bridgeStatus?.running && (
            <p className="alog__bridge-url">
              Try <code>curl {bridgeUrl}/v1/status</code>
            </p>
          )}
          {bridgeError && <p className="alog__bridge-error">{bridgeError}</p>}
        </div>
      )}

      <div className="alog__filters" role="tablist" aria-label="Log filter">
        {filterTabs.map((f) => (
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
                className={`alog__line is-${entry.kind}${entry.chatter ? " is-chatter" : ""}${debugMode ? " has-cat" : ""}`}
              >
                <time
                  className="alog__time"
                  dateTime={new Date(entry.at).toISOString()}
                  title={new Date(entry.at).toISOString()}
                >
                  {formatTimestampLocal(entry.at)}
                </time>
                <span className="alog__kind">
                  {entry.kind === "alarm" ? "ALM" : activityKindTag(entry.kind)}
                </span>
                {debugMode && (
                  <span className="alog__cat" title={entry.category}>
                    {entry.category.slice(0, 3)}
                  </span>
                )}
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
