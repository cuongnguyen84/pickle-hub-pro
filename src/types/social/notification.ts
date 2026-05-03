/**
 * Notification domain types for Bet #1 social layer.
 *
 * NOTE (Sprint 1, 2026-05-03): the existing public.notifications table
 * uses ENUM `notification_type` constrained to ('livestream_scheduled',
 * 'livestream_live') and column names `message`/`entity_type`/`entity_id`.
 * The spec wants free-text type + body + link_url + payload JSONB.
 *
 * Migration of that table is BLOCKED on user decision (Option A/B/C in the
 * Sprint 1 PR description). Until then, these types describe the FUTURE
 * shape; consumers should not import from a "live" notifications hook for
 * social events yet — Sprint 4 will land the resolved table.
 */

export type SocialNotificationType =
  | "match_needs_confirm"
  | "match_verified"
  | "kudos_received"
  | "comment_received"
  | "follower_added"
  | "open_play_locked"
  | "pro_live"
  | "weekly_recap";

export interface SocialNotification<TPayload = Record<string, unknown>> {
  id: string;
  user_id: string;
  type: SocialNotificationType;
  title: string;
  body: string | null;
  link_url: string | null;
  payload: TPayload | null;
  is_read: boolean;
  created_at: string;
}
