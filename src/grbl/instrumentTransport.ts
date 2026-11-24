import type { ActivityLog } from "./activityLog";
import { formatTxPayload, isStatusChatter } from "./activityLog";
import type { SerialTransport } from "./transport";

/**
 * localStorage `"1"` → mirror every TX payload onto `window.__SHARPCNC_TX__`
 * for Playwright smokes (E-Stop loop abort counts `$J=` writes).
 */
export const SMOKE_TX_LOG_KEY = "sharpcnc.smoke.txLog.v1";

declare global {
  interface Window {
    /** Raw TX payloads when {@link SMOKE_TX_LOG_KEY} is enabled. */
    __SHARPCNC_TX__?: string[];
  }
}

function smokeTxBuffer(): string[] | null {
  try {
    if (
      typeof localStorage === "undefined" ||
      localStorage.getItem(SMOKE_TX_LOG_KEY) !== "1"
    ) {
      return null;
    }
    if (typeof window === "undefined") return null;
    if (!window.__SHARPCNC_TX__) window.__SHARPCNC_TX__ = [];
    return window.__SHARPCNC_TX__;
  } catch {
    return null;
  }
}

function rawTxPayload(data: string | Uint8Array): string {
  if (typeof data === "string") return data.replace(/\r?\n$/, "");
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length === 1 && bytes[0] === 0x18) return "<0x18>";
  if (bytes.length === 1 && bytes[0] === 0x85) return "<0x85>";
  if (bytes.length === 1) return `<0x${bytes[0]!.toString(16)}>`;
  return `[${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")}]`;
}

/**
 * Wrap a {@link SerialTransport} so every TX/RX (and open/close/error) is
 * mirrored into an {@link ActivityLog}. Logging is attached once to the
 * underlying transport so multiple `onLine` / `onEvent` subscribers do not
 * duplicate entries.
 */
export function instrumentTransport(
  transport: SerialTransport,
  log: ActivityLog,
): SerialTransport {
  // Single RX / event tap — do not unsubscribe for the life of the session.
  transport.onLine((line) => {
    const trimmed = line.trim();
    const isAlarm =
      trimmed.startsWith("ALARM:") || /^error:\s*Alarm/i.test(trimmed);
    if (isAlarm) {
      log.append("alarm", trimmed);
    } else {
      log.append("rx", trimmed, {
        chatter: isStatusChatter("rx", trimmed),
      });
    }
  });

  transport.onEvent((event) => {
    if (event.type === "open") {
      log.append("event", "Serial open", { category: "connect" });
    } else if (event.type === "close") {
      log.append(
        "event",
        event.reason ? `Serial close (${event.reason})` : "Serial close",
        { category: "connect" },
      );
    } else if (event.type === "error") {
      log.append("event", `Serial error: ${event.message}`, {
        category: "connect",
      });
    }
  });

  return {
    kind: transport.kind,
    get isOpen() {
      return transport.isOpen;
    },
    open(options) {
      return transport.open(options);
    },
    close() {
      return transport.close();
    },
    async write(data) {
      const text = formatTxPayload(data);
      log.append("tx", text, { chatter: isStatusChatter("tx", text) });
      const probe = smokeTxBuffer();
      if (probe) probe.push(rawTxPayload(data));
      return transport.write(data);
    },
    onLine(handler) {
      return transport.onLine(handler);
    },
    onEvent(handler) {
      return transport.onEvent(handler);
    },
  };
}
