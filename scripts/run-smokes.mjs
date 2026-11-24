#!/usr/bin/env node
/**
 * Run SharpCNC smoke scripts one at a time with a per-script timeout, so a
 * hung script fails loudly (and names itself) instead of blocking the suite.
 *
 * Usage: node scripts/run-smokes.mjs critical|full [--timeout=90]
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** PR gate (CI): safety, protocol, calibration, motion paths. */
const CRITICAL = [
  "smoke-parse-status.mjs",
  "smoke-jog-zero.mjs",
  "smoke-gcode-stream.mjs",
  "smoke-gamepad-jog.mjs",
  "smoke-soft-limit-jog.mts",
  "smoke-virtual-cnc.mts",
  "smoke-real-grbl.mts",
  "smoke-activity-safety.mts",
  "smoke-serial-log.mts",
  "smoke-safety-fixes.mts",
  "smoke-calibration.mts",
  "smoke-rates-test.mts",
  "smoke-homing-setup.mts",
  "smoke-soft-travel.mts",
  "smoke-bed-travel.mts",
  "smoke-stock-perimeter.mts",
  "smoke-estop-loop-abort.mts",
  "smoke-ux-cleanup.mts",
  "smoke-probe.mts",
  "smoke-spindle-feeds.mts",
  "smoke-overrides-presets.mts",
  "smoke-external-controls.mts",
  "smoke-first-run.mts",
  "smoke-task-phase.mts",
  "smoke-job-recovery.mts",
  "smoke-app-safety.mts",
  "smoke-tool-change.mts",
  "smoke-stock-tool.mts",
  "smoke-app-update.mts",
  "smoke-layout.mts"
];

/** Full no-hardware suite — required before a tagged release. */
const FULL = [
  "smoke-parse-status.mjs",
  "smoke-jog-zero.mjs",
  "smoke-mock-jog.mjs",
  "smoke-gamepad-jog.mjs",
  "smoke-soft-limit-jog.mts",
  "smoke-gcode-stream.mjs",
  "smoke-virtual-cnc.mts",
  "smoke-real-grbl.mts",
  "smoke-mock-stream.mts",
  "smoke-activity-safety.mts",
  "smoke-serial-log.mts",
  "smoke-safety-fixes.mts",
  "smoke-calibration.mts",
  "smoke-rates-test.mts",
  "smoke-homing-setup.mts",
  "smoke-soft-travel.mts",
  "smoke-bed-travel.mts",
  "smoke-stock-perimeter.mts",
  "smoke-estop-loop-abort.mts",
  "smoke-ux-cleanup.mts",
  "smoke-svg-gcode.mts",
  "smoke-debug-bridge.mts",
  "smoke-stock-tool.mts",
  "smoke-path-sim.mts",
  "smoke-external-jobs.mts",
  "smoke-external-controls.mts",
  "smoke-spindle-feeds.mts",
  "smoke-overrides-presets.mts",
  "smoke-probe.mts",
  "smoke-machine-view.mts",
  "smoke-theme.mts",
  "smoke-layout.mts",
  "smoke-first-run.mts",
  "smoke-job-recovery.mts",
  "smoke-recent-jobs.mts",
  "smoke-full-control.mts",
  "smoke-app-safety.mts",
  "smoke-tool-change.mts",
  "smoke-app-update.mts"
];

const suite = process.argv[2] ?? "critical";
const timeoutArg = process.argv.find((a) => a.startsWith("--timeout="));
const timeoutSec = timeoutArg ? Number(timeoutArg.split("=")[1]) : 90;
const list = suite === "full" ? FULL : suite === "critical" ? CRITICAL : null;
if (!list) {
  console.error(`Unknown suite "${suite}" — use critical or full.`);
  process.exit(2);
}

function run(file) {
  return new Promise((resolve) => {
    const isTs = file.endsWith(".mts");
    const cmd = isTs ? "npx" : "node";
    const args = isTs ? ["--yes", "tsx", path.join(HERE, file)] : [path.join(HERE, file)];
    const started = Date.now();
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ file, ok: false, timedOut: true, secs: timeoutSec, out });
    }, timeoutSec * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ file, ok: code === 0, timedOut: false, secs: (Date.now() - started) / 1000, out });
    });
  });
}

const failures = [];
for (const file of list) {
  const r = await run(file);
  const label = r.ok ? "ok  " : r.timedOut ? "HUNG" : "FAIL";
  console.log(`${label} ${file} (${r.secs.toFixed(1)}s)`);
  if (!r.ok) {
    failures.push(r);
    console.log(r.out.split("\n").slice(-15).join("\n"));
  }
}

console.log(`\n${suite}: ${list.length - failures.length}/${list.length} passed`);
if (failures.length) {
  for (const f of failures) {
    console.log(`  ${f.timedOut ? "timed out after " + timeoutSec + "s" : "failed"}: ${f.file}`);
  }
  process.exit(1);
}
