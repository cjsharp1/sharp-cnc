/**
 * Smoke: recent job library + thumbnail SVG.
 * Run: npx --yes tsx scripts/smoke-recent-jobs.mts
 */
import {
  loadRecentJobs,
  recentJobThumbnailSvg,
  rememberRecentJob,
  removeRecentJob,
} from "../src/grbl/recentJobs.ts";
import { jobsFolderHealthLabel } from "../src/grbl/jobsFolderConfig.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size;
  },
} as Storage;

assert(loadRecentJobs().length === 0, "empty");
assert(jobsFolderHealthLabel("ok") === "Watching", "health");

let list = rememberRecentJob({
  name: "demo.nc",
  text: "G0 X0 Y0\nG1 X10 Y0 F800\n",
  kind: "gcode",
  lineCount: 2,
  path: [
    {
      from: { x: 0, y: 0, z: 0 },
      to: { x: 10, y: 0, z: 0 },
      motion: "feed",
    },
  ],
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 0 },
});
assert(list.length === 1, "one");
assert(list[0].name === "demo.nc", "name");
const svg = recentJobThumbnailSvg(list[0], 48);
assert(svg.includes("<svg"), "svg");
assert(svg.includes("line"), "path line");

list = rememberRecentJob({
  name: "demo.nc",
  text: "G0 X0\n",
  kind: "gcode",
  lineCount: 1,
  path: [],
  bounds: null,
});
assert(list.length === 1, "dedupe");
assert(list[0].lineCount === 1, "updated");

list = removeRecentJob(list[0].id);
assert(list.length === 0, "removed");

console.log("smoke-recent-jobs: ok");
