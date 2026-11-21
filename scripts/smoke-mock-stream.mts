/**
 * Integration smoke: real streamer + mock transport (pause / resume / stop).
 * Run: npx tsx scripts/smoke-mock-stream.mts
 */
import { createGrblClient } from "../src/grbl/client.ts";
import { canStartJob, loadJobFromText } from "../src/grbl/gcode.ts";
import { createMockTransport } from "../src/grbl/mockSerial.ts";
import { createGcodeStreamer } from "../src/grbl/streamer.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const sample = `G21 G90
G0 X10 Y10
G1 X30 F2000
G1 Y30
G1 X10
G1 Y10
G0 Z5
`;

async function main() {
  const job = loadJobFromText("t.nc", sample);
  assert(job.path.length >= 4, `path too short: ${job.path.length}`);

  const transport = createMockTransport();
  const client = createGrblClient(transport, {
    softResetOnConnect: false,
    statusPollMs: 10_000,
  });
  await client.connect({ path: "MOCK://grbl-demo" });

  let last: { phase: string; percent: number; sentLines: number } | null = null;
  const streamer = createGcodeStreamer(transport, {
    onProgress: (p) => {
      last = p;
    },
  });

  assert(canStartJob("Idle", true).ok, "can start");

  const startPromise = streamer.start(job.lines);
  await new Promise((r) => setTimeout(r, 80));
  assert(last && last.phase === "running", `running ${JSON.stringify(last)}`);
  assert(last.sentLines > 0, "sent some");

  await streamer.pause();
  await new Promise((r) => setTimeout(r, 40));
  assert(last.phase === "paused", `paused ${last.phase}`);

  await streamer.resume();
  await new Promise((r) => setTimeout(r, 40));
  assert(
    last.phase === "running" || last.phase === "completed",
    `resumed ${last.phase}`,
  );

  await startPromise;
  assert(last.phase === "completed", `completed ${last.phase}`);
  assert(last.percent === 100, "100%");

  const job2 = loadJobFromText("t2.nc", sample + sample);
  const p2 = streamer.start(job2.lines);
  await new Promise((r) => setTimeout(r, 60));
  await streamer.stop();
  await p2;
  assert(last.phase === "idle", `stopped to idle (${last.phase})`);

  await client.disconnect();
  streamer.dispose();
  console.log("ok — mock streamer integration passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
