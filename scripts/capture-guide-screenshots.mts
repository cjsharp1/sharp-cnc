/**
 * Capture SharpCNC user-guide screenshots against the Vite app (Virtual CNC).
 * Usage: npx tsx scripts/capture-guide-screenshots.mts [baseUrl]
 */
import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs/user-guide/assets");
const BASE = process.argv[2] ?? "http://127.0.0.1:5173";

const VIEWPORT = { width: 1400, height: 900 };

async function seedStorage(
  page: Page,
  opts: { firstRun?: boolean; calibrated?: boolean; debug?: boolean } = {},
) {
  const {
    firstRun = true,
    calibrated = false,
    debug = false,
  } = opts;
  await page.addInitScript(
    ({ firstRun, calibrated, debug }) => {
      localStorage.setItem(
        "sharpcnc.firstRun.v1",
        JSON.stringify({
          completed: firstRun,
          completedAt: firstRun ? Date.now() : null,
        }),
      );
      localStorage.setItem(
        "sharpcnc.calibration.v1",
        JSON.stringify({
          calibrationCompleted: calibrated,
          completedAt: calibrated ? Date.now() : null,
        }),
      );
      localStorage.setItem(
        "sharpcnc.debugMode.v1",
        JSON.stringify(debug),
      );
      localStorage.setItem("sharpcnc.uiTheme.v1", JSON.stringify("dark"));
    },
    { firstRun, calibrated, debug },
  );
}

async function waitApp(page: Page) {
  await page.waitForSelector(".brand__mark", { timeout: 20000 });
  await page.waitForTimeout(400);
}

async function connectVirtual(page: Page) {
  // Prefer Virtual CNC in the port select if present.
  const select = page.locator("select").first();
  if (await select.count()) {
    const options = await select.locator("option").allTextContents();
    const idx = options.findIndex(
      (t) => /virtual|mock/i.test(t) || /MOCK:\/\//i.test(t),
    );
    if (idx >= 0) await select.selectOption({ index: idx });
  }
  const connectBtn = page.getByRole("button", { name: /^Connect$/i }).first();
  if (await connectBtn.isEnabled()) {
    await connectBtn.click();
  } else {
    // Header may already expose Connect differently — try phase panel Connect.
    const phaseConnect = page.locator("#phase-panel-connect").getByRole("button", {
      name: /Connect/i,
    });
    if (await phaseConnect.count()) await phaseConnect.click();
  }
  await page.waitForTimeout(800);
  // Linked / Virtual status should appear.
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return /Linked|Virtual CNC|Idle/i.test(text);
    },
    { timeout: 15000 },
  );
  await page.waitForTimeout(500);
}

async function clickPhase(page: Page, name: string) {
  const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
  await tab.click({ force: true }).catch(async () => {
    // Locked tabs may need prior gates — force via JS if enabled.
    await page.evaluate((label) => {
      const tabs = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      );
      const hit = tabs.find((t) =>
        (t.textContent ?? "").toLowerCase().includes(label.toLowerCase()),
      );
      if (hit && !hit.disabled) hit.click();
    }, name);
  });
  await page.waitForTimeout(400);
}

async function shot(page: Page, file: string) {
  const dest = path.join(OUT, file);
  await page.screenshot({ path: dest, type: file.endsWith(".png") ? "png" : undefined });
  // Playwright webp: use png then convert if needed — prefer png for cal, webp via chromium.
  console.log("wrote", path.relative(ROOT, dest));
}

async function shotWebp(page: Page, file: string) {
  // Capture PNG buffer then convert with sharp if available; else write PNG sibling and use chromium CDP.
  const pngPath = path.join(OUT, file.replace(/\.webp$/, ".capture.png"));
  await page.screenshot({ path: pngPath, type: "png" });
  // Prefer native webp via Playwright fullPage false + chrome — use CDP Page.captureScreenshot.
  const client = await page.context().newCDPSession(page);
  const { data } = await client.send("Page.captureScreenshot", {
    format: "webp",
    quality: 82,
  });
  const dest = path.join(OUT, file);
  await writeFile(dest, Buffer.from(data, "base64"));
  await client.detach();
  // Clean temp png
  const { unlink } = await import("node:fs/promises");
  await unlink(pngPath).catch(() => undefined);
  console.log("wrote", path.relative(ROOT, dest));
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: /Menu/i }).click();
  await page.waitForTimeout(300);
}

async function prepareThroughReady(page: Page) {
  await clickPhase(page, "Prepare");

  // Stock step — confirm next
  const stockNext = page.getByRole("button", {
    name: /Stock looks good — Next/i,
  });
  if (await stockNext.count()) {
    // Confirm checkbox if present
    const stockConfirm = page.locator("#prep-confirm-stock, label:has-text('Stock')").first();
    const checkbox = page.locator('.prep input[type="checkbox"], .cal input[type="checkbox"]').first();
    if (await checkbox.count()) {
      await checkbox.check({ force: true }).catch(() => undefined);
    }
    // WizardStepConfirm is usually a checkbox with label
    const confirms = page.locator('input[type="checkbox"]');
    const n = await confirms.count();
    for (let i = 0; i < n; i++) {
      const box = confirms.nth(i);
      if (!(await box.isChecked())) {
        await box.check({ force: true }).catch(() => undefined);
      }
    }
    await page.waitForTimeout(200);
    if (await stockNext.isEnabled()) await stockNext.click();
  }

  // XY — Zero XY then next
  const zeroXy = page.getByRole("button", { name: /Zero XY/i }).first();
  if (await zeroXy.count()) {
    await zeroXy.click();
    await page.waitForTimeout(400);
  }
  const xyNext = page.getByRole("button", { name: /XY set — Next/i });
  if (await xyNext.count() && (await xyNext.isEnabled())) await xyNext.click();
  await page.waitForTimeout(300);

  // Z — Manual Zero Z + plate confirm
  const manualZ = page.getByRole("button", { name: /Manual Zero Z/i }).first();
  if (await manualZ.count()) {
    await manualZ.click();
    await page.waitForTimeout(400);
  }
  const zConfirms = page.locator('input[type="checkbox"]');
  const zn = await zConfirms.count();
  for (let i = 0; i < zn; i++) {
    const box = zConfirms.nth(i);
    if (!(await box.isChecked())) {
      await box.check({ force: true }).catch(() => undefined);
    }
  }
  const zNext = page.getByRole("button", { name: /Z clear — Next/i });
  if (await zNext.count() && (await zNext.isEnabled())) await zNext.click();
  await page.waitForTimeout(300);

  // Load — sample SVG → generate
  const sample100 = page.getByRole("button", { name: /100×100|100x100/i }).first();
  if (await sample100.count()) {
    await sample100.click();
    await page.waitForTimeout(400);
  } else {
    // Try samples dropdown / any sample
    const sample = page.locator("button", { hasText: /Sample|50×50|100 mm/i }).first();
    if (await sample.count()) await sample.click();
    await page.waitForTimeout(400);
  }
  const generate = page.getByRole("button", { name: /Generate → Job|Generate/i }).first();
  if (await generate.count() && (await generate.isEnabled())) {
    await generate.click();
    await page.waitForTimeout(600);
  }
  // Advance past load if Next available
  const loadNext = page.getByRole("button", { name: /^Next$/i }).last();
  // Prefer step-specific next in footer
  const footerNext = page.locator(".cal__nav .cal__btn").filter({ hasText: /Next|Load/i }).last();
  if (await footerNext.count() && (await footerNext.isEnabled())) {
    await footerNext.click().catch(() => undefined);
  } else if (await loadNext.count() && (await loadNext.isEnabled())) {
    await loadNext.click().catch(() => undefined);
  }
  await page.waitForTimeout(400);

  // If still on load with a Next that needs job — click any enabled Next in nav
  for (let i = 0; i < 3; i++) {
    const navNext = page.locator("footer.cal__nav button.cal__btn:not(.cal__btn--ghost)");
    if ((await navNext.count()) && (await navNext.first().isEnabled())) {
      const label = await navNext.first().innerText();
      if (/Mark ready|Continue to Verify/i.test(label)) break;
      await navNext.first().click();
      await page.waitForTimeout(350);
    } else break;
  }

  const markReady = page.getByRole("button", {
    name: /Mark ready → Verify|Continue to Verify/i,
  }).first();
  if (await markReady.count() && (await markReady.isEnabled())) {
    await markReady.click();
    await page.waitForTimeout(600);
  }
}

async function withFreshPage(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  seed: Parameters<typeof seedStorage>[1],
  run: (page: Page) => Promise<void>,
) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await seedStorage(page, seed);
  await page.goto(BASE, { waitUntil: "networkidle" });
  await waitApp(page);
  await run(page);
  await context.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // CHROME_PATH lets the script use an installed Chrome when Playwright's own
  // browser isn't downloaded (e.g. CHROME_PATH=/usr/bin/google-chrome).
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });

  // 1) Connected shell — calibrated → Prepare landing
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await clickPhase(page, "Prepare");
    await page.waitForTimeout(500);
    await shot(page, "ui-connected.png");
    // Header connection chip (Virtual CNC) — clip top brand + strip
    const dest = path.join(OUT, "usb-connected.png");
    await page.screenshot({
      path: dest,
      type: "png",
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: 220 },
    });
    console.log("wrote", path.relative(ROOT, dest));
  });

  // 2) Menu open
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await openMenu(page);
    await shotWebp(page, "menu-open.webp");
  });

  // 3) Jog pad in Prepare XY step
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await clickPhase(page, "Prepare");
    // Confirm stock to reach XY
    const boxes = page.locator('input[type="checkbox"]');
    if (await boxes.count()) await boxes.first().check({ force: true }).catch(() => undefined);
    const stockNext = page.getByRole("button", { name: /Stock looks good — Next/i });
    if (await stockNext.count() && (await stockNext.isEnabled())) await stockNext.click();
    await page.waitForTimeout(400);
    await shotWebp(page, "jog-pad.webp");
  });

  // 4) Stock corner on Prepare stock step
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await clickPhase(page, "Prepare");
    // Click a bed corner if present (NW/NE/SW/SE)
    const corner = page.getByRole("button", { name: /^(NW|NE|SW|SE)$/i }).first();
    if (await corner.count()) await corner.click();
    await page.waitForTimeout(300);
    await shotWebp(page, "stock-corner.webp");
  });

  // 5) Calibrate steps (not yet calibrated) — confirm + Next to unlock each step
  await withFreshPage(browser, { calibrated: false }, async (page) => {
    await connectVirtual(page);
    await clickPhase(page, "Calibrate");
    // Wait for $$ load so meta bar shows "Back up settings"
    await page
      .getByRole("button", { name: /Back up settings/i })
      .waitFor({ timeout: 15000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    await shot(page, "cal-step1-zero.png");

    async function confirmAndNext(confirmId: string) {
      await page.waitForSelector(`#${confirmId}`, { timeout: 20000 });
      // Controlled React checkbox — enable + click via DOM (Playwright check()
      // can hang when the input is disabled briefly during settings load).
      await page.evaluate((id) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (!el) throw new Error(`missing #${id}`);
        el.disabled = false;
        el.click();
      }, confirmId);
      await page.waitForTimeout(300);
      const next = page
        .locator("footer.cal__nav button.cal__btn:not(.cal__btn--ghost)")
        .first();
      await next.click({ force: true });
      await page.waitForTimeout(600);
    }

    // zero → direction → steps/mm → speed & accel → soft travel
    await confirmAndNext("cal-confirm-zero");
    await page.waitForTimeout(300);
    await shot(page, "cal-step-direction.png");
    await confirmAndNext("cal-confirm-direction");
    await page.waitForTimeout(300);
    await shot(page, "cal-step2-steps.png");

    await confirmAndNext("cal-confirm-steps");
    await page.waitForTimeout(300);
    await shot(page, "cal-step-rates.png");
    // Z tab for the gravity callout
    const zTab = page.getByRole("tab", { name: /^Z$/i }).first();
    if (await zTab.count()) {
      await zTab.click();
      await page.waitForTimeout(200);
      await shot(page, "cal-step-rates-z.png");
    }

    await confirmAndNext("cal-confirm-rates");
    await page.waitForTimeout(300);
    await shot(page, "cal-step3-travel.png");
  });

  // 5b) Advanced restore diff (after a Calibrate auto-backup + one manual write)
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await clickPhase(page, "Calibrate");
    await page
      .getByRole("button", { name: /Back up settings/i })
      .waitFor({ timeout: 15000 })
      .catch(() => undefined);
    await page.waitForTimeout(300);
    await openMenu(page);
    const advanced = page.getByRole("menuitem", { name: /Advanced/i }).first();
    const advancedBtn = page.getByRole("button", { name: /Advanced/i }).first();
    if (await advanced.count()) await advanced.click();
    else if (await advancedBtn.count()) await advancedBtn.click();
    else {
      await page.locator("text=Advanced").first().click().catch(() => undefined);
    }
    await page.waitForTimeout(500);
    // Change one setting so the restore table has a row.
    const idInput = page.locator(".manual-settings__input").first();
    const valInput = page.locator(".manual-settings__input").nth(1);
    if ((await idInput.count()) && (await valInput.count())) {
      await idInput.fill("100");
      await valInput.fill("999");
      const writeBtn = page.getByRole("button", { name: /^Write \$/i }).first();
      if (await writeBtn.count()) {
        await writeBtn.click();
        await page.waitForTimeout(800);
      }
    }
    // Re-read so the restore diff matches live EEPROM.
    const readBtn = page
      .locator(".settings-restore")
      .getByRole("button", { name: /Read \$\$/i })
      .first();
    if (await readBtn.count()) {
      await readBtn.click();
      await page.waitForTimeout(800);
    }
    const restore = page.locator(".settings-restore").first();
    if (await restore.count()) {
      await restore.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await restore.screenshot({
        path: path.join(OUT, "cal-restore-diff.png"),
      });
      console.log(
        "wrote",
        path.relative(ROOT, path.join(OUT, "cal-restore-diff.png")),
      );
    } else {
      await shot(page, "cal-restore-diff.png");
    }
  });

  // 6) Verify / simulate + job loaded
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await prepareThroughReady(page);
    // Should be on Verify
    await clickPhase(page, "Verify");
    await page.waitForTimeout(500);
    const play = page.getByRole("button", { name: /^Play$/i }).first();
    if (await play.count() && (await play.isEnabled())) {
      await play.click();
      await page.waitForTimeout(800);
    }
    await shotWebp(page, "job-simulate.webp");
  });

  // 7) Debug / activity log
  await withFreshPage(
    browser,
    { calibrated: true, debug: true },
    async (page) => {
      await connectVirtual(page);
      await openMenu(page);
      const activity = page.getByRole("menuitem", { name: /Activity|Log|Debug/i }).first();
      const activityBtn = page.getByRole("button", { name: /Activity log/i }).first();
      if (await activity.count()) await activity.click();
      else if (await activityBtn.count()) await activityBtn.click();
      else {
        // Click text in menu
        await page.locator("text=Activity").first().click().catch(() => undefined);
      }
      await page.waitForTimeout(600);
      await shotWebp(page, "debug-bridge.webp");
    },
  );

  // 8) Alarm lock
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await page.getByRole("button", { name: /Simulate hard limit/i }).click();
    await page.waitForTimeout(900);
    await shotWebp(page, "alarm-lock.webp");
  });

  // 9) Safety strip + E-Stop chrome (Virtual CNC soft-resets Idle quickly after E-Stop)
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await clickPhase(page, "Prepare");
    await page.waitForTimeout(400);
    await shotWebp(page, "estop.webp");
  });

  // 10) M6 tool-change panel (Idle → M5 strip with Re-probe Z / Continue)
  await withFreshPage(browser, { calibrated: true }, async (page) => {
    await connectVirtual(page);
    await prepareThroughReady(page);
    await clickPhase(page, "Verify");
    await page.waitForTimeout(400);
    // Replace the prepared job with a short M6 sample via the hidden file input.
    const m6Nc = `G21
G90
G0 Z-1
G0 X1 Y1
M3 S10000
G1 X5 F800
M6
G1 X10 F800
M5
G0 Z-1
`;
    const tmp = path.join(OUT, "_capture-tool-change.nc");
    await writeFile(tmp, m6Nc, "utf8");
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(tmp);
      await page.waitForTimeout(600);
    }
    // Clear-path checklist + Start
    const checks = page.locator('.job__checklist input[type="checkbox"]');
    const n = await checks.count();
    for (let i = 0; i < n; i++) {
      const box = checks.nth(i);
      if (!(await box.isChecked())) {
        await box.check({ force: true }).catch(() => undefined);
      }
    }
    const start = page.getByRole("button", { name: /^Start/i }).first();
    if (await start.count() && (await start.isEnabled())) {
      await start.click();
      await page.waitForTimeout(1500);
      await clickPhase(page, "Run");
      await page.waitForSelector(".job__toolchange-panel", { timeout: 15000 });
      await page.waitForTimeout(800);
      await shotWebp(page, "tool-change.webp");
    } else {
      console.warn("skip tool-change.webp — Start not available");
    }
    const { unlink } = await import("node:fs/promises");
    await unlink(tmp).catch(() => undefined);
  });

  await browser.close();
  console.log("Done. Assets in", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
