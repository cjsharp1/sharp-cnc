import type { ActivityLog } from "./activityLog";
import { formatTxPayload, isStatusChatter } from "./activityLog";
import type { SerialTransport } from "./transport";

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
      log.append("event", "Serial open");
    } else if (event.type === "close") {
      log.append(
        "event",
        event.reason ? `Serial close (${event.reason})` : "Serial close",
      );
    } else if (event.type === "error") {
      log.append("event", `Serial error: ${event.message}`);
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
