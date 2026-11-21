/** Manual G-code console helpers + persisted macros. */

export const MACROS_KEY = "sharpcnc.macros.v1";

export interface GcodeMacro {
  id: string;
  name: string;
  /** One or more lines (newlines allowed). */
  body: string;
  updatedAt: number;
}

export const DEFAULT_MACROS: GcodeMacro[] = [
  {
    id: "spindle-off",
    name: "Spindle off",
    body: "M5",
    updatedAt: 0,
  },
  {
    id: "coolant-off",
    name: "Coolant off",
    body: "M9",
    updatedAt: 0,
  },
  {
    id: "units-mm",
    name: "Units mm (G21)",
    body: "G21",
    updatedAt: 0,
  },
];

/** Lines that must never be sent from the manual console. */
const BLOCKED = [
  /^\$H$/i,
  /^\$RST=/i,
  /^\$\*$/i, // wipe settings
];

/**
 * Split console / macro text into sendable lines.
 * Strips comments; rejects empty / blocked system wipes.
 */
export function parseConsoleLines(text: string): {
  lines: string[];
  blocked?: string;
} {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.replace(/\([^)]*\)/g, "");
    const semi = line.indexOf(";");
    if (semi >= 0) line = line.slice(0, semi);
    line = line.trim();
    if (!line || line === "%") continue;
    for (const re of BLOCKED) {
      if (re.test(line)) {
        return {
          lines: [],
          blocked: `Refused dangerous console line: ${line}`,
        };
      }
    }
    // Real-time single chars should go through dedicated buttons, not console.
    if (line === "!" || line === "~" || line === "?") {
      return {
        lines: [],
        blocked: `Use safety / status controls for realtime “${line}”, not the console.`,
      };
    }
    lines.push(line);
  }
  if (lines.length === 0) {
    return { lines: [], blocked: "Nothing to send." };
  }
  return { lines };
}

export function loadMacros(): GcodeMacro[] {
  try {
    const raw = localStorage.getItem(MACROS_KEY);
    if (!raw) return DEFAULT_MACROS.map((m) => ({ ...m }));
    const parsed = JSON.parse(raw) as GcodeMacro[];
    if (!Array.isArray(parsed)) return DEFAULT_MACROS.map((m) => ({ ...m }));
    const out: GcodeMacro[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      if (typeof item.id !== "string" || typeof item.name !== "string") continue;
      if (typeof item.body !== "string") continue;
      out.push({
        id: item.id,
        name: item.name,
        body: item.body,
        updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
      });
    }
    return out.length > 0 ? out : DEFAULT_MACROS.map((m) => ({ ...m }));
  } catch {
    return DEFAULT_MACROS.map((m) => ({ ...m }));
  }
}

export function saveMacros(macros: GcodeMacro[]): void {
  try {
    localStorage.setItem(MACROS_KEY, JSON.stringify(macros));
  } catch {
    // ignore
  }
}

export function createMacro(name: string, body: string): GcodeMacro {
  return {
    id: `macro-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "Macro",
    body,
    updatedAt: Date.now(),
  };
}

export function canSendConsole(
  connected: boolean,
  streaming: boolean,
  state: string,
): { ok: boolean; reason?: string } {
  if (!connected) return { ok: false, reason: "Connect first." };
  if (streaming) return { ok: false, reason: "Stop the job first." };
  if (state === "Alarm") {
    return { ok: false, reason: "Alarm lock — unlock before sending." };
  }
  if (state === "Hold") {
    return { ok: false, reason: "Feed hold active." };
  }
  if (state === "Run" || state === "Home" || state === "Jog") {
    return { ok: false, reason: `Busy (${state}).` };
  }
  return { ok: true };
}
