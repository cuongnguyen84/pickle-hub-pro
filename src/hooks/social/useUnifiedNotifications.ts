// ============================================================================
// useUnifiedNotifications — Sprint 2 Phase 3B.2 follow-up (UX unify)
// ----------------------------------------------------------------------------
// Merges the legacy `notifications` table (livestream/forum events, pre-Sprint-1)
// and the new `social_notifications` table (Sprint 1 Option A — match events)
// behind a single React Query cache. Two realtime channels feed the same
// list. markAsRead() routes the UPDATE to the correct table per source.
//
// Both tables stay intact — this hook is purely a UI unifier.
// ============================================================================

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NotificationSource = "legacy" | "social";

/** Normalized shape — UI components consume this regardless of source. */
export interface UnifiedNotification {
  id: string;
  source: NotificationSource;
  type: string;
  title: string;
  body: string;
  link_url: string;
  is_read: boolean;
  created_at: string;
  /** Sprint 5 PR-C — denormalized actor + context fields the trigger
   *  writes into social_notifications.payload. NotificationItem uses
   *  this to rebuild the title in English when the viewer's language
   *  is EN (DB title is Vietnamese-canonical). Always null for legacy
   *  notifications (the legacy table has no payload column). */
  payload: Record<string, unknown> | null;
}

const LIST_LIMIT = 10;

interface LegacyRow {
  id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  entity_type: string | null;
  is_read: boolean;
  created_at: string;
}

interface SocialRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

function deriveLegacyLink(row: LegacyRow): string {
  // Existing legacy NotificationList navigates to /live/${related_id}.
  // Mirror that here; if related_id missing, fall back to /notifications.
  if (row.related_id) {
    return `/live/${row.related_id}`;
  }
  return "/notifications";
}

function normalizeLegacy(row: LegacyRow): UnifiedNotification {
  return {
    id: row.id,
    source: "legacy",
    type: row.type,
    title: row.title,
    body: row.message ?? "",
    link_url: deriveLegacyLink(row),
    is_read: row.is_read,
    created_at: row.created_at,
    payload: null,
  };
}

function normalizeSocial(row: SocialRow): UnifiedNotification {
  return {
    id: row.id,
    source: "social",
    type: row.type,
    title: row.title,
    body: row.body ?? "",
    link_url: row.link_url ?? "/",
    is_read: row.is_read,
    created_at: row.created_at,
    payload: row.payload,
  };
}

function mergeAndSort(
  legacy: UnifiedNotification[],
  social: UnifiedNotification[],
): UnifiedNotification[] {
  const merged = [...legacy, ...social];
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return merged.slice(0, LIST_LIMIT);
}

const KEY_LIST = (uid: string | undefined) => ["unified-notifications", uid];
const KEY_UNREAD = (uid: string | undefined) => ["unified-notifications-unread", uid];

export function useUnifiedNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  const list = useQuery<UnifiedNotification[]>({
    queryKey: KEY_LIST(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const [legacyRes, socialRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, type, title, message, related_id, entity_type, is_read, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(LIST_LIMIT),
        supabase
          .from("social_notifications")
          .select("id, type, title, body, link_url, payload, is_read, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(LIST_LIMIT),
      ]);
      const legacy = (legacyRes.data ?? []).map((r) => normalizeLegacy(r as LegacyRow));
      const social = (socialRes.data ?? []).map((r) => normalizeSocial(r as SocialRow));
      return mergeAndSort(legacy, social);
    },
  });

  // ─── Realtime: subscribe to BOTH tables ──────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const legacyChan = supabase
      .channel(`unified-legacy:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          // Cheap path: invalidate both caches; React Query refetches.
          qc.invalidateQueries({ queryKey: KEY_LIST(userId) });
          qc.invalidateQueries({ queryKey: KEY_UNREAD(userId) });
        },
      )
      .subscribe();
    const socialChan = supabase
      .channel(`unified-social:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_notifications", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: KEY_LIST(userId) });
          qc.invalidateQueries({ queryKey: KEY_UNREAD(userId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(legacyChan);
      supabase.removeChannel(socialChan);
    };
  }, [userId, qc]);

  return list;
}

export function useUnifiedUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;
  return useQuery<number>({
    queryKey: KEY_UNREAD(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return 0;
      const [legacyRes, socialRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false),
        supabase
          .from("social_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false),
      ]);
      return (legacyRes.count ?? 0) + (socialRes.count ?? 0);
    },
  });
}

interface MarkAsReadInput {
  id: string;
  source: NotificationSource;
}

export function useMarkUnifiedAsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async ({ id, source }: MarkAsReadInput) => {
      const table = source === "legacy" ? "notifications" : "social_notifications";
      const { error } = await supabase
        .from(table)
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LIST(userId) });
      qc.invalidateQueries({ queryKey: KEY_UNREAD(userId) });
    },
  });
}

export function useMarkAllUnifiedAsRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("not_authenticated");
      const [a, b] = await Promise.all([
        supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", userId)
          .eq("is_read", false),
        supabase
          .from("social_notifications")
          .update({ is_read: true })
          .eq("user_id", userId)
          .eq("is_read", false),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_LIST(userId) });
      qc.invalidateQueries({ queryKey: KEY_UNREAD(userId) });
    },
  });
}

/** Convenience: total list + count from one hook (for the bell). */
export function useUnifiedNotificationsBundle() {
  const list = useUnifiedNotifications();
  const count = useUnifiedUnreadCount();
  return useMemo(
    () => ({ items: list.data ?? [], isLoading: list.isLoading, unread: count.data ?? 0 }),
    [list.data, list.isLoading, count.data],
  );
}
