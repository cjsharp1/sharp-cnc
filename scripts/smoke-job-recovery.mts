/**
 * Smoke: mid-job recovery checkpoint persistence.
 * Run: npx --yes tsx scripts/smoke-job-recovery.mts
 */
import {
  clearJobRecoveryCheckpoint,
  formatRecoveryPos,
  isIncompleteRecovery,
  loadJobRecoveryCheckpoint,
  recoveryResumeLineLabel,
  saveJobRecoveryCheckpoint,
  type JobRecoveryCheckpoint,
} from "../src/grbl/jobRecovery.ts";

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

assert(loadJobRecoveryCheckpoint() === null, "empty");
assert(isIncompleteRecovery(null) === false, "null incomplete");

const cp: JobRecoveryCheckpoint = {
  jobName: "part.nc",
  totalLines: 100,
  nextLine: 42,
  absoluteLine: 42,
  work: { x: 10, y: 20, z: -1.5 },
  machine: { x: 10, y: 20, z: 5 },
  phase: "paused",
  savedAt: 1_700_000_000_000,
  dryRun: false,
};
saveJobRecoveryCheckpoint(cp);
const loaded = loadJobRecoveryCheckpoint();
assert(loaded?.jobName === "part.nc", "name");
assert(loaded?.nextLine === 42, "line");
assert(isIncompleteRecovery(loaded) === true, "incomplete");
assert(recoveryResumeLineLabel(loaded!) === "line 43 of 100", "label");
assert(
  formatRecoveryPos(loaded!.work) === "X10.000 Y20.000 Z-1.500",
  "pos",
);

saveJobRecoveryCheckpoint({ ...cp, nextLine: 100, absoluteLine: 100 });
assert(isIncompleteRecovery(loadJobRecoveryCheckpoint()) === false, "done");

clearJobRecoveryCheckpoint();
assert(loadJobRecoveryCheckpoint() === null, "cleared");

console.log("smoke-job-recovery: ok");
