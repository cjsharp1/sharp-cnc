/**
 * Smoke: first-run completion flag persistence.
 * Run: npx --yes tsx scripts/smoke-first-run.mts
 */
import {
  DEFAULT_FIRST_RUN,
  loadFirstRunState,
  resetFirstRunState,
  saveFirstRunCompleted,
} from "../src/grbl/firstRunConfig.ts";

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

assert(loadFirstRunState().completed === DEFAULT_FIRST_RUN.completed, "default");
const done = saveFirstRunCompleted(true);
assert(done.completed === true, "completed");
assert(typeof done.completedAt === "number", "timestamp");
assert(loadFirstRunState().completed === true, "reload");
const reset = resetFirstRunState();
assert(reset.completed === false, "reset");
assert(loadFirstRunState().completed === false, "reset reload");

console.log("smoke-first-run: ok");
