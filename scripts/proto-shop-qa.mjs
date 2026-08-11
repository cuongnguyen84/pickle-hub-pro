#!/usr/bin/env node
// ============================================================================
// Shop prototype — cross-screen quality gate (board tasks Q01–Q04)
// ----------------------------------------------------------------------------
//   npm run dev                    # terminal 1, port 8080
//   node scripts/proto-shop-qa.mjs [Q01|Q02|Q03|Q04|all]
//
// Q01 responsive matrix   — every screen at 320/375/414/768 (+1024/1440 for the
//                           screens whose shots ask for a desktop width):
//                           the page actually scrolls, no horizontal scroll, no
//                           touch target under 44×44, no overflow at 200% zoom.
// Q02 accessibility       — axe (WCAG 2.1 A/AA), heading order, focus visibility,
//                           accessible names, reduced-motion honoured.
// Q03 Vietnamese stress   — swap in long realistic Vietnamese strings and assert
//                           no primary button or nav link wraps to two lines.
// Q04 failure states      — every failure fixture URL must render its recovery
//                           affordance, not a blank screen.
//
// Exits non-zero on any finding, and prints them grouped by task id.
// ============================================================================

import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.PROTO_BASE_URL ?? "http://localhost:8080";
const ONLY = (process.argv[2] ?? "all").toUpperCase();
const run = (id) => ONLY === "ALL" || ONLY === id;

const MOBILE_WIDTHS = [320, 375, 414, 768];
const DESKTOP_WIDTHS = [1024, 1440];

const findings = [];
const note = (task, msg) => findings.push(`${task}  ${msg}`);

const storageState = {
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
};

/** Page-level horizontal scroll is measured on .tl-shop — the app scrolls an
 *  inner container, so documentElement always reads 0 and hides real bugs. */
const overflowOf = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".tl-shop-scroll");
    return el ? el.scrollWidth - el.clientWidth : 0;
  });

/**
 * The check that was missing. Every screenshot looked perfect while no page
 * could actually scroll, because the harness grew the viewport to the content
 * height before capturing — which hides the bug completely.
 *
 * html/body/#root are `overflow: hidden; height: 100%`, so a page that forgets
 * its own scroll container renders fine and then traps the user at the top.
 * Assert it by scrolling for real and reading the offset back.
 */
const scrollWorks = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".tl-shop-scroll");
    if (!el) return { ok: false, why: "không tìm thấy .tl-shop-scroll" };
    const room = el.scrollHeight - el.clientHeight;
    if (room <= 1) return { ok: true, why: "nội dung ngắn hơn màn hình" };
    // Ask for more room than exists on purpose; a working scroller clamps to
    // its maximum, a broken one stays at 0.
    el.scrollTop = room + 500;
    const moved = el.scrollTop;
    el.scrollTop = 0;
    return moved >= room - 1
      ? { ok: true, why: "" }
      : { ok: false, why: `còn ${room}px để cuộn nhưng scrollTop kẹt ở ${moved}` };
  });

/**
 * App chrome that must not appear over the prototype.
 *
 * ChatFAB sat on top of the primary button of every sticky commerce bar at
 * 375px ("Thêm vào giỏ", "Đặt đơn", "Gửi quyết định"). BottomNav is correct on
 * buyer screens — the shop lives under the app's 5-slot nav — but wrong on
 * Seller Center and Shop Admin, which carry their own bottom tabs; both
 * visible means two stacked bars.
 */
const chromeCheck = (page) =>
  page.evaluate(() => {
    const path = location.pathname;
    const fab = document.querySelector('a[href*="m.me/"], a[href*="zalo.me/"]');
    const nav = document.querySelector('nav[aria-label="Primary mobile navigation"]');
    const sellerOrAdmin = /\/proto\/shop\/(seller|admin)/.test(path);
    const out = [];
    if (fab) out.push("ChatFAB hiện trên trang Shop");
    if (sellerOrAdmin && nav) out.push("BottomNav hiện trên Kênh người bán / Quản trị");
    if (!sellerOrAdmin && !nav) out.push("BottomNav biến mất khỏi trang mua hàng");
    return out;
  });

const smallTargets = (page) =>
  page.evaluate(() => {
    const bad = [];
    const sel = "a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])";
    for (const el of document.querySelectorAll(`.tl-shop ${sel}`)) {
      // Skip the prototype chrome — it is not part of the product.
      if (el.closest(".tl-proto-banner")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // not rendered at this width
      // Inline links inside a paragraph are exempt: they are text, not targets.
      const inProse = el.tagName === "A" && el.closest("p, li, dd, td, caption");
      if (inProse) continue;
      // A checkbox/radio inside a <label> is not the target — the label is,
      // because clicking anywhere on it activates the control. Measure that.
      const lbl = el.closest("label");
      let box = lbl && (el.tagName === "INPUT" || el.tagName === "SELECT")
        ? lbl.getBoundingClientRect()
        : r;
      // A link with an absolutely-positioned ::after covering its card (the
      // "stretched link" pattern) has the CARD as its real hit area.
      if (el.tagName === "A" && getComputedStyle(el, "::after").position === "absolute") {
        const card = el.closest(".tl-shop-pcard, .tl-shop-card, li");
        if (card) box = card.getBoundingClientRect();
      }
      if (box.width < 44 || box.height < 44) {
        bad.push(
          `${el.tagName}.${String(el.className).split(" ")[0] || "-"} ${Math.round(box.width)}×${Math.round(box.height)} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28)}"`,
        );
      }
    }
    return [...new Set(bad)].slice(0, 6);
  });

const headingOrder = (page) =>
  page.evaluate(() => {
    const hs = [...document.querySelectorAll(".tl-shop h1, .tl-shop h2, .tl-shop h3, .tl-shop h4")];
    const levels = hs.map((h) => Number(h.tagName[1]));
    const h1s = levels.filter((l) => l === 1).length;
    const jumps = [];
    for (let i = 1; i < levels.length; i += 1) {
      if (levels[i] - levels[i - 1] > 1) {
        jumps.push(`${hs[i - 1].tagName}→${hs[i].tagName} tại "${hs[i].textContent.trim().slice(0, 30)}"`);
      }
    }
    return { h1s, jumps };
  });

const LONG_VI = {
  productTitle:
    "Vợt pickleball sợi carbon T700 nguyên khối độ dày mười sáu milimét dòng kiểm soát dành cho người chơi trình độ từ ba phẩy năm trở lên, kèm bao đựng chống sốc",
  shopName: "Cửa hàng Dụng cụ Thể thao Pickleball Sài Gòn — Chi nhánh Quận Bảy",
  address:
    "Số 128/45B đường Nguyễn Thị Thập, Khu phố 3, Phường Bình Thuận, Quận 7, Thành phố Hồ Chí Minh",
};

const main = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  page.on("pageerror", (e) => note("ALL ", `lỗi JS: ${page.url()} — ${e.message}`));

  await page.goto(`${BASE}/proto/shop`, { waitUntil: "networkidle" });
  const screens = await page.evaluate(() => window.__PROTO_SHOTS__ ?? []);
  if (!screens.length) {
    console.error("Không thấy màn hình nào — dev server có đang chạy ở", BASE, "không?");
    process.exit(1);
  }

  // ── Q01 responsive matrix ────────────────────────────────────────────────
  if (run("Q01")) {
    for (const sc of screens) {
      const url = sc.shots[0].url;
      const wantsDesktop = sc.shots.some((s) => s.widths.some((w) => w >= 1024));
      const widths = wantsDesktop ? [...MOBILE_WIDTHS, ...DESKTOP_WIDTHS] : MOBILE_WIDTHS;
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${BASE}/proto/shop${url}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(120);

        const ov = await overflowOf(page);
        if (ov > 1) note("Q01", `${sc.id} @${width}px tràn ngang ${ov}px`);

        const small = await smallTargets(page);
        for (const s of small) note("Q01", `${sc.id} @${width}px vùng bấm < 44px: ${s}`);

        const scroll = await scrollWorks(page);
        if (!scroll.ok) note("Q01", `${sc.id} @${width}px KHÔNG CUỘN ĐƯỢC — ${scroll.why}`);

        if (width <= 768) {
          for (const c of await chromeCheck(page)) note("Q01", `${sc.id} @${width}px ${c}`);
        }
      }

      // 200% zoom == half the CSS viewport width. 375/2 ≈ 188 is below any
      // sane floor, so the board's intent is checked at 768 → 384.
      await page.setViewportSize({ width: 384, height: 900 });
      await page.goto(`${BASE}/proto/shop${url}`, { waitUntil: "networkidle" });
      const zoomOv = await overflowOf(page);
      if (zoomOv > 1) note("Q01", `${sc.id} @200% zoom (384px) tràn ngang ${zoomOv}px`);
    }
  }

  // ── Q02 accessibility ────────────────────────────────────────────────────
  if (run("Q02")) {
    for (const sc of screens) {
      const url = sc.shots[0].url;
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto(`${BASE}/proto/shop${url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);

      const res = await new AxeBuilder({ page })
        .include(".tl-shop")
        .exclude(".tl-proto-banner")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      for (const v of res.violations) {
        note("Q02", `${sc.id} axe ${v.id} (${v.impact}) ×${v.nodes.length}: ${v.help}`);
      }

      const { h1s, jumps } = await headingOrder(page);
      if (h1s !== 1) note("Q02", `${sc.id} có ${h1s} thẻ <h1> (phải đúng 1)`);
      for (const j of jumps) note("Q02", `${sc.id} nhảy cấp tiêu đề: ${j}`);

      // Focus must be visible: tab to the first control and assert an outline.
      const focusOk = await page.evaluate(() => {
        const el = document.querySelector(
          ".tl-shop main a[href], .tl-shop main button, .tl-shop main input",
        );
        if (!el) return true;
        el.focus();
        const cs = getComputedStyle(el);
        return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
      });
      if (!focusOk) note("Q02", `${sc.id} tiêu điểm bàn phím không có viền nhìn thấy`);
    }

    // Reduced motion must actually stop the skeleton shimmer.
    const rm = await context.newPage();
    await rm.emulateMedia({ reducedMotion: "reduce" });
    await rm.setViewportSize({ width: 375, height: 900 });
    await rm.goto(`${BASE}/proto/shop/home?scenario=slow`, { waitUntil: "networkidle" });
    const animated = await rm.evaluate(() => {
      const el = document.querySelector(".tl-shop-sk");
      if (!el) return false;
      const d = getComputedStyle(el).animationName;
      return d !== "none";
    });
    if (animated) note("Q02", "reduced-motion không tắt hiệu ứng khung xương");
    await rm.close();
  }

  // ── Q03 Vietnamese stress test ──────────────────────────────────────────
  if (run("Q03")) {
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of ["/home", "/product/vot-carbon-16mm-control", "/cart", "/checkout/shop-1", "/seller/products", "/orders"]) {
        await page.goto(`${BASE}/proto/shop${url}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(120);

        // Swap every product title / shop name for the long realistic version.
        await page.evaluate((L) => {
          const swap = (sel, text) => {
            for (const el of document.querySelectorAll(sel)) el.textContent = text;
          };
          swap(".tl-shop-pcard-title a, .tl-shop-line-title", L.productTitle);
          swap(".tl-shop-seller-name", L.shopName);
        }, LONG_VI);
        await page.waitForTimeout(80);

        const ov = await overflowOf(page);
        if (ov > 1) note("Q03", `${url} @${width}px tràn ngang ${ov}px với chuỗi tiếng Việt dài`);

        // Primary buttons and nav links must stay on one line.
        const wrapped = await page.evaluate(() => {
          // Count actual line boxes. Measuring height fails: min-height:44px
          // makes every single-line button look like two lines.
          const lineCount = (el) => {
            // Text nodes only — an inline <svg> icon sits at its own offset and
            // would otherwise read as a second line.
            const tops = new Set();
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = walk.nextNode(); n; n = walk.nextNode()) {
              if (!n.textContent.trim()) continue;
              const r = document.createRange();
              r.selectNodeContents(n);
              for (const c of r.getClientRects()) {
                if (c.height > 0 && c.width > 0) tops.add(Math.round(c.top));
              }
            }
            return tops.size;
          };
          return [...document.querySelectorAll(".tl-shop .tl-shop-btn--primary, .tl-shop .tl-shop-cat")]
            .filter((el) => lineCount(el) > 1)
            .map((el) => el.textContent.trim().slice(0, 34))
            .slice(0, 5);
        });
        for (const w of wrapped) note("Q03", `${url} @${width}px nút/liên kết xuống 2 dòng: "${w}"`);
      }
    }
  }

  // ── Q04 failure-state review ────────────────────────────────────────────
  if (run("Q04")) {
    const FAILURES = [
      ["/home?scenario=error", "lỗi tải trang chủ"],
      ["/home?scenario=unavailable", "mất mạng"],
      ["/search?scenario=error", "lỗi tìm kiếm"],
      ["/cart?scenario=unavailable", "hết hàng + đổi giá trong giỏ"],
      ["/checkout/shop-1?variant=payment-failed", "tạo đơn thất bại"],
      ["/checkout/shop-1?variant=stock-changed", "dữ liệu cũ khi đang điền"],
      ["/checkout/shop-1?variant=submitting", "chống bấm hai lần"],
      ["/seller/application?step=1&variant=failed", "lưu nháp thất bại"],
      ["/seller/products/new?variant=media-error", "tải ảnh thất bại"],
      ["/seller/products/p-2/edit?variant=conflict", "xung đột phiên bản"],
      ["/seller/settings?variant=no-permission", "mất quyền"],
      ["/seller/orders?scenario=error", "lỗi tải đơn"],
      ["/admin?scenario=error", "lỗi từng phần"],
      ["/admin/applications/app-2?variant=error", "gửi quyết định thất bại"],
      ["/return?variant=upload-error", "tải bằng chứng thất bại"],
    ];
    await page.setViewportSize({ width: 375, height: 900 });
    for (const [url, label] of FAILURES) {
      await page.goto(`${BASE}/proto/shop${url}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      const ok = await page.evaluate(() => {
        const txt = document.querySelector(".tl-shop main")?.innerText ?? "";
        // A usable failure state names a way forward.
        return /thử lại|làm tiếp|bỏ|chọn|liên hệ|quay lại|xem|chụp lại|sửa|đổi|nộp|gửi|đăng nhập|về /i.test(txt);
      });
      if (!ok) note("Q04", `${url} (${label}) không có lối thoát nào cho người dùng`);

      const ov = await overflowOf(page);
      if (ov > 1) note("Q04", `${url} (${label}) tràn ngang ${ov}px`);
    }
  }

  await browser.close();

  const byTask = new Map();
  for (const f of findings) {
    const t = f.slice(0, 4).trim();
    byTask.set(t, [...(byTask.get(t) ?? []), f.slice(5)]);
  }

  if (findings.length === 0) {
    console.log(`\n✅ ${ONLY} — không có phát hiện nào trên ${screens.length} màn hình.`);
    process.exit(0);
  }

  console.log(`\n${findings.length} phát hiện:\n`);
  for (const [task, list] of [...byTask].sort()) {
    console.log(`── ${task} (${list.length})`);
    for (const l of list) console.log(`   • ${l}`);
    console.log("");
  }
  process.exit(1);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
