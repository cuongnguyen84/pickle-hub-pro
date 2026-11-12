// Trợ lý AI chung: route → loại trang, danh sách ẩn, và xếp chồng với ChatFAB.
import { describe, expect, it } from "vitest";
import { assistantScreenFor, sitePageFor } from "@/lib/assistant-context";
import { chatFabVisible } from "@/components/layout/ChatFAB";
import { isPageType } from "../../../supabase/functions/site-assistant/shared";

describe("sitePageFor", () => {
  it.each([
    ["/", "home"], ["/vi", "home"], ["/feed", "home"], ["/vi/feed/", "home"],
    ["/tools", "tools"], ["/tools/team-match/abc", "tools"], ["/tools/doubles-elimination/new", "tools"],
    ["/live", "live_video"], ["/videos", "live_video"], ["/watch/123", "live_video"], ["/vi/watch/1", "live_video"],
    ["/blog", "blog_news"], ["/blog/some-post", "blog_news"], ["/vi/blog/bai-viet", "blog_news"], ["/news/x", "blog_news"],
    ["/san", "venues"], ["/san/abc", "venues"], ["/vi/san/khu-vuc/ha-noi", "venues"],
    ["/rankings", "players"], ["/rankings/ppa-tour", "players"], ["/dupr", "players"], ["/nguoi-choi/abc", "players"], ["/tim-ban-choi", "players"],
    ["/shop", "shop"], ["/shop/category/vot", "shop"], ["/vi/shop/store/abc", "shop"],
    ["/clubs", "community"], ["/clb/x", "community"], ["/forum/post/1", "community"], ["/social/abc", "community"], ["/su-kien/abc", "community"],
    ["/account", "account"], ["/notifications", "account"],
    ["/about", "general"], ["/search", "general"], ["/privacy", "general"], ["/some/unknown", "general"],
  ])("%s → %s", (path, page) => {
    expect(sitePageFor(path)).toBe(page);
    expect(isPageType(page)).toBe(true);
  });

  it.each([
    "/tools/quick-tables/chat", "/vi/tools/quick-tables/chat", "/tools/quick-tables/referee/m1",
    "/tools/team-match/match/m1/score", "/tools/doubles-elimination/match/m1/score", "/matches/m1/score",
    "/live/abc", "/vi/live/abc", "/live/pro/ppa-x", "/su-kien/x/live", "/social/x/live",
    "/embed/live/1", "/embed/video/1", "/share/video/1", "/admin", "/admin/news", "/creator/videos",
    "/seller/orders", "/proto/shop/x", "/auth/callback", "/auth/reset-password", "/login", "/vi/login", "/onboarding",
    "/dang-ky/tok", "/tin-nhan", "/shop/product/x", "/shop/cart", "/shop/checkout/s", "/shop/order/c", "/vi/shop/cart",
  ])("hides on %s", (path) => {
    expect(sitePageFor(path)).toBeNull();
  });

  it("tournament routes keep the tournament assistant", () => {
    for (const p of ["/tournaments", "/tournament/x", "/tools/quick-tables", "/tools/quick-tables/abc", "/vi/tools/quick-tables/abc/setup"]) {
      expect(assistantScreenFor(p)).not.toBeNull();
    }
  });
});

describe("chatFabVisible", () => {
  it("is hidden where the tournament assistant owns the corner", () => {
    expect(chatFabVisible("/tournament/x")).toBe(false);
    expect(chatFabVisible("/vi/tools/quick-tables/abc")).toBe(false);
  });
  it("is visible on normal pages (assistant stacks above it)", () => {
    expect(chatFabVisible("/")).toBe(true);
    expect(chatFabVisible("/vi/san/abc")).toBe(true);
  });
  it("stays hidden on its own hidden list", () => {
    expect(chatFabVisible("/rankings")).toBe(false);
    expect(chatFabVisible("/vi/shop")).toBe(false);
  });
});
