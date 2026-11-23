/**
 * Smoke: Virtual CNC path + routing transport + perfect origin + soft limits.
 * Run: npx tsx scripts/smoke-virtual-cnc.mts
 */

import { createGrblClient } from "../src/grbl/client.ts";
import { buildJogCommand } from "../src/grbl/jog.ts";
import {
  VIRTUAL_CNC_PATH,
  createMockTransport,
  isVirtualCncPath,
  listMockPorts,
} from "../src/grbl/mockSerial.ts";
import { createRoutingTransport } from "../src/grbl/routingTransport.ts";
import { softLimitsEnabled } from "../src/grbl/settings.ts";
import { fetchGrblSettings } from "../src/grbl/settingsIo.ts";
import type { GrblStatus } from "../src/grbl/types.ts";
import type { SerialTransport } from "../src/grbl/transport.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function nearly(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) < eps;
}

assert(isVirtualCncPath(VIRTUAL_CNC_PATH), "VIRTUAL_CNC_PATH is virtual");
assert(isVirtualCncPath("MOCK://anything"), "MOCK:// alias is virtual");
assert(!isVirtualCncPath("COM3"), "COM3 is not virtual");
assert(!isVirtualCncPath(""), "empty is not virtual");

const ports = listMockPorts();
assert(ports.length >= 1, "listMockPorts non-empty");
assert(ports[0]?.path === VIRTUAL_CNC_PATH, "mock port path");
assert(
  (ports[0]?.portType ?? "").toLowerCase().includes("virtual"),
  "portType says Virtual CNC",
);

/** Minimal desktop stub that must NOT open when Virtual CNC is selected. */
function createStubDesktop(): SerialTransport {
  let open = false;
  return {
    kind: "desktop",
    get isOpen() {
      return open;
    },
    async open() {
      open = true;
      throw new Error("desktop stub must not open for Virtual CNC");
    },
    async close() {
      open = false;
    },
    async write() {
      throw new Error("desktop stub write");
    },
    onLine() {
      return () => undefined;
    },
    onEvent() {
      return () => undefined;
    },
  };
}

const routed = createRoutingTransport(createStubDesktop(), createMockTransport());
const client = createGrblClient(routed, { softResetOnConnect: true, statusPollMs: 50 });

let last: GrblStatus | null = null;
const unsub = client.onStatus((s) => {
  last = s;
});

await client.connect({ path: VIRTUAL_CNC_PATH });
assert(client.transport.isOpen, "Virtual CNC open");

// Wait for post-reset idle status + WCO report.
await new Promise((r) => setTimeout(r, 280));
assert(last, "got status");
assert(nearly(last.machine.x, 0) && nearly(last.machine.y, 0), "MPos 0,0 after reset");
assert(nearly(last.work.x, 0) && nearly(last.work.y, 0), "WPos 0,0 after reset");
if (last.wco) {
  assert(nearly(last.wco.x, 0) && nearly(last.wco.y, 0), "WCO 0 after reset");
}

const settings = await fetchGrblSettings(client, { timeoutMs: 2000 });
assert(softLimitsEnabled(settings) === true, "Virtual CNC soft limits on by default");

// Positive jog stays inside the envelope.
const before = { ...last.machine };
await client.sendLine(buildJogCommand({ x: 5, y: 2 }, 500));

const deadline = Date.now() + 3000;
while (Date.now() < deadline) {
  if (
    last &&
    nearly(last.machine.x, before.x + 5) &&
    nearly(last.machine.y, before.y + 2)
  ) {
    break;
  }
  await new Promise((r) => setTimeout(r, 40));
}

assert(
  last && nearly(last.machine.x, before.x + 5),
  `jog X moved (got ${last?.machine.x}, want ~${before.x + 5})`,
);
assert(
  last && nearly(last.machine.y, before.y + 2),
  `jog Y moved (got ${last?.machine.y}, want ~${before.y + 2})`,
);

// Soft limits: cannot jog into negatives from the origin (after soft-reset).
await client.softReset();
await new Promise((r) => setTimeout(r, 200));
assert(last && last.state !== "Alarm", "idle after soft reset");
assert(
  last && nearly(last.work.x, 0) && nearly(last.work.y, 0),
  `WPos still 0,0 after soft reset (got ${JSON.stringify(last?.work)})`,
);

await client.sendLine(buildJogCommand({ x: -1 }, 500));
await new Promise((r) => setTimeout(r, 120));
assert(last?.state === "Alarm", "soft-limit alarm on negative X jog");

await client.sendLine("$X");
await new Promise((r) => setTimeout(r, 80));
assert(last?.state === "Idle", "unlocked after soft-limit");

await client.sendLine(buildJogCommand({ y: -1 }, 500));
await new Promise((r) => setTimeout(r, 120));
assert(last?.state === "Alarm", "soft-limit alarm on negative Y jog");

await client.disconnect();
unsub();
assert(!client.transport.isOpen, "disconnected");

console.log("smoke-virtual-cnc: ok");
