/**
 * Smoke: UX cleanup O4 + M4 (app-review Remaining #7, #9).
 *
 * 1) Playwright: after Virtual CNC link, only the header chip owns Connect /
 *    Disconnect — no rail/First-run Connect duplicate; Reset lives only on Safety.
 * 2) Playwright: Space triggers Hold when focus is on the page body (not an
 *    input or button); Escape does not act as E-Stop.
 *
 * Run: npx --yes tsx scripts/smoke-ux-cleanup.mts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { MOCK_STRICT_GRBL_KEY } from "../src/grbl/mockSerial.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const VIEWPORT = { width: 1400, height: 900 };

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
}

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

async function seedStorage(
  page: Page,
  firstRunCompleted: boolean,
  opts: { strict?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ done, strictKey, strict }) => {
      localStorage.setItem(
        "sharpcnc.firstRun.v1",
        JSON.stringify({ completed: done, completedAt: Date.now() }),
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
      localStorage.setItem("sharpcnc.uiTheme.v1", JSON.stringify("dark"));
      // Strict: feed hold while Idle → Hold (real GRBL). Needed for Space→Hold.
      if (strict) localStorage.setItem(strictKey, "1");
      else localStorage.removeItem(strictKey);
    },
    {
      done: firstRunCompleted,
      strictKey: MOCK_STRICT_GRBL_KEY,
      strict: !!opts.strict,
    },
  );
}

async function waitApp(page: Page): Promise<void> {
  await page.waitForSelector(".brand__mark", { timeout: 20_000 });
  await page.waitForTimeout(400);
}

async function connectVirtual(page: Page): Promise<void> {
  // Prefer the header port select (still reachable under First-run).
  const select = page.locator(".connect select, select").first();
  if (await select.count()) {
    const options = await select.locator("option").allTextContents();
    const idx = options.findIndex(
      (t) => /virtual|mock/i.test(t) || /MOCK:\/\//i.test(t),
    );
    if (idx >= 0) await select.selectOption({ index: idx });
  }
  // First-run modal intercepts header clicks — use its Connect when open.
  const firstRunConnect = page
    .locator(".firstrun")
    .getByRole("button", { name: /^Connect$/i });
  if (await firstRunConnect.count()) {
    await firstRunConnect.click();
  } else {
    const connectBtn = page.getByRole("button", { name: /^Connect$/i }).first();
    if (await connectBtn.isEnabled()) {
      await connectBtn.click({ force: true }).catch(async () => {
        await connectBtn.click();
      });
    } else {
      const phaseConnect = page
        .locator("#phase-panel-connect")
        .getByRole("button", { name: /Connect/i });
      if (await phaseConnect.count()) await phaseConnect.click();
    }
  }
  await page.waitForFunction(
    () => /Linked|Virtual CNC|Idle/i.test(document.body.innerText),
    { timeout: 15_000 },
  );
  await page.waitForTimeout(600);
}

console.log("smoke-ux-cleanup: Playwright O4 + M4");

const vite = await startVite();
let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
let exitCode = 0;

try {
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

  // --- O4: after connect, one Connect/Disconnect story + one Reset ----------
  {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await seedStorage(page, false);
    await page.goto(vite.base, { waitUntil: "networkidle" });
    await waitApp(page);
    await connectVirtual(page);

    const connectButtons = page.getByRole("button", { name: /^Connect$/i });
    assert(
      (await connectButtons.count()) === 0,
      `after link expected 0 Connect buttons, got ${await connectButtons.count()}`,
    );
    pass("O4: no Connect buttons after link");

    const disconnectButtons = page.getByRole("button", {
      name: /^Disconnect$/i,
    });
    assert(
      (await disconnectButtons.count()) === 1,
      `expected one Disconnect (header), got ${await disconnectButtons.count()}`,
    );
    pass("O4: one Disconnect in header chip");

    const resetButtons = page.getByRole("button", { name: /^Reset$/i });
    assert(
      (await resetButtons.count()) === 1,
      `expected one Reset (Safety only), got ${await resetButtons.count()}`,
    );
    const resetInHeader = page.locator(".connect").getByRole("button", {
      name: /^Reset$/i,
    });
    assert(
      (await resetInHeader.count()) === 0,
      "Reset must not appear in the header connection chip",
    );
    const resetInSafety = page.locator(".safety").getByRole("button", {
      name: /^Reset$/i,
    });
    assert(
      (await resetInSafety.count()) === 1,
      "Reset should live on the Safety strip",
    );
    pass("O4: Reset only on Safety strip");

    // First-run still open after connect — no duplicate Connect there.
    const firstRunConnect = page
      .locator(".firstrun")
      .getByRole("button", { name: /^Connect$/i });
    if (await page.locator(".firstrun").count()) {
      assert(
        (await firstRunConnect.count()) === 0,
        "First-run must hide Connect after link",
      );
      pass("O4: First-run hides Connect after link");
    } else {
      pass("O4: First-run not open (completed) — skip duplicate check");
    }

    // Always-on Coordinates chrome (Material/Machine) — not duplicated inside
    // Calibrate Start / Prepare after O4.
    assert(
      (await page.locator('[aria-label="Coordinates"]').count()) >= 1,
      "chrome Coordinates readout expected",
    );
    pass("O4: chrome Coordinates panel present");
    await context.close();
  }

  // --- M4: Space → Hold; Escape is not E-Stop --------------------------------
  {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await seedStorage(page, true, { strict: true });
    await page.goto(vite.base, { waitUntil: "networkidle" });
    await waitApp(page);
    await connectVirtual(page);

    // Focus a non-interactive surface (machine view) so Space isn't a button press.
    const stage = page.locator(".machine, .viz, canvas, .shell__stage").first();
    if (await stage.count()) {
      await stage.click({ position: { x: 40, y: 40 } }).catch(() => undefined);
    }
    await page.locator("body").evaluate((el) => {
      el.setAttribute("tabindex", "-1");
      (el as HTMLElement).focus();
    });
    await page.waitForTimeout(200);

    await page.keyboard.press("Space");
    await page.waitForTimeout(700);

    const holdState = await page.evaluate(() => {
      const stateEl = document.querySelector(".safety__state");
      return stateEl?.textContent?.trim() ?? "";
    });
    assert(
      /Hold/i.test(holdState),
      `Space should feed-hold → Hold state, got "${holdState}"`,
    );
    pass("M4: Space → Hold when focus is not in a field/button");

    // Escape must not latch E-Stop.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const estopBanner = page.getByText(/E-Stop pressed/i);
    assert(
      (await estopBanner.count()) === 0,
      "Escape must not trigger E-Stop latch",
    );
    pass("M4: Escape is not E-Stop");

    // Space ignored while typing in an input (header port select when offline
    // isn't available; use Advanced console if needed — open Prepare stock field).
    await page.getByRole("tab", { name: /Prepare/i }).click().catch(() => {});
    await page.waitForTimeout(300);
    const numberInput = page.locator('input[type="number"]').first();
    if (await numberInput.count()) {
      // Resume first so we can re-test ignore path cleanly.
      const resume = page.getByRole("button", { name: /^Resume$/i });
      if (await resume.isEnabled()) {
        await resume.click();
        await page.waitForTimeout(400);
      }
      await numberInput.focus();
      await page.keyboard.press("Space");
      await page.waitForTimeout(400);
      const stateWhileTyping = await page.evaluate(() => {
        const stateEl = document.querySelector(".safety__state");
        return stateEl?.textContent?.trim() ?? "";
      });
      assert(
        !/Hold/i.test(stateWhileTyping),
        `Space in a number field must not Hold, got "${stateWhileTyping}"`,
      );
      pass("M4: Space ignored in text/number fields");
    } else {
      pass("M4: no number field found — skip input ignore check");
    }

    await context.close();
  }
} catch (err) {
  exitCode = 1;
  console.error(err instanceof Error ? err.message : String(err));
} finally {
  await browser?.close().catch(() => undefined);
  killProcessTree(vite.child);
}

process.exit(exitCode);
