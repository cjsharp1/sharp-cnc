/**
 * Smoke: every docs image / local href under docs/ points at an existing file
 * (user-guide + setup-visual assets for Remaining #12–13).
 * Run: npx --yes tsx scripts/smoke-docs-assets.mts
 */
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "js") continue;
      out.push(...(await walk(full)));
    } else if (/\.(md|html)$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Collect relative asset refs from markdown and HTML. */
function refsIn(text: string): string[] {
  const found = new Set<string>();
  // Markdown images / links: ](path) or ](path "title")
  for (const m of text.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const raw = m[1]!;
    if (/^(https?:|mailto:|#)/i.test(raw)) continue;
    found.add(raw.split("#")[0]!);
  }
  // HTML src / href to local assets
  for (const m of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const raw = m[1]!;
    if (/^(https?:|mailto:|#|data:)/i.test(raw)) continue;
    if (!/\.(svg|png|webp|jpg|jpeg|gif|md|html)$/i.test(raw)) continue;
    found.add(raw.split("#")[0]!);
  }
  return [...found];
}

const REQUIRED_NEW = [
  "docs/user-guide/assets/cal-step1-start.png",
  "docs/user-guide/assets/estop-latch.png",
  "docs/user-guide/assets/inputs-pin-lit.png",
  "docs/user-guide/assets/z-gauge-material.png",
  "docs/user-guide/assets/first-run-three-steps.png",
  "docs/user-guide/assets/verify-dry-run.png",
  "docs/user-guide/assets/diagram-soft-limits.svg",
  "docs/user-guide/assets/diagram-z-machine-coords.svg",
  "docs/user-guide/assets/diagram-dry-run-lift.svg",
  "docs/user-guide/assets/diagram-resume-preamble.svg",
  "docs/setup-visual/assets/cal-01-start.svg",
];

const FORBIDDEN = [
  "docs/user-guide/assets/cal-step1-zero.png",
  "docs/setup-visual/assets/cal-01-zero.svg",
  "docs/setup-visual/assets/fr-04-travel.svg",
  "docs/setup-visual/assets/fr-05-stock.svg",
];

console.log("smoke-docs-assets: checking required + links");

for (const rel of REQUIRED_NEW) {
  assert(await exists(path.join(ROOT, rel)), `missing required asset ${rel}`);
}
console.log("  ✓ required Remaining #12–13 assets present");

for (const rel of FORBIDDEN) {
  assert(!(await exists(path.join(ROOT, rel))), `stale asset still present ${rel}`);
}
console.log("  ✓ renamed/deleted assets gone");

const files = await walk(DOCS);
let checked = 0;
const missing: string[] = [];
const staleRefs: string[] = [];

for (const file of files) {
  const text = await readFile(file, "utf8");
  if (/cal-step1-zero|cal-01-zero|fr-04-travel|fr-05-stock/.test(text)) {
    // Spec docs may still mention the rename as historical work items.
    if (!file.includes(`${path.sep}specs${path.sep}`)) {
      staleRefs.push(path.relative(ROOT, file));
    }
  }
  for (const ref of refsIn(text)) {
    if (!/\.(svg|png|webp|jpg|jpeg|gif)$/i.test(ref)) continue;
    const target = path.resolve(path.dirname(file), ref);
    checked++;
    if (!(await exists(target))) {
      missing.push(`${path.relative(ROOT, file)} → ${ref}`);
    }
  }
}

assert(staleRefs.length === 0, `stale renamed asset refs in:\n  ${staleRefs.join("\n  ")}`);
assert(
  missing.length === 0,
  `broken image links (${missing.length}):\n  ${missing.slice(0, 20).join("\n  ")}`,
);
console.log(`  ✓ ${checked} image refs resolve (${files.length} docs files)`);
console.log("smoke-docs-assets: ok");
