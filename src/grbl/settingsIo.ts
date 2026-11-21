import type { GrblClient } from "./transport";
import {
  formatSettingWrite,
  parseSettingLine,
  type GrblSetting,
} from "./settings";

export interface CollectSettingsOptions {
  /** Overall timeout for the dump. Default 4000ms. */
  timeoutMs?: number;
  /** Settling delay after sending `$$`. Default 30ms. */
  settleMs?: number;
}

/**
 * Request `$$` and collect `$n=value` lines until `ok` or timeout.
 * Concurrent status polls (`?`) are ignored.
 */
export async function fetchGrblSettings(
  client: GrblClient,
  options: CollectSettingsOptions = {},
): Promise<Map<number, GrblSetting>> {
  const timeoutMs = options.timeoutMs ?? 4000;
  const settleMs = options.settleMs ?? 30;

  if (!client.transport.isOpen) {
    throw new Error("Not connected.");
  }

  const map = new Map<number, GrblSetting>();
  let settled = false;
  let sawOk = false;

  const done = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      if (map.size > 0) {
        // Partial dump is still useful (slow link / missing ok).
        resolve();
        return;
      }
      reject(new Error("Timed out waiting for $$ settings dump."));
    }, timeoutMs);

    const unsub = client.transport.onLine((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed === "ok") {
        if (settled || map.size > 0) {
          sawOk = true;
          clearTimeout(timer);
          unsub();
          resolve();
        }
        return;
      }
      if (trimmed.startsWith("<") || trimmed === "?") return;
      const parsed = parseSettingLine(trimmed);
      if (parsed) {
        map.set(parsed.id, parsed);
      }
    });
  });

  await client.sendLine("$$");
  settled = true;
  await new Promise((r) => setTimeout(r, settleMs));
  await done;
  void sawOk;
  return map;
}

export interface WriteSettingOptions {
  timeoutMs?: number;
}

/**
 * Write one `$n=value` and wait for `ok` (or surface `error:`).
 */
export async function writeGrblSetting(
  client: GrblClient,
  id: number,
  value: number,
  options: WriteSettingOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 3000;
  if (!client.transport.isOpen) {
    throw new Error("Not connected.");
  }

  const cmd = formatSettingWrite(id, value);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`Timed out waiting for ok after ${cmd}`));
    }, timeoutMs);

    const unsub = client.transport.onLine((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("<")) return;
      if (/^error:/i.test(trimmed)) {
        clearTimeout(timer);
        unsub();
        reject(new Error(trimmed));
        return;
      }
      if (trimmed === "ok") {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });

    void client.sendLine(cmd).catch((err) => {
      clearTimeout(timer);
      unsub();
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** Write several settings sequentially (stops on first failure). */
export async function writeGrblSettings(
  client: GrblClient,
  entries: Array<{ id: number; value: number }>,
  options: WriteSettingOptions = {},
): Promise<void> {
  for (const entry of entries) {
    await writeGrblSetting(client, entry.id, entry.value, options);
    // Brief gap so EEPROM writes settle on real hardware.
    await new Promise((r) => setTimeout(r, 40));
  }
}
