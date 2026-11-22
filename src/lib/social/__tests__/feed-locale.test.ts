import { describe, expect, it } from "vitest";
import { feedFooterCopy, feedRouteLanguage } from "../feed-locale";

describe("feedRouteLanguage", () => {
  it("follows the URL, not a stored Vietnamese preference", () => {
    expect(feedRouteLanguage("/feed")).toBe("en");
    expect(feedRouteLanguage("/vi/feed")).toBe("vi");
  });
});

describe("feedFooterCopy", () => {
  it("describes the 5-minute refresh and the 14-day hide in both languages", () => {
    const en = feedFooterCopy("en");
    const vi = feedFooterCopy("vi");
    expect(en).toMatch(/5 minutes/);
    expect(en).toMatch(/14 days/);
    expect(en).toMatch(/older/i);
    expect(en).not.toMatch(/real-time|30 days/i);
    expect(vi).toMatch(/5 phút/);
    expect(vi).toMatch(/14 ngày/);
    expect(vi).toMatch(/cũ hơn/);
    expect(vi).not.toMatch(/thời gian thực|30 ngày/);
  });
});
