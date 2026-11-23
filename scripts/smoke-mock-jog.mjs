/**
 * End-to-end-ish mock transport check: connect, jog, zero, status.
 * Run after build tooling is available; uses dynamic import of compiled? No —
 * this duplicates the mock response rules lightly and verifies command parsing
 * shapes the UI will send. Prefer `node scripts/smoke-jog-zero.mjs` for pure logic.
 *
 * For a live UI check, use `npm run dev` + Connect on MOCK://grbl-demo.
 */

import { createRequire } from "node:module";

// Lightweight inline mock of the same command paths App sends.
const SOFT_RESET = 0x18;
const JOG_CANCEL = 0x85;

function createMiniMock() {
  let machine = { x: 0, y: 0, z: 0 };
  let wco = { x: 0, y: 0, z: 0 };
  let state = "Idle";
  let softLimits = true;
  const max = { x: 1000, y: 1000, z: 200 };

  const parseAxes = (cmd) => {
    const out = {};
    const re = /([XYZ])(-?\d+(?:\.\d+)?)/gi;
    let m;
    while ((m = re.exec(cmd))) out[m[1].toLowerCase()] = Number(m[2]);
    return out;
  };

  const violates = (target) => {
    if (!softLimits) return false;
    return (
      target.x < 0 ||
      target.y < 0 ||
      target.z < -max.z ||
      target.x > max.x ||
      target.y > max.y ||
      target.z > 0
    );
  };

  return {
    get machine() {
      return { ...machine };
    },
    get wco() {
      return { ...wco };
    },
    get work() {
      return {
        x: machine.x - wco.x,
        y: machine.y - wco.y,
        z: machine.z - wco.z,
      };
    },
    get state() {
      return state;
    },
    handle(data) {
      if (typeof data !== "string") {
        const b = data[0];
        if (b === JOG_CANCEL) {
          state = "Idle";
          return "ok";
        }
        if (b === SOFT_RESET) {
          machine = { x: 0, y: 0, z: 0 };
          wco = { x: 0, y: 0, z: 0 };
          state = "Idle";
          return "reset";
        }
        return null;
      }
      const line = data.trim();
      if (line === "?") {
        return `<${state}|MPos:${machine.x.toFixed(3)},${machine.y.toFixed(3)},${machine.z.toFixed(3)}|WCO:${wco.x.toFixed(3)},${wco.y.toFixed(3)},${wco.z.toFixed(3)}>`;
      }
      if (/^\$J=/i.test(line)) {
        const abs = /\bG90\b/i.test(line);
        const v = parseAxes(line);
        const target = { ...machine };
        if (abs) {
          if (v.x !== undefined) target.x = wco.x + v.x;
          if (v.y !== undefined) target.y = wco.y + v.y;
          if (v.z !== undefined) target.z = wco.z + v.z;
        } else {
          if (v.x !== undefined) target.x = machine.x + v.x;
          if (v.y !== undefined) target.y = machine.y + v.y;
          if (v.z !== undefined) target.z = machine.z + v.z;
        }
        if (violates(target)) {
          state = "Alarm";
          return "ALARM:2";
        }
        machine = target;
        state = "Idle";
        return "ok";
      }
      if (/^G10\s+L20\b/i.test(line)) {
        const v = parseAxes(line);
        if (v.x !== undefined) wco.x = machine.x - v.x;
        if (v.y !== undefined) wco.y = machine.y - v.y;
        if (v.z !== undefined) wco.z = machine.z - v.z;
        return "ok";
      }
      return "ok";
    },
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function nearly(a, b) {
  return Math.abs(a - b) < 1e-6;
}

void createRequire;
const mock = createMiniMock();

assert(nearly(mock.work.x, 0) && nearly(mock.work.y, 0), "starts at work 0,0");

mock.handle("$J=G91 G21 X10 F500");
assert(nearly(mock.machine.x, 10), "jog +X");

mock.handle("G10 L20 P1 X0 Y0 Z0");
assert(nearly(mock.work.x, 0) && nearly(mock.work.y, 0), "work zero");

mock.handle("$J=G90 G21 Z0 F300");
assert(nearly(mock.work.z, 0), "goto Z0 work");

mock.handle("$J=G90 G21 X0 Y0 F800");
assert(nearly(mock.work.x, 0) && nearly(mock.work.y, 0), "goto XY0");

const status = mock.handle("?");
assert(status.includes("MPos:"), "status");
assert(status.includes("WCO:"), "wco");

// Soft reset clears WCO so work stays at 0 (not stale −10/−5).
mock.handle(new Uint8Array([SOFT_RESET]));
mock.handle("$J=G91 G21 X10 F500");
mock.handle("G10 L20 P1 X0 Y0 Z0"); // WCO.x = machine.x = 10
assert(nearly(mock.wco.x, 10), "wco set");
assert(nearly(mock.work.x, 0), "work 0 with offset");
mock.handle(new Uint8Array([SOFT_RESET]));
assert(nearly(mock.machine.x, 0) && nearly(mock.wco.x, 0), "reset clears MPos+WCO");
assert(nearly(mock.work.x, 0) && nearly(mock.work.y, 0), "work 0 after reset");

assert(mock.handle("$J=G91 G21 X-1 F500") === "ALARM:2", "soft limit blocks −X");
assert(mock.state === "Alarm", "alarm state");

mock.handle(new Uint8Array([SOFT_RESET]));
assert(mock.state === "Idle", "reset clears alarm in mini-mock");

mock.handle(new Uint8Array([JOG_CANCEL]));
assert(mock.state === "Idle", "cancel");

console.log("ok — mock jog / zero path smoke passed");
