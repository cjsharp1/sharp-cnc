import type { GrblMachineState, GrblStatus, Position3 } from "./types";
import { ZERO_POSITION } from "./types";

const KNOWN_STATES = new Set<string>([
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

function parseVec3(raw: string): Position3 | null {
  const parts = raw.split(",");
  if (parts.length < 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

function parseState(token: string): GrblMachineState {
  const base = token.split(":")[0] ?? token;
  if (KNOWN_STATES.has(base)) return base as GrblMachineState;
  return "Unknown";
}

function sub(a: Position3, b: Position3): Position3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Position3, b: Position3): Position3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

/**
 * Parse a GRBL real-time status report line, e.g.
 * `<Idle|MPos:0.000,0.000,0.000|FS:0,0>` or with `WPos` / `WCO`.
 *
 * When only one of MPos/WPos is present, the other is derived via WCO
 * (and a remembered WCO from `prev` when GRBL omits it).
 */
export function parseStatusReport(
  line: string,
  prev?: GrblStatus | null,
): GrblStatus | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("<") || !trimmed.endsWith(">")) return null;

  const inner = trimmed.slice(1, -1);
  if (!inner) return null;

  const fields = inner.split("|");
  const state = parseState(fields[0] ?? "Unknown");

  let machine: Position3 | null = null;
  let work: Position3 | null = null;
  let wco: Position3 | null = null;
  let feedRate: number | undefined;
  let spindleSpeed: number | undefined;

  for (let i = 1; i < fields.length; i++) {
    const field = fields[i];
    const colon = field.indexOf(":");
    if (colon < 0) continue;
    const key = field.slice(0, colon);
    const value = field.slice(colon + 1);

    if (key === "MPos") {
      machine = parseVec3(value);
    } else if (key === "WPos") {
      work = parseVec3(value);
    } else if (key === "WCO") {
      wco = parseVec3(value);
    } else if (key === "FS" || key === "F") {
      const nums = value.split(",").map(Number);
      if (Number.isFinite(nums[0])) feedRate = nums[0];
      if (key === "FS" && Number.isFinite(nums[1])) spindleSpeed = nums[1];
    }
  }

  const rememberedWco = wco ?? prev?.wco ?? null;

  if (machine && work && !wco) {
    wco = sub(machine, work);
  } else if (machine && !work && rememberedWco) {
    work = sub(machine, rememberedWco);
    wco = rememberedWco;
  } else if (work && !machine && rememberedWco) {
    machine = add(work, rememberedWco);
    wco = rememberedWco;
  } else if (machine && !work) {
    work = { ...machine };
  } else if (work && !machine) {
    machine = { ...work };
  }

  if (!machine) machine = prev ? { ...prev.machine } : { ...ZERO_POSITION };
  if (!work) work = prev ? { ...prev.work } : { ...ZERO_POSITION };

  return {
    state,
    machine,
    work,
    wco: wco ?? rememberedWco ?? undefined,
    feedRate: feedRate ?? prev?.feedRate,
    spindleSpeed: spindleSpeed ?? prev?.spindleSpeed,
    raw: trimmed,
  };
}
