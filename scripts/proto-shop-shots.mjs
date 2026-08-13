#!/usr/bin/env node
// ============================================================================
// Shop prototype — screenshot harness (board Rule 10)
// ----------------------------------------------------------------------------
//   npm run dev                    # terminal 1, port 8080
//   node scripts/proto-shop-shots.mjs
//
// Captures every screen × every scenario × every board-specified width, and
// fails loudly on any console error or unhandled rejection — so this doubles as
// a render smoke test across 320/375/414/768/1024/1440 px.
//
// The shot list is read from window.__PROTO_SHOTS__ (populated by
// ProtoShopApp from registry.tsx). Nothing is hardcoded here.
//
// Output goes to docs/proposals/shop-marketplace/screenshots/ which is
// gitignored — the live prototype is the review surface; these files exist for
// attaching to a review thread.
// ============================================================================

import { chromium } from "@playwright/test";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.PROTO_BASE_URL ?? "http://localhost:8080";
const OUT = resolve("docs/proposals/shop-marketplace/screenshots");
const ONLY = process.argv[2] ?? ""; // optional task-id filter, e.g. "B04"

const problems = [];

const run = async () => {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    // Skip the geo round-trip to /api/rum-context, which does not exist under
    // `vite dev` (no Pages Functions) and otherwise hangs the language bootstrap.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE,
          localStorage: [
            { name: "pickleball-hub-language", value: "vi" },
            { name: "tl-theme-mode", value: "dark" },
          ],
        },
      ],
    },
  });

  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${page.url()} — ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${page.url()} — ${e.message}`));

  await page.goto(`${BASE}/proto/shop`, { waitUntil: "networkidle" });
  const screens = await page.evaluate(() => window.__PROTO_SHOTS__ ?? []);
  if (!screens.length) {
    console.error("No screens found — is the dev server running on", BASE, "?");
    process.exit(1);
  }

  let n = 0;
  for (const screen of screens) {
    if (ONLY && screen.id !== ONLY) continue;
    for (const shot of screen.shots) {
      for (const width of shot.widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE}/proto/shop${shot.url}`, { waitUntil: "networkidle" });
        // Reduced motion off-screen animations settle; also gives lazy chunks time.
        await page.waitForTimeout(180);

        // The app scrolls an inner flex container, not <html> — so `fullPage`
        // captures one viewport and a documentElement overflow check reads 0.
        // Measure and grow the viewport against .tl-shop instead.
        const box = await page.evaluate(() => {
          const el = document.querySelector(".tl-shop-scroll");
          if (!el) return null;
          return {
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
            scrollH: el.scrollHeight,
          };
        });
        if (!box) {
          problems.push(`missing .tl-shop: ${screen.id} ${shot.label} @${width}px`);
          continue;
        }
        const overflow = box.scrollW - box.clientW;
        if (overflow > 1) {
          problems.push(
            `overflow: ${screen.id} ${shot.label} @${width}px — ${overflow}px wider than viewport`,
          );
        }

        await page.setViewportSize({ width, height: Math.min(Math.max(box.scrollH + 40, 900), 12000) });
        await page.waitForTimeout(120);

        const file = `${OUT}/${screen.batch}-${screen.id}-${shot.label}-${width}.png`;
        await page.screenshot({ path: file, fullPage: true });
        n += 1;
        process.stdout.write(`\r${n} ảnh…`);
      }
    }
  }
  process.stdout.write("\n");

  await browser.close();

  console.log(`\n${n} ảnh → ${OUT}`);
  if (problems.length) {
    console.error(`\n${problems.length} vấn đề:`);
    for (const p of problems) console.error("  •", p);
    process.exit(1);
  }
  console.log("Không có lỗi console và không có tràn ngang.");
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
