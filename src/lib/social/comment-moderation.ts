/**
 * Pure permission resolver for comment moderation actions. Mirrors the
 * 4-path check inside delete_match_comment RPC so the UI can show the
 * delete button (and the right tooltip) without an extra round-trip.
 *
 * The actual gate lives server-side in the RPC; this is a pure
 * presentation-layer helper. A user who edits the DOM to force the
 * button visible still gets rejected by the RPC.
 */

export type ModerationActor =
  | "owner"
  | "admin"
  | "moderator"
  | "participant";

export interface ModerationContext {
  /** Auth user id, or null when anonymous. */
  viewerId: string | null;
  /** Viewer holds the 'admin' role in user_roles. */
  isAdmin: boolean;
  /** Viewer holds the 'moderator' role in user_roles. */
  isModerator: boolean;
  /** Viewer is a row in match_participants for the match this comment belongs to. */
  isMatchParticipant: boolean;
}

/**
 * Resolve why (if at all) the viewer can delete `commentUserId`'s comment
 * on this match. Returns the actor role for the tooltip, or null when no
 * permission applies. Order matches the RPC: owner → admin → moderator →
 * participant.
 */
export function resolveDeletePermission(
  ctx: ModerationContext,
  commentUserId: string,
): ModerationActor | null {
  if (!ctx.viewerId) return null;
  if (ctx.viewerId === commentUserId) return "owner";
  if (ctx.isAdmin) return "admin";
  if (ctx.isModerator) return "moderator";
  if (ctx.isMatchParticipant) return "participant";
  return null;
}

/**
 * Bilingual tooltip explaining the moderation action. Owner gets a
 * neutral copy ("Delete"); the three moderation roles get explicit
 * "Delete as <role>" so the action's authority is visible.
 */
export function moderationTooltip(
  actor: ModerationActor,
  language: "vi" | "en",
): string {
  if (actor === "owner") {
    return language === "vi" ? "Xoá bình luận" : "Delete comment";
  }
  if (actor === "admin") {
    return language === "vi"
      ? "Xoá với quyền quản trị"
      : "Delete as admin";
  }
  if (actor === "moderator") {
    return language === "vi"
      ? "Xoá với quyền kiểm duyệt"
      : "Delete as moderator";
  }
  return language === "vi"
    ? "Xoá (người tham gia trận đấu)"
    : "Delete as match participant";
}
