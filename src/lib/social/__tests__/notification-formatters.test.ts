import { describe, it, expect } from "vitest";
import {
  isSprint5Type,
  notificationTitleEn,
  resolveNotificationTitle,
  type NotificationLike,
} from "../notification-formatters";

const baseSocial = (
  type: string,
  payload: Record<string, unknown> | null = null,
  overrides: Partial<NotificationLike> = {},
): NotificationLike => ({
  type,
  title: "VN canonical title",
  body: null,
  link_url: "/notifications",
  payload,
  ...overrides,
});

describe("isSprint5Type", () => {
  it("matches the 5 trigger-emitted types", () => {
    expect(isSprint5Type("follow")).toBe(true);
    expect(isSprint5Type("match_kudo")).toBe(true);
    expect(isSprint5Type("match_comment")).toBe(true);
    expect(isSprint5Type("comment_reply")).toBe(true);
    expect(isSprint5Type("comment_mention")).toBe(true);
  });

  it("rejects legacy + Sprint 2 hand-emitted types", () => {
    expect(isSprint5Type("kudos_received")).toBe(false);
    expect(isSprint5Type("comment_received")).toBe(false);
    expect(isSprint5Type("match_verified")).toBe(false);
    expect(isSprint5Type("livestream_live")).toBe(false);
    expect(isSprint5Type("anything_else")).toBe(false);
  });
});

describe("notificationTitleEn", () => {
  it("falls through to title when type is not Sprint5", () => {
    const out = notificationTitleEn(baseSocial("kudos_received"));
    expect(out).toBe("VN canonical title");
  });

  it("follow uses display_name when present", () => {
    const out = notificationTitleEn(
      baseSocial("follow", {
        actor_display_name: "Alice Nguyen",
        actor_username: "alice",
      }),
    );
    expect(out).toBe("Alice Nguyen followed you");
  });

  it("follow falls back to @username when display_name absent", () => {
    const out = notificationTitleEn(
      baseSocial("follow", { actor_username: "alice" }),
    );
    expect(out).toBe("@alice followed you");
  });

  it("falls back to 'someone' when both are missing", () => {
    const out = notificationTitleEn(baseSocial("follow", {}));
    expect(out).toBe("someone followed you");
  });

  it("renders all 5 type variants", () => {
    const payload = { actor_display_name: "Bob" };
    expect(notificationTitleEn(baseSocial("follow", payload))).toBe(
      "Bob followed you",
    );
    expect(notificationTitleEn(baseSocial("match_kudo", payload))).toBe(
      "Bob liked your match",
    );
    expect(notificationTitleEn(baseSocial("match_comment", payload))).toBe(
      "Bob commented on your match",
    );
    expect(notificationTitleEn(baseSocial("comment_reply", payload))).toBe(
      "Bob replied to your comment",
    );
    expect(notificationTitleEn(baseSocial("comment_mention", payload))).toBe(
      "Bob mentioned you in a comment",
    );
  });

  it("handles null payload gracefully", () => {
    const out = notificationTitleEn(baseSocial("follow", null));
    expect(out).toBe("someone followed you");
  });
});

describe("resolveNotificationTitle", () => {
  it("returns DB title for VN viewer regardless of type", () => {
    const sprint5 = baseSocial("follow", { actor_display_name: "Alice" });
    expect(resolveNotificationTitle(sprint5, "vi")).toBe("VN canonical title");
    const legacy = baseSocial("livestream_live");
    expect(resolveNotificationTitle(legacy, "vi")).toBe("VN canonical title");
  });

  it("rebuilds in EN for Sprint5 types when language is en", () => {
    const out = resolveNotificationTitle(
      baseSocial("match_kudo", { actor_display_name: "Alice" }),
      "en",
    );
    expect(out).toBe("Alice liked your match");
  });

  it("returns DB title in EN for non-Sprint5 types (legacy fallthrough)", () => {
    // Legacy notifications haven't been bilingual-ed yet — keep title as-is
    // so we don't ship broken EN copy for unrelated notification types.
    const out = resolveNotificationTitle(
      baseSocial("livestream_live"),
      "en",
    );
    expect(out).toBe("VN canonical title");
  });
});
