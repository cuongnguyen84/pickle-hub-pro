/**
 * Bilingual rendering helpers for the 5 Sprint 5 PR-C notification types.
 *
 * The DB triggers write Vietnamese-canonical title strings (so VN viewers
 * see correct text immediately, even before this layer kicks in). This
 * helper rebuilds the title in English when language='en', based on the
 * structured payload the trigger denormalized.
 *
 * Pure — keeps it unit-testable without standing up React.
 */

export type Sprint5NotificationType =
  | "follow"
  | "match_kudo"
  | "match_comment"
  | "comment_reply"
  | "comment_mention";

export interface NotificationActor {
  actor_username?: string | null;
  actor_display_name?: string | null;
  actor_avatar_url?: string | null;
}

export interface NotificationLikePayload extends NotificationActor {
  match_slug?: string | null;
  comment_excerpt?: string | null;
  comment_id?: string | null;
}

export interface NotificationLike {
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  payload: NotificationLikePayload | Record<string, unknown> | null;
}

const SPRINT5_TYPES = new Set<string>([
  "follow",
  "match_kudo",
  "match_comment",
  "comment_reply",
  "comment_mention",
]);

export function isSprint5Type(type: string): type is Sprint5NotificationType {
  return SPRINT5_TYPES.has(type);
}

/** Best-effort actor display string. Falls back through display_name →
 *  @username → "someone" matching the trigger's COALESCE chain. */
function actorLabel(payload: NotificationLikePayload): string {
  if (payload.actor_display_name) return payload.actor_display_name;
  if (payload.actor_username) return `@${payload.actor_username}`;
  return "someone";
}

/**
 * English title for a Sprint 5 notification, rebuilt from payload. Mirrors
 * the Vietnamese phrasing the trigger writes so the meaning carries across.
 */
export function notificationTitleEn(
  notification: NotificationLike,
): string {
  if (!isSprint5Type(notification.type)) return notification.title;
  const payload = (notification.payload ?? {}) as NotificationLikePayload;
  const actor = actorLabel(payload);
  switch (notification.type) {
    case "follow":
      return `${actor} followed you`;
    case "match_kudo":
      return `${actor} liked your match`;
    case "match_comment":
      return `${actor} commented on your match`;
    case "comment_reply":
      return `${actor} replied to your comment`;
    case "comment_mention":
      return `${actor} mentioned you in a comment`;
  }
}

// PR7 — match-flow notification types. The edge function writes the
// Vietnamese title into `.title` (matches the trigger convention) and
// stows the English string in `payload.title_en` so this layer can
// swap it in for `language === 'en'` viewers.
const MATCH_FLOW_TYPES = new Set<string>([
  "match_confirm_needed",
  "match_approval_needed",
  "match_submitted",
]);

/** Resolve the title to render given the viewer's language preference. */
export function resolveNotificationTitle(
  notification: NotificationLike,
  language: "vi" | "en",
): string {
  if (language === "en" && isSprint5Type(notification.type)) {
    return notificationTitleEn(notification);
  }
  if (language === "en" && MATCH_FLOW_TYPES.has(notification.type)) {
    const titleEn = (notification.payload as { title_en?: string } | null)?.title_en;
    if (typeof titleEn === "string" && titleEn.length > 0) return titleEn;
  }
  return notification.title;
}
