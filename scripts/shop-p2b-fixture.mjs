// ============================================================================
// The P2b acceptance fixture, for a human.
// ----------------------------------------------------------------------------
//   node scripts/shop-p2b-fixture.mjs up     # seed, print the URLs and logins
//   node scripts/shop-p2b-fixture.mjs down   # remove it, and COUNT what is left
//
// The automated run seeds and tears down inside one process. A person cannot
// test that: they need the data to still be there when they open the browser.
// Same seed, same teardown, held open in between.
//
// The registry is written to disk because the two commands are two processes.
// It goes to the system temp directory, never into the repository: it holds
// user ids and a shop id from a local stack, and none of that belongs in git.
//
// The admin's TOTP secret is deliberately NOT persisted. It lives for one
// process and dies with it, so `up` prints a code that is valid for ~30
// seconds and the Product Owner enrols their own factor for a longer session —
// which is the flow a real moderator uses anyway.
// ============================================================================

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newRegistry, seedP2bAcceptance, teardownP2bAcceptance, PASSWORD } from "./qa/p2b-seed.mjs";

const STATE = join(tmpdir(), "tph-p2b7-fixture.json");
const APP = process.env.SHOP_QA_BASE_URL ?? "http://localhost:8080";
const command = process.argv[2] ?? "up";

if (command === "up") {
  if (existsSync(STATE)) {
    console.error(
      `A fixture is already up (${STATE}).\n` +
      `Run \`node scripts/shop-p2b-fixture.mjs down\` first — seeding twice leaves\n` +
      `the first one behind, and a stale shop breaks the pgTAP files that count\n` +
      `publishable products globally.`,
    );
    process.exit(1);
  }
  const reg = newRegistry();
  const run = Date.now().toString(36);
  try {
    const s = await seedP2bAcceptance(reg, run);
    writeFileSync(STATE, JSON.stringify(reg, null, 2));

    const line = (label, value) => console.log(`  ${label.padEnd(28)} ${value}`);
    console.log("\n════ Tài khoản ════  (mật khẩu chung: " + PASSWORD + ")");
    line("Người bán (chủ shop)", s.users.seller.email);
    line("Quản lý shop", s.users.manager.email);
    line("Nhân viên hỗ trợ", s.users.support.email);
    line("Shop khác (đối chứng)", s.users.rival.email);
    line("Người nộp hồ sơ", s.users.applicant.email);
    line("Người mua đã đăng nhập", s.users.buyer.email);
    line("Người ngoài chương trình", s.users.nonPilot.email);
    line("Admin CHƯA bật 2FA", s.users.adminAal1.email);
    line("Admin ĐÃ bật 2FA", s.users.adminAal2.email + "  ← quét QR ở /account khi đăng nhập");

    console.log("\n════ Đường dẫn người mua ════");
    line("Trang chợ", `${APP}/shop`);
    line("Tìm kiếm", `${APP}/shop/search?q=vot`);
    line("Ngành hàng", `${APP}/shop/category/vot`);
    line("PDP nhiều phiên bản", `${APP}/shop/product/${s.products.matrix.slug}`);
    line("PDP một phiên bản", `${APP}/shop/product/${s.products.single.slug}`);
    line("PDP hàng đã dùng", `${APP}/shop/product/${s.products.used.slug}`);
    line("PDP chưa rõ tồn kho", `${APP}/shop/product/${s.products.unknown.slug}`);
    line("Trang shop", `${APP}/shop/store/${s.shops.a.slug}`);
    line("Đường dẫn shop CŨ", `${APP}/shop/store/${s.shops.a.oldSlug}   → phải chuyển hướng`);
    line("Đường dẫn sản phẩm CŨ", `${APP}/shop/product/${s.renamedOldSlug}   → phải chuyển hướng`);
    line("Shop bị tạm ngưng", `${APP}/shop/store/${s.shops.suspended.slug}   → phải như chưa từng có`);
    line("Sản phẩm bị gỡ", `${APP}/shop/product/${s.products.suspended.slug}   → không tìm thấy`);
    line("Bản tiếng Việt", `${APP}/vi/shop`);

    console.log("\n════ Đường dẫn người bán ════");
    line("Giới thiệu bán hàng", `${APP}/shop/sell`);
    line("Tổng quan shop", `${APP}/seller`);
    line("Hồ sơ đăng ký", `${APP}/seller/application`);
    line("Trạng thái hồ sơ", `${APP}/seller/application/status`);
    line("Cài đặt shop", `${APP}/seller/settings`);
    line("Danh sách sản phẩm", `${APP}/seller/products`);
    line("Sửa sản phẩm cần sửa", `${APP}/seller/products/${s.products.needsChanges.id}/edit`);

    console.log("\n════ Đường dẫn quản trị (cần 2FA) ════");
    line("Hàng đợi hồ sơ", `${APP}/admin/shop/applications`);
    line("Xét hồ sơ", `${APP}/admin/shop/applications/${s.application.id}`);
    line("Hàng đợi sản phẩm", `${APP}/admin/shop/products`);
    line("Xét sản phẩm chờ duyệt", `${APP}/admin/shop/products/${s.products.pending.id}`);
    line("Kênh liên hệ", `${APP}/admin/shop/contacts`);

    console.log(`\nDữ liệu đã được ghi. Khi xong, chạy:  node scripts/shop-p2b-fixture.mjs down\n`);
  } catch (e) {
    // A seed that threw halfway still has rows behind it. Clean, then report.
    console.error(`\n✖ seed failed: ${e.message}\n`);
    console.error(`teardown after failure: ${JSON.stringify(await teardownP2bAcceptance(reg))}`);
    process.exit(1);
  }
} else if (command === "down") {
  if (!existsSync(STATE)) {
    console.error(`No fixture is up (${STATE} not found).`);
    process.exit(1);
  }
  const reg = JSON.parse(readFileSync(STATE, "utf8"));
  const remaining = await teardownP2bAcceptance(reg);
  const dirty = Object.entries(remaining)
    .filter(([k, n]) => k !== "errorDetail" && typeof n === "number" && n !== 0);
  console.log(`teardown: ${JSON.stringify(remaining)}`);
  if (dirty.length) {
    console.error(`\n✖ ${dirty.map(([k, n]) => `${n} ${k}`).join(", ")} left behind.`);
    console.error(`The state file is KEPT so this can be retried.`);
    process.exit(1);
  }
  unlinkSync(STATE);
  console.log("\nSạch — 0 hàng, 0 tệp, 0 tài khoản.\n");
} else {
  console.error(`usage: node scripts/shop-p2b-fixture.mjs [up|down]`);
  process.exit(1);
}
