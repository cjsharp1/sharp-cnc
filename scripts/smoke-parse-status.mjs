/**
 * Smoke checks for GRBL status parsing (no test runner required).
 * Run: node scripts/smoke-parse-status.mjs
 *
 * Mirrors src/grbl/parseStatus.ts logic for CI without a harness.
 */

function parseVec3(raw) {
  const parts = raw.split(",");
  if (parts.length < 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

const KNOWN = new Set([
  "Idle",
  "Run",
  "Hold",
  "Jog",
  "Alarm",
  "Door",
  "Check",
  "Home",
  "Sleep",
]);

function parseStatusReport(line, prev) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("<") || !trimmed.endsWith(">")) return null;
  const inner = trimmed.slice(1, -1);
  const fields = inner.split("|");
  const stateTok = (fields[0] ?? "Unknown").split(":")[0];
  const state = KNOWN.has(stateTok) ? stateTok : "Unknown";

  let machine = null;
  let work = null;
  let wco = null;
  let pinsRaw = null;
  for (let i = 1; i < fields.length; i++) {
    const field = fields[i];
    const colon = field.indexOf(":");
    if (colon < 0) continue;
    const key = field.slice(0, colon);
    const value = field.slice(colon + 1);
    if (key === "MPos") machine = parseVec3(value);
    else if (key === "WPos") work = parseVec3(value);
    else if (key === "WCO") wco = parseVec3(value);
    else if (key === "Pn") pinsRaw = value;
  }

  const remembered = wco ?? prev?.wco ?? null;
  if (machine && work && !wco) {
    wco = {
      x: machine.x - work.x,
      y: machine.y - work.y,
      z: machine.z - work.z,
    };
  } else if (machine && !work && remembered) {
    work = {
      x: machine.x - remembered.x,
      y: machine.y - remembered.y,
      z: machine.z - remembered.z,
    };
    wco = remembered;
  } else if (work && !machine && remembered) {
    machine = {
      x: work.x + remembered.x,
      y: work.y + remembered.y,
      z: work.z + remembered.z,
    };
    wco = remembered;
  } else if (machine && !work) {
    work = { ...machine };
  } else if (work && !machine) {
    machine = { ...work };
  }

  return {
    state,
    machine: machine ?? prev?.machine ?? { x: 0, y: 0, z: 0 },
    work: work ?? prev?.work ?? { x: 0, y: 0, z: 0 },
    wco: wco ?? remembered ?? undefined,
    pins:
      pinsRaw !== null
        ? {
            cycleStart: /S/i.test(pinsRaw),
            feedHold: /H/i.test(pinsRaw),
            reset: /R/i.test(pinsRaw),
            door: /D/i.test(pinsRaw),
            raw: pinsRaw.toUpperCase(),
          }
        : undefined,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function nearly(a, b) {
  return Math.abs(a - b) < 1e-6;
}

const mpos = parseStatusReport("<Idle|MPos:1.500,2.250,-0.100|FS:120,0>");
assert(mpos?.state === "Idle", "Idle");
assert(nearly(mpos.machine.x, 1.5), "MPos X");

const withWco = parseStatusReport(
  "<Run|MPos:10.000,20.000,0.000|WCO:1.000,2.000,0.000|FS:0,0>",
);
assert(nearly(withWco.work.x, 9), "WPos from WCO");
assert(nearly(withWco.work.y, 18), "WPos Y");

const retained = parseStatusReport(
  "<Idle|MPos:11.000,21.000,0.000|FS:0,0>",
  withWco,
);
assert(nearly(retained.work.x, 10), "WCO retained");

const hold = parseStatusReport(
  "<Hold:0|WPos:3.000,4.000,5.000|WCO:1.000,1.000,1.000>",
);
assert(hold.state === "Hold", "Hold");
assert(nearly(hold.machine.x, 4), "MPos from WPos+WCO");

assert(parseStatusReport("ok") === null, "reject non-status");

const withPins = parseStatusReport(
  "<Hold:0|MPos:0.000,0.000,0.000|FS:0,0|Pn:HS>",
);
assert(withPins.pins?.feedHold === true, "Pn feed hold");
assert(withPins.pins?.cycleStart === true, "Pn cycle start");
const noPins = parseStatusReport("<Idle|MPos:0,0,0|FS:0,0>", withPins);
assert(noPins.pins === undefined, "Pn cleared when omitted");

console.log("ok — GRBL status parse smoke passed");
