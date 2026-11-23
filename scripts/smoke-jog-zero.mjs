/**
 * Smoke checks for jog command building, soft-limit guards, and work-zero plans.
 * Run: node scripts/smoke-jog-zero.mjs
 */

function fmt(n) {
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
}

function buildJogCommand(delta, feedMmMin) {
  const feed = Math.min(Math.max(1, Math.round(feedMmMin)), 3000);
  const parts = ["$J=G91", "G21"];
  if (delta.x) parts.push(`X${fmt(delta.x)}`);
  if (delta.y) parts.push(`Y${fmt(delta.y)}`);
  if (delta.z) parts.push(`Z${fmt(delta.z)}`);
  parts.push(`F${feed}`);
  return parts.join(" ");
}

function checkSoftLimits(machine, delta, limits) {
  const target = {
    x: machine.x + (delta.x ?? 0),
    y: machine.y + (delta.y ?? 0),
    z: machine.z + (delta.z ?? 0),
  };
  const axes = [
    ["X", "x", limits.maxX, limits.min.x],
    ["Y", "y", limits.maxY, limits.min.y],
    ["Z", "z", limits.maxZ, limits.min.z],
  ];
  for (const [label, key, max, min] of axes) {
    const d = delta[key];
    if (d === undefined || d === 0) continue;
    if (target[key] < min - 1e-6) {
      return { ok: false, reason: `${label} below min` };
    }
    if (max !== null && target[key] > max + 1e-6) {
      return { ok: false, reason: `${label} above max` };
    }
  }
  return { ok: true, target };
}

function buildSetWorkZeroCommand(axes, wcsP = 1) {
  const parts = [`G10 L20 P${wcsP}`];
  if (axes === "XYZ") parts.push("X0", "Y0", "Z0");
  else parts.push(`${axes}0`);
  return parts.join(" ");
}

function planGoToWorkZero(axes, { safeWorkZ = 0, zFeed = 300, xyFeed = 800 } = {}) {
  const commands = [];
  const wantX = axes === "XYZ" || axes === "X";
  const wantY = axes === "XYZ" || axes === "Y";
  const wantZ = axes === "XYZ" || axes === "Z";
  const wantXy = wantX || wantY;
  const absJog = (parts, feed) =>
    `$J=G90 G21 ${parts.join(" ")} F${Math.round(feed)}`;
  if (wantXy) {
    commands.push(absJog([`Z${fmt(safeWorkZ)}`], zFeed));
    const xy = [];
    if (wantX) xy.push("X0");
    if (wantY) xy.push("Y0");
    commands.push(absJog(xy, xyFeed));
    if (wantZ && safeWorkZ !== 0) commands.push(absJog(["Z0"], zFeed));
  } else if (wantZ) {
    commands.push(absJog(["Z0"], zFeed));
  }
  return { commands };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const jog = buildJogCommand({ x: 10, y: -1 }, 500);
assert(jog === "$J=G91 G21 X10 Y-1 F500", `jog cmd: ${jog}`);

const diagNE = buildJogCommand({ x: 1, y: 1 }, 200);
assert(diagNE.includes("X1") && diagNE.includes("Y1"), "diagonal NE");

const diagNW = buildJogCommand({ x: -1, y: 1 }, 200);
assert(diagNW.includes("X-1") && diagNW.includes("Y1"), "diagonal NW");

const diagSE = buildJogCommand({ x: 1, y: -1 }, 200);
assert(diagSE.includes("X1") && diagSE.includes("Y-1"), "diagonal SE");

const diagSW = buildJogCommand({ x: -1, y: -1 }, 200);
assert(diagSW.includes("X-1") && diagSW.includes("Y-1"), "diagonal SW");

const limits = { maxX: 1000, maxY: 1000, maxZ: null, min: { x: 0, y: 0, z: 0 } };
const ok = checkSoftLimits({ x: 10, y: 10, z: -1 }, { x: 5 }, limits);
assert(ok.ok, "within soft limits");

const blocked = checkSoftLimits({ x: 995, y: 10, z: -1 }, { x: 10 }, limits);
assert(!blocked.ok, "soft max X");

const diagSoft = checkSoftLimits(
  { x: 995, y: 995, z: -1 },
  { x: 10, y: 10 },
  limits,
);
assert(!diagSoft.ok, "diagonal soft max still blocked");

const zFree = checkSoftLimits({ x: 10, y: 10, z: 0 }, { z: 50 }, limits);
assert(zFree.ok, "unknown Z max not blocked on positive move");

const zMin = checkSoftLimits({ x: 10, y: 10, z: 0 }, { z: -1 }, limits);
assert(!zMin.ok, "Z soft min still enforced");

// Soft-limit clamp (shared by UI / keyboard / Xbox): shrink or drop, never past min/max.
function clampJogDelta(machine, delta, lim) {
  const out = {};
  let clamped = false;
  const axes = [
    ["X", "x", lim.maxX, lim.min.x],
    ["Y", "y", lim.maxY, lim.min.y],
    ["Z", "z", lim.maxZ, lim.min.z],
  ];
  for (const [, key, max, min] of axes) {
    const d = delta[key];
    if (d === undefined || d === 0) continue;
    let next = machine[key] + d;
    if (next < min) {
      next = min;
      clamped = true;
    }
    if (max !== null && next > max) {
      next = max;
      clamped = true;
    }
    const cd = next - machine[key];
    if (Math.abs(cd) > 1e-6) out[key] = cd;
    else if (Math.abs(d) > 1e-6) clamped = true;
  }
  return {
    delta: out,
    clamped,
    target: {
      x: machine.x + (out.x ?? 0),
      y: machine.y + (out.y ?? 0),
      z: machine.z + (out.z ?? 0),
    },
  };
}

const clampOrigin = clampJogDelta({ x: 0, y: 0, z: 0 }, { x: -10 }, limits);
assert(clampOrigin.clamped && !clampOrigin.delta.x, "clamp drops −X at origin");
assert(clampOrigin.target.x === 0, "clamp target stays 0");

const clampPartial = clampJogDelta({ x: 0.5, y: 0, z: 0 }, { x: -2 }, limits);
assert(
  Math.abs((clampPartial.delta.x ?? 0) - -0.5) < 1e-9,
  "clamp shrinks to soft min",
);

assert(buildSetWorkZeroCommand("XYZ") === "G10 L20 P1 X0 Y0 Z0", "zero xyz");
assert(buildSetWorkZeroCommand("X") === "G10 L20 P1 X0", "zero x");

const goto = planGoToWorkZero("XYZ");
assert(goto.commands[0].startsWith("$J=G90"), "goto absolute");
assert(goto.commands[0].includes("Z0"), "safe Z first");
assert(goto.commands[1].includes("X0") && goto.commands[1].includes("Y0"), "then XY");

const gotoZ = planGoToWorkZero("Z");
assert(gotoZ.commands.length === 1 && gotoZ.commands[0].includes("Z0"), "Z only");

console.log("ok — jog / work-zero smoke passed");
