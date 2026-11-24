import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { MatchComment } from "@/hooks/social/useComments";
import type { ModerationContext } from "@/lib/social/comment-moderation";
import type { EngagementTargetType } from "@/lib/social/engagement";

/**
 * Generic-target comment hooks (2026-11-24): the same social_comments
 * module the match comments use, driven by the generic RPCs
 * (get/add/delete_target_comment; edit reuses edit_match_comment,
 * which is already keyed by comment id alone). Cache key namespace is
 * ["target-comments", type, id], separate from ["match-comments", id]
 * so the live match surface is untouched.
 */

export type TargetComment = MatchComment;

interface RpcRow {
  comment_id: string;
  parent_comment_id: string | null;
  depth: number;
  body: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean;
}

interface CommentCursor {
  created_at: string;
  comment_id: string;
}

const PAGE_SIZE = 50;

const commentsKey = (type: EngagementTargetType, id: string | undefined) =>
  ["target-comments", type, id ?? null] as const;

export function useTargetComments(
  targetType: EngagementTargetType,
  targetId: string | undefined,
) {
  return useInfiniteQuery({
    queryKey: commentsKey(targetType, targetId),
    initialPageParam: null as CommentCursor | null,
    enabled: !!targetId,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      if (!targetId) return [] as TargetComment[];
      const { data, error } = await supabase.rpc(
        "get_target_comments" as never,
        {
          p_target_type: targetType,
          p_target_id: targetId,
          p_limit: PAGE_SIZE,
          p_cursor_created_at: pageParam?.created_at ?? undefined,
          p_cursor_comment_id: pageParam?.comment_id ?? undefined,
        } as never,
      );
      if (error) throw error;
      return ((data ?? []) as unknown as RpcRow[]).map((r) => ({
        comment_id: r.comment_id,
        parent_comment_id: r.parent_comment_id,
        depth: r.depth,
        body: r.body,
        user_id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
        created_at: r.created_at,
        updated_at: r.updated_at,
        is_deleted: r.is_deleted,
      })) as TargetComment[];
    },
    getNextPageParam: (lastPage): CommentCursor | undefined => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { created_at: last.created_at, comment_id: last.comment_id };
    },
  });
}

function useInvalidateTarget(
  targetType: EngagementTargetType,
  targetId: string,
) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: commentsKey(targetType, targetId) });
    qc.invalidateQueries({
      queryKey: ["engagement-counts", targetType, targetId],
    });
  };
}

export function useAddTargetCommentMutation(
  targetType: EngagementTargetType,
  targetId: string,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useI18n();
  const invalidate = useInvalidateTarget(targetType, targetId);

  return useMutation({
    mutationFn: async (args: {
      body: string;
      parentCommentId?: string | null;
    }) => {
      if (!user) throw new Error("not_authenticated");
      const { data, error } = await supabase.rpc(
        "add_target_comment" as never,
        {
          p_target_type: targetType,
          p_target_id: targetId,
          p_body: args.body,
          p_parent_comment_id: args.parentCommentId ?? undefined,
        } as never,
      );
      if (error) throw error;
      return data as unknown as { comment_id: string; depth: number };
    },
    onSuccess: () => invalidate(),
    onError: (err) => {
      console.error("[useAddTargetCommentMutation] failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi" ? "Không thể gửi bình luận" : "Could not post comment",
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}

export function useEditTargetCommentMutation(
  targetType: EngagementTargetType,
  targetId: string,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useI18n();
  const invalidate = useInvalidateTarget(targetType, targetId);

  return useMutation({
    mutationFn: async (args: { commentId: string; body: string }) => {
      if (!user) throw new Error("not_authenticated");
      // edit_match_comment is keyed by comment id alone - it already
      // serves every target type (owner-only check inside).
      const { data, error } = await supabase.rpc("edit_match_comment", {
        p_comment_id: args.commentId,
        p_body: args.body,
      });
      if (error) throw error;
      return data as unknown as { updated: boolean };
    },
    onSuccess: () => invalidate(),
    onError: (err) => {
      console.error("[useEditTargetCommentMutation] failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi" ? "Không thể sửa bình luận" : "Could not edit comment",
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}

export function useDeleteTargetCommentMutation(
  targetType: EngagementTargetType,
  targetId: string,
) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useI18n();
  const invalidate = useInvalidateTarget(targetType, targetId);

  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error("not_authenticated");
      const { data, error } = await supabase.rpc(
        "delete_target_comment" as never,
        { p_comment_id: commentId } as never,
      );
      if (error) throw error;
      return data as unknown as { deleted: boolean; acted_as: string };
    },
    onSuccess: () => invalidate(),
    onError: (err) => {
      console.error("[useDeleteTargetCommentMutation] failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi" ? "Không thể xóa bình luận" : "Could not delete comment",
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}

/**
 * Moderation context for non-match targets: owner/admin/moderator
 * paths only (the participant path exists solely for matches and the
 * server RPC re-checks it when the target is a match).
 */
export function useTargetModerationContext(): ModerationContext {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  const { data } = useQuery({
    queryKey: ["target-moderation", viewerId] as const,
    enabled: !!viewerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!viewerId) {
        return { isAdmin: false, isModerator: false };
      }
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", viewerId)
        .in("role", ["admin", "moderator"]);
      if (error) throw error;
      const set = new Set((roles ?? []).map((r) => r.role as string));
      return { isAdmin: set.has("admin"), isModerator: set.has("moderator") };
    },
  });

  return {
    viewerId,
    isAdmin: data?.isAdmin ?? false,
    isModerator: data?.isModerator ?? false,
    isMatchParticipant: false,
  };
}
