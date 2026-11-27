/**
 * Smoke: E-Stop aborts the bed travel loop (app-review Remaining #4 / R1).
 *
 * 1) Unit: strict GRBL mock hold-during-jog → Idle (real path Virtual CNC hid).
 * 2) Playwright: start bed travel on Virtual CNC (strict mode), E-Stop after
 *    the first `$J=`, assert no further `$J=` writes and the latch banner shows.
 *
 * Reuses the Playwright bootstrap style of scripts/capture-guide-screenshots.mts.
 * Run: npx --yes tsx scripts/smoke-estop-loop-abort.mts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { createGrblClient } from "../src/grbl/client.ts";
import {
  MOCK_STRICT_GRBL_KEY,
  createMockTransport,
} from "../src/grbl/mockSerial.ts";
import { SMOKE_TX_LOG_KEY } from "../src/grbl/instrumentTransport.ts";
import type { GrblStatus } from "../src/grbl/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VIEWPORT = { width: 1400, height: 900 };

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

// --- 1. Mock: hold during jog → Idle (covers the real-GRBL bug class) --------

console.log("smoke-estop-loop-abort: mock hold-during-jog");

{
  const t = createMockTransport({ strict: true });
  const client = createGrblClient(t, {
    softResetOnConnect: true,
    statusPollMs: 40,
  });
  let latest: GrblStatus | null = null;
  const unsub = client.onStatus((s) => {
    latest = s;
  });
  await client.connect({ path: "MOCK://grbl-demo" });
  await new Promise((r) => setTimeout(r, 120));

  await client.sendLine("$J=G91 X200 F500");
  let sawJog = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 30));
    await client.requestStatus().catch(() => undefined);
    if (latest?.state === "Jog") {
      sawJog = true;
      break;
    }
  }
  assert(sawJog, `expected Jog before hold, got ${latest?.state}`);

  await client.feedHold();
  await new Promise((r) => setTimeout(r, 60));
  await client.requestStatus().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 40));
  assert(
    latest?.state === "Idle",
    `hold during jog → Idle (real GRBL), got ${latest?.state}`,
  );
  pass("createMockTransport({ strict: true }) → Idle on ! during Jog");

  // Default mock still stays Hold (documented Virtual CNC delta).
  unsub();
  await client.disconnect();

  const legacy = createMockTransport();
  const legacyClient = createGrblClient(legacy, {
    softResetOnConnect: true,
    statusPollMs: 40,
  });
  let legacyStatus: GrblStatus | null = null;
  const unsubLegacy = legacyClient.onStatus((s) => {
    legacyStatus = s;
  });
  await legacyClient.connect({ path: "MOCK://grbl-demo" });
  await new Promise((r) => setTimeout(r, 120));
  await legacyClient.sendLine("$J=G91 X200 F500");
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 30));
    await legacyClient.requestStatus().catch(() => undefined);
    if (legacyStatus?.state === "Jog") break;
  }
  await legacyClient.feedHold();
  await new Promise((r) => setTimeout(r, 60));
  await legacyClient.requestStatus().catch(() => undefined);
  await new Promise((r) => setTimeout(r, 40));
  assert(
    legacyStatus?.state === "Hold",
    `default mock stays Hold during jog, got ${legacyStatus?.state}`,
  );
  pass("default Virtual CNC still Hold during jog (mock-vs-real)");
  unsubLegacy();
  await legacyClient.disconnect();
}

// --- 2. Playwright: bed travel + E-Stop → no further $J= + latch banner ------

console.log("smoke-estop-loop-abort: Playwright UI");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      if (!addr || typeof addr === "string") {
        s.close();
        reject(new Error("could not bind ephemeral port"));
        return;
      }
      const port = addr.port;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on("error", reject);
  });
}

async function waitHttpOk(url: string, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Vite not ready at ${url}: ${lastErr}`);
}

function killProcessTree(child: ChildProcess): void {
  if (child.pid) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

async function startVite(): Promise<{ base: string; child: ChildProcess }> {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(
    "npx",
    ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, BROWSER: "none" },
      // New process group so we can SIGKILL vite + children on exit.
      detached: true,
    },
  );
  let bootLog = "";
  child.stdout?.on("data", (d) => {
    bootLog += d.toString();
  });
  child.stderr?.on("data", (d) => {
    bootLog += d.toString();
  });
  try {
    await waitHttpOk(base);
  } catch (err) {
    killProcessTree(child);
    throw new Error(
      `${err instanceof Error ? err.message : String(err)}\n--- vite ---\n${bootLog.slice(-2000)}`,
    );
  }
  return { base, child };
}

async function seedStorage(page: Page): Promise<void> {
  await page.addInitScript(
    ({ strictKey, txKey }) => {
      localStorage.setItem(
        "sharpcnc.firstRun.v1",
        JSON.stringify({ completed: true, completedAt: Date.now() }),
      );
      localStorage.setItem(
        "sharpcnc.calibration.v1",
        JSON.stringify({
          calibrationCompleted: true,
          completedAt: Date.now(),
        }),
      );
      localStorage.setItem(
        "sharpcnc.softTravel.v1",
        JSON.stringify({
          maxX: 1000,
          maxY: 1000,
          maxZ: 200,
          min: { x: 0, y: 0, z: 0 },
        }),
      );
      localStorage.setItem("sharpcnc.debugMode.v1", JSON.stringify(true));
      localStorage.setItem("sharpcnc.uiTheme.v1", JSON.stringify("dark"));
      // Strict GRBL (hold-during-jog → Idle) + TX probe for $J= counting.
      localStorage.setItem(strictKey, "1");
      localStorage.setItem(txKey, "1");
    },
    {
      strictKey: MOCK_STRICT_GRBL_KEY,
      txKey: SMOKE_TX_LOG_KEY,
    },
  );
}

async function waitApp(page: Page): Promise<void> {
  await page.waitForSelector(".brand__mark", { timeout: 20_000 });
  await page.waitForTimeout(400);
}

async function connectVirtual(page: Page): Promise<void> {
  const select = page.locator("select").first();
  if (await select.count()) {
    const options = await select.locator("option").allTextContents();
    const idx = options.findIndex(
      (t) => /virtual|mock/i.test(t) || /MOCK:\/\//i.test(t),
    );
    if (idx >= 0) await select.selectOption({ index: idx });
  }
  // Header chip (or First-run) owns Connect — no right-rail Connect tab.
  const firstRunConnect = page
    .locator(".firstrun")
    .getByRole("button", { name: /^Connect$/i });
  if (await firstRunConnect.count()) {
    await firstRunConnect.click();
  } else {
    const connectBtn = page
      .locator(".connect")
      .getByRole("button", { name: /^Connect$/i })
      .first();
    await connectBtn.click();
  }
  await page.waitForFunction(
    () => /Linked|Virtual CNC|Idle/i.test(document.body.innerText),
    { timeout: 15_000 },
  );
  await page.waitForTimeout(600);
}

function countJogWrites(tx: string[]): number {
  return tx.filter((line) => /^\$J=/i.test(line)).length;
}

async function readTx(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__SHARPCNC_TX__?.slice() ?? []);
}

const vite = await startVite();
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let exitCode = 0;

try {
  // Prefer CHROME_PATH (CI / capture-guide-screenshots), then common
  // system Chrome paths, else Playwright's bundled Chromium if installed.
  const chromeCandidates = [
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter((p): p is string => !!p);
  let executablePath: string | undefined;
  for (const candidate of chromeCandidates) {
    try {
      const { accessSync, constants } = await import("node:fs");
      accessSync(candidate, constants.X_OK);
      executablePath = candidate;
      break;
    } catch {
      /* try next */
    }
  }
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await seedStorage(page);
  await page.goto(vite.base, { waitUntil: "networkidle" });
  await waitApp(page);
  await connectVirtual(page);

  // Open bed travel (refreshes $$ so softLimitsOn becomes true).
  await page.getByRole("button", { name: /Menu/i }).click();
  await page.waitForTimeout(200);
  await page.getByRole("menuitem", { name: /Bed travel test/i }).click();
  await page.waitForSelector('[aria-label="Bed travel test"]', {
    timeout: 10_000,
  });
  // Wait for settings refresh / gate ready.
  await page.waitForFunction(
    () => {
      const warn = document.querySelector(".bedtravel__warn");
      const start = document.querySelector(
        "button.bedtravel__btn--primary",
      ) as HTMLButtonElement | null;
      // Ready when Start exists and soft-limit warn is gone (confirm still needed).
      return !!start && !warn;
    },
    { timeout: 15_000 },
  );
  await page.waitForTimeout(400);

  await page.locator("#bedtravel-confirm").check({ force: true });
  const startBtn = page.getByRole("button", { name: /Start bed travel/i });
  await startBtn.waitFor({ state: "visible" });
  assert(await startBtn.isEnabled(), "Start bed travel should enable after confirm");

  // Clear TX probe after connect chatter so we only count bed-travel jogs.
  await page.evaluate(() => {
    window.__SHARPCNC_TX__ = [];
  });

  await startBtn.click();

  // Wait for the first $J= segment write.
  await page.waitForFunction(
    () => (window.__SHARPCNC_TX__ ?? []).some((line) => /^\$J=/i.test(line)),
    { timeout: 15_000 },
  );
  await page.waitForTimeout(200);
  const afterFirst = await readTx(page);
  const jogAfterFirst = countJogWrites(afterFirst);
  assert(jogAfterFirst >= 1, `expected ≥1 $J= after start, got ${jogAfterFirst}`);
  pass(`first bed-travel $J= written (${jogAfterFirst})`);

  // E-Stop while the loop can still schedule more segments.
  // Bed travel dialog covers the Safety strip; dispatch a real click on the
  // E-Stop control so React's onClick (handleEstop) still runs.
  const estopClicked = await page.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>(
      'button.safety__estop, button[aria-label="Emergency stop"]',
    );
    if (!btn || btn.disabled) return false;
    btn.click();
    return true;
  });
  assert(estopClicked, "E-Stop button was clickable");

  await page.waitForFunction(
    () =>
      !!document.querySelector(".safety__banner") &&
      /E-Stop pressed — motion locked/i.test(
        document.querySelector(".safety__banner")?.textContent ?? "",
      ),
    { timeout: 8_000 },
  );
  pass("E-Stop latch banner present");

  const jogAtEstop = countJogWrites(await readTx(page));

  // Hold long enough that a non-aborted loop would emit another cruise $J=.
  await page.waitForTimeout(2500);

  const jogFinal = countJogWrites(await readTx(page));
  assert(
    jogFinal === jogAtEstop,
    `no further $J= after E-Stop (at stop=${jogAtEstop}, later=${jogFinal})`,
  );
  pass(`no further $J= after E-Stop (count stayed ${jogFinal})`);

  // Aborted copy in the bed travel panel.
  await page.waitForFunction(
    () => /abort/i.test(document.body.innerText),
    { timeout: 5_000 },
  );
  pass("bed travel shows aborted");

  await context.close();
} catch (err) {
  exitCode = 1;
  console.error(err);
} finally {
  if (browser) await browser.close().catch(() => undefined);
  killProcessTree(vite.child);
}

console.log(
  exitCode === 0
    ? "smoke-estop-loop-abort: ok"
    : "smoke-estop-loop-abort: FAIL",
);
process.exit(exitCode);
