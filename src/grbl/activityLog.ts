/** Live serial / activity log for SharpCNC. */

export type ActivityKind = "tx" | "rx" | "event" | "alarm";

export type ActivityFilter =
  | "all"
  | "events"
  | "serial"
  | "alarms"
  | "raw";

export interface ActivityEntry {
  id: number;
  /** Epoch ms. */
  at: number;
  kind: ActivityKind;
  text: string;
  /** True for noisy status polls (`?`) and `<…>` reports. */
  chatter: boolean;
}

export interface ActivityLogOptions {
  /** Max retained entries (ring). Default 800. */
  capacity?: number;
}

export interface ActivityLog {
  append(kind: ActivityKind, text: string, opts?: { chatter?: boolean }): ActivityEntry;
  clear(): void;
  getEntries(): readonly ActivityEntry[];
  onChange(handler: (entries: readonly ActivityEntry[]) => void): () => void;
  exportText(filter?: ActivityFilter): string;
}

let nextId = 1;

export function isStatusChatter(kind: ActivityKind, text: string): boolean {
  const t = text.trim();
  if (kind === "tx" && (t === "?" || t.startsWith("? "))) return true;
  if (kind === "rx" && t.startsWith("<") && t.endsWith(">")) return true;
  return false;
}

export function formatTxPayload(data: string | Uint8Array): string {
  if (typeof data === "string") {
    const trimmed = data.replace(/\r?\n$/, "");
    if (trimmed === "!") return "! (feed hold)";
    if (trimmed === "~") return "~ (cycle start)";
    if (trimmed === "?") return "?";
    return trimmed;
  }
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 1 && bytes[0] === 0x18) return "Ctrl-X (soft reset)";
  if (bytes.length === 1 && bytes[0] === 0x85) return "0x85 (jog cancel)";
  if (bytes.length === 1) {
    const b = bytes[0];
    if (b === 0x21) return "! (feed hold)";
    if (b === 0x7e) return "~ (cycle start)";
    if (b === 0x3f) return "?";
  }
  return `[${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")}]`;
}

export function entryMatchesFilter(
  entry: ActivityEntry,
  filter: ActivityFilter,
): boolean {
  switch (filter) {
    case "all":
      return !entry.chatter;
    case "raw":
      return true;
    case "events":
      return entry.kind === "event" || entry.kind === "alarm";
    case "serial":
      return (
        (entry.kind === "tx" || entry.kind === "rx") && !entry.chatter
      );
    case "alarms":
      return entry.kind === "alarm";
    default:
      return true;
  }
}

function formatTimestamp(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function formatActivityLine(entry: ActivityEntry): string {
  const tag =
    entry.kind === "tx"
      ? "TX"
      : entry.kind === "rx"
        ? "RX"
        : entry.kind === "alarm"
          ? "ALARM"
          : "EVT";
  return `${formatTimestamp(entry.at)}  ${tag.padEnd(5)}  ${entry.text}`;
}

export function createActivityLog(
  options: ActivityLogOptions = {},
): ActivityLog {
  const capacity = options.capacity ?? 800;
  const entries: ActivityEntry[] = [];
  const handlers = new Set<(entries: readonly ActivityEntry[]) => void>();

  const notify = () => {
    const snapshot = entries.slice();
    for (const handler of handlers) handler(snapshot);
  };

  return {
    append(kind, text, opts) {
      const chatter = opts?.chatter ?? isStatusChatter(kind, text);
      const entry: ActivityEntry = {
        id: nextId++,
        at: Date.now(),
        kind,
        text,
        chatter,
      };
      entries.push(entry);
      if (entries.length > capacity) {
        entries.splice(0, entries.length - capacity);
      }
      notify();
      return entry;
    },
    clear() {
      entries.length = 0;
      notify();
    },
    getEntries() {
      return entries;
    },
    onChange(handler) {
      handlers.add(handler);
      handler(entries.slice());
      return () => {
        handlers.delete(handler);
      };
    },
    exportText(filter: ActivityFilter = "raw") {
      return entries
        .filter((e) => entryMatchesFilter(e, filter))
        .map(formatActivityLine)
        .join("\n");
    },
  };
}
