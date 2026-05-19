import { describe, it, expect } from "vitest";
import {
  resolveDeletePermission,
  moderationTooltip,
  type ModerationContext,
} from "../comment-moderation";

const baseCtx: ModerationContext = {
  viewerId: "viewer-uuid",
  isAdmin: false,
  isModerator: false,
  isMatchParticipant: false,
};

describe("resolveDeletePermission", () => {
  it("returns null when viewer is anonymous", () => {
    const out = resolveDeletePermission(
      { ...baseCtx, viewerId: null },
      "owner-uuid",
    );
    expect(out).toBeNull();
  });

  it("returns 'owner' when viewer authored the comment", () => {
    const out = resolveDeletePermission(baseCtx, "viewer-uuid");
    expect(out).toBe("owner");
  });

  it("returns 'admin' for admins on others' comments", () => {
    const out = resolveDeletePermission(
      { ...baseCtx, isAdmin: true },
      "other-uuid",
    );
    expect(out).toBe("admin");
  });

  it("returns 'moderator' for moderators on others' comments", () => {
    const out = resolveDeletePermission(
      { ...baseCtx, isModerator: true },
      "other-uuid",
    );
    expect(out).toBe("moderator");
  });

  it("returns 'participant' for match participants on others' comments", () => {
    const out = resolveDeletePermission(
      { ...baseCtx, isMatchParticipant: true },
      "other-uuid",
    );
    expect(out).toBe("participant");
  });

  it("returns null for an unrelated viewer (no role, not participant)", () => {
    const out = resolveDeletePermission(baseCtx, "other-uuid");
    expect(out).toBeNull();
  });

  it("owner takes precedence over admin/moderator/participant", () => {
    // A moderator deleting their own comment is logged as 'owner', not
    // 'moderator' — matches the RPC ordering so the badge color reads
    // self-delete instead of moderation action.
    const out = resolveDeletePermission(
      {
        viewerId: "viewer-uuid",
        isAdmin: true,
        isModerator: true,
        isMatchParticipant: true,
      },
      "viewer-uuid",
    );
    expect(out).toBe("owner");
  });

  it("admin precedence over moderator + participant", () => {
    const out = resolveDeletePermission(
      {
        viewerId: "viewer-uuid",
        isAdmin: true,
        isModerator: true,
        isMatchParticipant: true,
      },
      "other-uuid",
    );
    expect(out).toBe("admin");
  });

  it("moderator precedence over participant", () => {
    const out = resolveDeletePermission(
      {
        viewerId: "viewer-uuid",
        isAdmin: false,
        isModerator: true,
        isMatchParticipant: true,
      },
      "other-uuid",
    );
    expect(out).toBe("moderator");
  });
});

describe("moderationTooltip", () => {
  it("owner gets neutral copy in both languages", () => {
    expect(moderationTooltip("owner", "vi")).toBe("Xoá bình luận");
    expect(moderationTooltip("owner", "en")).toBe("Delete comment");
  });

  it("admin / moderator / participant explicit role-named copy", () => {
    expect(moderationTooltip("admin", "en")).toContain("admin");
    expect(moderationTooltip("admin", "vi")).toContain("quản trị");
    expect(moderationTooltip("moderator", "en")).toContain("moderator");
    expect(moderationTooltip("moderator", "vi")).toContain("kiểm duyệt");
    expect(moderationTooltip("participant", "en")).toContain("participant");
    expect(moderationTooltip("participant", "vi")).toContain("tham gia");
  });
});
