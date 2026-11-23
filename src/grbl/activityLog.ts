/** Live serial / activity log for SharpCNC. */

export type ActivityKind = "tx" | "rx" | "event" | "alarm";

/** High-level bucket for filtering / export / agent debug. */
export type ActivityCategory =
  | "serial"
  | "connect"
  | "jog"
  | "job"
  | "alarm"
  | "settings"
  | "event";

export type ActivityFilter =
  | "all"
  | "events"
  | "serial"
  | "alarms"
  | "raw"
  | ActivityCategory;

export interface ActivityEntry {
  id: number;
  /** Epoch ms. */
  at: number;
  kind: ActivityKind;
  category: ActivityCategory;
  text: string;
  /** True for noisy status polls (`?`) and `<…>` reports. */
  chatter: boolean;
}

export interface ActivityAppendOptions {
  chatter?: boolean;
  category?: ActivityCategory;
}

export interface ActivityLogOptions {
  /**
   * Max retained entries (ring). Default 4000 — enough for a failed cut plus
   * status chatter so TX/RX can still be replayed for diagnosis.
   */
  capacity?: number;
}

export interface ActivityLog {
  append(
    kind: ActivityKind,
    text: string,
    opts?: ActivityAppendOptions,
  ): ActivityEntry;
  clear(): void;
  getEntries(): readonly ActivityEntry[];
  /** Last `n` entries (oldest → newest within the slice). */
  getLast(n: number): readonly ActivityEntry[];
  onChange(handler: (entries: readonly ActivityEntry[]) => void): () => void;
  exportText(filter?: ActivityFilter): string;
  exportJson(filter?: ActivityFilter): string;
  /**
   * TX/RX (+ alarms) only, ISO timestamps — paste into chat or a ticket to
   * reconstruct a failed run without UI chrome noise.
   */
  exportSerialTranscript(): string;
}

let nextId = 1;

export function isStatusChatter(kind: ActivityKind, text: string): boolean {
  const t = text.trim();
  if (kind === "tx" && (t === "?" || t.startsWith("? "))) return true;
  if (kind === "rx" && t.startsWith("<") && t.endsWith(">")) return true;
  return false;
}

export function inferActivityCategory(
  kind: ActivityKind,
  text: string,
  explicit?: ActivityCategory,
): ActivityCategory {
  if (explicit) return explicit;
  if (kind === "alarm") return "alarm";
  if (kind === "tx" || kind === "rx") return "serial";
  const t = text.trim();
  if (/^Serial\b/i.test(t) || /\bconnect/i.test(t) || /^Disconnected\b/i.test(t)) {
    return "connect";
  }
  if (
    /\bjog\b/i.test(t) ||
    /\bwork zero\b/i.test(t) ||
    /\bmaterial zero\b/i.test(t) ||
    /\bgo-to-zero\b/i.test(t)
  ) {
    return "jog";
  }
  if (
    /\bjob\b/i.test(t) ||
    /\bSVG\b/i.test(t) ||
    /\bG-code\b/i.test(t) ||
    /^Loaded\b/i.test(t)
  ) {
    return "job";
  }
  if (
    /\$\$|settings|steps\/mm|soft travel|Wrote \$|calibration/i.test(t) ||
    /^Read \$\$/i.test(t)
  ) {
    return "settings";
  }
  if (/\balarm\b/i.test(t)) return "alarm";
  return "event";
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
      return entry.kind === "alarm" || entry.category === "alarm";
    case "connect":
    case "jog":
    case "job":
    case "settings":
    case "event":
    case "alarm":
      return entry.category === filter;
    default:
      return true;
  }
}

/** Local wall-clock for the in-app scroller (compact). */
export function formatTimestampLocal(at: number): string {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** Absolute ISO-8601 for export / agent replay across machines. */
export function formatTimestampIso(at: number): string {
  return new Date(at).toISOString();
}

export function activityKindTag(kind: ActivityKind): string {
  switch (kind) {
    case "tx":
      return "TX";
    case "rx":
      return "RX";
    case "alarm":
      return "ALARM";
    default:
      return "EVT";
  }
}

export function formatActivityLine(entry: ActivityEntry): string {
  const tag = activityKindTag(entry.kind);
  return `${formatTimestampIso(entry.at)}  ${formatTimestampLocal(entry.at)}  ${tag.padEnd(5)}  [${entry.category}]  ${entry.text}`;
}

/** One line of a serial transcript (TX/RX/ALARM) for failed-run diagnosis. */
export function formatSerialTranscriptLine(entry: ActivityEntry): string {
  const tag = activityKindTag(entry.kind).padEnd(5);
  return `${formatTimestampIso(entry.at)}  ${tag}  ${entry.text}`;
}

export function createActivityLog(
  options: ActivityLogOptions = {},
): ActivityLog {
  const capacity = options.capacity ?? 4000;
  const entries: ActivityEntry[] = [];
  const handlers = new Set<(entries: readonly ActivityEntry[]) => void>();

  const notify = () => {
    const snapshot = entries.slice();
    for (const handler of handlers) handler(snapshot);
  };

  return {
    append(kind, text, opts) {
      const chatter = opts?.chatter ?? isStatusChatter(kind, text);
      const category = inferActivityCategory(kind, text, opts?.category);
      const entry: ActivityEntry = {
        id: nextId++,
        at: Date.now(),
        kind,
        category,
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
    getLast(n) {
      if (n <= 0) return [];
      return entries.slice(Math.max(0, entries.length - n));
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
    exportJson(filter: ActivityFilter = "raw") {
      const selected = entries.filter((e) => entryMatchesFilter(e, filter));
      return `${JSON.stringify(
        {
          schemaVersion: 2,
          exportedAt: new Date().toISOString(),
          filter,
          count: selected.length,
          entries: selected.map((e) => ({
            ...e,
            atIso: formatTimestampIso(e.at),
          })),
        },
        null,
        2,
      )}\n`;
    },
    exportSerialTranscript() {
      return entries
        .filter(
          (e) =>
            e.kind === "tx" ||
            e.kind === "rx" ||
            e.kind === "alarm",
        )
        .map(formatSerialTranscriptLine)
        .join("\n");
    },
  };
}
