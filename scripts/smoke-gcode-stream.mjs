/**
 * Smoke checks for G-code parse/path extract + character-counting streamer
 * against the mock transport behavior (inlined lightly).
 * Run: node scripts/smoke-gcode-stream.mjs
 */

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stripGcodeComments(rawLine) {
  let line = rawLine.replace(/\([^)]*\)/g, "");
  const semi = line.indexOf(";");
  if (semi >= 0) line = line.slice(0, semi);
  return line.trim();
}

function parseGcodeLines(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = stripGcodeComments(raw);
    if (!line || line === "%") continue;
    out.push(line);
  }
  return out;
}

function parseWordValue(line, letter) {
  const re = new RegExp(`\\b${letter}\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
  const m = re.exec(line);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function hasMotion(line) {
  if (/\bG0+0\b/i.test(line) || /\bG0(?!\d)/i.test(line)) return "rapid";
  if (/\bG0*1\b/i.test(line)) return "feed";
  if (/\bG0*[23]\b/i.test(line)) return "feed";
  return null;
}

function extractToolpath(lines) {
  let absolute = true;
  let modalMotion = null;
  let pos = { x: 0, y: 0, z: 0 };
  const path = [];
  for (const line of lines) {
    if (/\bG90\b/i.test(line)) absolute = true;
    if (/\bG91\b/i.test(line)) absolute = false;
    const motion = hasMotion(line);
    if (motion) modalMotion = motion;
    const xWord = parseWordValue(line, "X");
    const yWord = parseWordValue(line, "Y");
    const zWord = parseWordValue(line, "Z");
    if (xWord === undefined && yWord === undefined && zWord === undefined) continue;
    const next = { ...pos };
    if (xWord !== undefined) next.x = absolute ? xWord : pos.x + xWord;
    if (yWord !== undefined) next.y = absolute ? yWord : pos.y + yWord;
    if (zWord !== undefined) next.z = absolute ? zWord : pos.z + zWord;
    const xyChanged = next.x !== pos.x || next.y !== pos.y;
    if (xyChanged && (motion || modalMotion)) {
      path.push({
        from: { x: pos.x, y: pos.y },
        to: { x: next.x, y: next.y },
        motion: motion ?? modalMotion,
      });
    }
    pos = next;
  }
  return path;
}

function canStartJob(state, connected) {
  if (!connected) return { ok: false, reason: "Connect first" };
  if (state === "Alarm") return { ok: false, reason: "Alarm" };
  if (state === "Hold") return { ok: false, reason: "Hold" };
  if (state === "Run" || state === "Jog") return { ok: false, reason: "Busy" };
  return { ok: true };
}

const sample = `%
(test square)
G21 G90
G0 X10 Y10
G1 Z-1 F200
G1 X50 F800
G1 Y50
G1 X10
G1 Y10
G0 Z5
M2
`;

const lines = parseGcodeLines(sample);
assert(lines[0] === "G21 G90", `first line: ${lines[0]}`);
assert(!lines.some((l) => l.includes("%") || l.startsWith("(")), "comments/percent stripped");
assert(lines.includes("G0 X10 Y10"), "rapid present");

const path = extractToolpath(lines);
assert(path.length >= 5, `path segments: ${path.length}`);
assert(path[0].motion === "rapid", "first segment rapid");
assert(path.some((s) => s.motion === "feed"), "has feed segments");

assert(canStartJob("Idle", true).ok, "idle can start");
assert(!canStartJob("Alarm", true).ok, "alarm blocked");
assert(!canStartJob("Idle", false).ok, "disconnected blocked");
assert(!canStartJob("Hold", true).ok, "hold blocked");

// Mini character-counting streamer against a fake ok-per-line transport.
async function streamOnce(jobLines) {
  const RX = 128;
  let sendIndex = 0;
  let bufferUsed = 0;
  const pending = [];
  const sent = [];
  const acked = [];

  const trySend = () => {
    while (sendIndex < jobLines.length) {
      const payload = `${jobLines[sendIndex]}\n`;
      if (bufferUsed + payload.length > RX) break;
      sent.push(jobLines[sendIndex]);
      pending.push({ chars: payload.length, index: sendIndex });
      bufferUsed += payload.length;
      sendIndex += 1;
    }
  };

  trySend();
  assert(sent.length > 0, "buffered some lines");
  assert(bufferUsed <= RX, "respects RX buffer");

  while (acked.length < jobLines.length) {
    assert(pending.length > 0, "pending while incomplete");
    const item = pending.shift();
    bufferUsed -= item.chars;
    acked.push(item.index);
    trySend();
  }

  assert(acked.length === jobLines.length, "all acked");
  assert(sent.length === jobLines.length, "all sent");
}

await streamOnce(lines);

console.log("ok — gcode parse / path / stream smoke passed");
