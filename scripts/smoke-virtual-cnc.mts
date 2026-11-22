/**
 * Smoke: Virtual CNC path + routing transport + jog updates MPos like a machine.
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
import type { SerialTransport } from "../src/grbl/transport.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
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

let lastMpos = { x: 0, y: 0, z: 0 };
const unsub = client.onStatus((s) => {
  lastMpos = { ...s.machine };
});

await client.connect({ path: VIRTUAL_CNC_PATH });
assert(client.transport.isOpen, "Virtual CNC open");

// Wait for post-reset idle status.
await new Promise((r) => setTimeout(r, 220));

const before = { ...lastMpos };
await client.sendLine(buildJogCommand({ x: 5, y: -2 }, 500));

const deadline = Date.now() + 3000;
while (Date.now() < deadline) {
  if (
    Math.abs(lastMpos.x - (before.x + 5)) < 0.05 &&
    Math.abs(lastMpos.y - (before.y - 2)) < 0.05
  ) {
    break;
  }
  await new Promise((r) => setTimeout(r, 40));
}

assert(
  Math.abs(lastMpos.x - (before.x + 5)) < 0.05,
  `jog X moved (got ${lastMpos.x}, want ~${before.x + 5})`,
);
assert(
  Math.abs(lastMpos.y - (before.y - 2)) < 0.05,
  `jog Y moved (got ${lastMpos.y}, want ~${before.y - 2})`,
);

await client.disconnect();
unsub();
assert(!client.transport.isOpen, "disconnected");

console.log("smoke-virtual-cnc: ok");
