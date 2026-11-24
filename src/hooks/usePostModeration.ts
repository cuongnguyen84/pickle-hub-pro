import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin moderation for community photo posts (UGC PR-B).
 *
 * Reads run under the admin's own session: the social_posts RLS
 * policies give admins SELECT on every row and UPDATE on every row,
 * and the status-guard trigger lets admins (and only admins / the
 * service role) change a post's status - so approve / reject / hide
 * are plain client updates here, no edge function and no RLS change.
 * social_posts is not in the generated types yet, hence the casts
 * (same pattern as useSocialPosts).
 */

export type SocialPostStatus = "pending" | "approved" | "rejected" | "hidden";

export interface ModerationPost {
  id: string;
  author_id: string;
  author_name: string;
  body: string | null;
  image_url: string;
  topic: string | null;
  status: SocialPostStatus;
  created_at: string;
  /** Open (pending) content_reports against this post. */
  report_count: number;
}

interface SocialPostRow {
  id: string;
  author_id: string;
  body: string | null;
  image_url: string;
  topic: string | null;
  status: SocialPostStatus;
  created_at: string;
}

const POST_COLUMNS = "id, author_id, body, image_url, topic, status, created_at";

async function withAuthorNames(rows: SocialPostRow[]): Promise<ModerationPost[]> {
  if (rows.length === 0) return [];
  const authorIds = [...new Set(rows.map((r) => r.author_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", authorIds);
  const names = new Map<string, string>();
  for (const p of (profiles ?? []) as {
    id: string;
    display_name: string | null;
    username: string | null;
  }[]) {
    names.set(p.id, p.display_name || p.username || "ThePickleHub");
  }

  const { data: reports } = await supabase
    .from("content_reports" as never)
    .select("content_id")
    .eq("content_type", "post")
    .eq("status", "pending")
    .in("content_id", rows.map((r) => r.id));
  const reportCounts = new Map<string, number>();
  for (const r of (reports ?? []) as unknown as { content_id: string }[]) {
    reportCounts.set(r.content_id, (reportCounts.get(r.content_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    author_name: names.get(row.author_id) ?? "ThePickleHub",
    report_count: reportCounts.get(row.id) ?? 0,
  }));
}

export function useModerationPosts(group: "pending" | "history") {
  return useQuery({
    queryKey: ["admin", "moderation", "posts", group],
    queryFn: async () => {
      let query = supabase
        .from("social_posts" as never)
        .select(POST_COLUMNS)
        .eq("kind", "post")
        .order("created_at", { ascending: false });
      query = group === "pending"
        ? query.eq("status", "pending")
        : query.in("status", ["approved", "rejected", "hidden"]).limit(50);
      const { data, error } = await query;
      if (error) throw error;
      return withAuthorNames((data ?? []) as unknown as SocialPostRow[]);
    },
  });
}

export interface PostReport {
  id: string;
  reason: string;
  created_at: string;
  post: ModerationPost | null;
}

export function useReportedPosts() {
  return useQuery({
    queryKey: ["admin", "moderation", "reported-posts"],
    queryFn: async () => {
      const { data: reports, error } = await supabase
        .from("content_reports" as never)
        .select("id, content_id, reason, created_at")
        .eq("content_type", "post")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const reportRows = (reports ?? []) as unknown as {
        id: string;
        content_id: string;
        reason: string;
        created_at: string;
      }[];
      if (reportRows.length === 0) return [] as PostReport[];
      const { data: posts, error: postsError } = await supabase
        .from("social_posts" as never)
        .select(POST_COLUMNS)
        .in("id", [...new Set(reportRows.map((r) => r.content_id))]);
      if (postsError) throw postsError;
      const byId = new Map(
        (await withAuthorNames((posts ?? []) as unknown as SocialPostRow[])).map(
          (p) => [p.id, p],
        ),
      );
      return reportRows.map((r) => ({
        id: r.id,
        reason: r.reason,
        created_at: r.created_at,
        post: byId.get(r.content_id) ?? null,
      })) as PostReport[];
    },
  });
}

function invalidatePostQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["admin", "moderation", "posts"] });
  queryClient.invalidateQueries({
    queryKey: ["admin", "moderation", "reported-posts"],
  });
  // An approved post should surface in the admin's feed straight away.
  queryClient.invalidateQueries({ queryKey: ["feed", "social-posts"] });
}

export function useUpdatePostStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: SocialPostStatus;
    }) => {
      const { error } = await supabase
        .from("social_posts" as never)
        .update({ status } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidatePostQueries(queryClient),
  });
}

export function useResolvePostReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase
        .from("content_reports" as never)
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        } as never)
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => invalidatePostQueries(queryClient),
  });
}
