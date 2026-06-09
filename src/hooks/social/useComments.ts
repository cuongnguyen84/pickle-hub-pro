import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";

/**
 * Phase 4C comment hooks. Pair with social_comments (target_type='match').
 *
 * Read:
 *   useMatchComments(matchId)         infinite query, ASC chronological
 *
 * Write (all bilingual toasts on error, optimistic where it pays):
 *   useAddCommentMutation()           insert root or reply
 *   useEditCommentMutation()          edit own
 *   useDeleteCommentMutation()        soft delete own (replies preserved)
 *
 * Optimistic strategy:
 *   - Add: append placeholder row to last cached page; on success replace
 *     placeholder with server-assigned id. Rollback on error.
 *   - Edit: patch body inline. Rollback on error.
 *   - Delete: flip is_deleted to true and mask body locally. Rollback on
 *     error.
 *
 * After every successful write we invalidate ['feed', ...] because
 * trending order can shift with new comment_count and following row
 * counts need to truth up.
 */

export interface MatchComment {
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

export interface CommentCursor {
  created_at: string;
  comment_id: string;
}

const PAGE_SIZE = 50;

const normalizeRow = (row: RpcRow): MatchComment => ({
  comment_id: row.comment_id,
  parent_comment_id: row.parent_comment_id,
  depth: row.depth,
  body: row.body,
  user_id: row.user_id,
  username: row.username,
  display_name: row.display_name,
  avatar_url: row.avatar_url,
  created_at: row.created_at,
  updated_at: row.updated_at,
  is_deleted: row.is_deleted,
});

/* ─── Query ───────────────────────────────────────────────────────────── */
export function useMatchComments(matchId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ["match-comments", matchId ?? null] as const,
    initialPageParam: null as CommentCursor | null,
    enabled: !!matchId,
    staleTime: 30_000,
    queryFn: async ({ pageParam }) => {
      if (!matchId) return [] as MatchComment[];
      const { data, error } = await supabase.rpc("get_match_comments", {
        p_match_id: matchId,
        p_limit: PAGE_SIZE,
        p_cursor_created_at: pageParam?.created_at ?? null,
        p_cursor_comment_id: pageParam?.comment_id ?? null,
      });
      if (error) throw error;
      return (data ?? []).map(normalizeRow);
    },
    getNextPageParam: (lastPage): CommentCursor | undefined => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { created_at: last.created_at, comment_id: last.comment_id };
    },
  });
}

/* ─── Add ─────────────────────────────────────────────────────────────── */

interface AddArgs {
  matchId: string;
  body: string;
  parentCommentId?: string | null;
  /** Author profile fields used to populate the optimistic placeholder
   *  before the server returns the assigned id. Pulled from the current
   *  viewer's profile by the consumer (CommentInput / CommentEditForm). */
  authorProfile: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  /** Parent depth so we can compute placeholder depth without round-tripping
   *  the cache. Caller knows it (it's reading the parent row to render the
   *  reply form). 0 for root. */
  parentDepth?: number;
}

interface AddResponse {
  comment_id: string;
  depth: number;
}

interface InfinitePages {
  pages?: MatchComment[][];
  pageParams?: unknown[];
}

const optimisticPlaceholderId = (): string =>
  `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useAddCommentMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useI18n();

  return useMutation({
    mutationFn: async ({
      matchId,
      body,
      parentCommentId,
    }: AddArgs): Promise<AddResponse> => {
      if (!user) throw new Error("not_authenticated");
      const { data, error } = await supabase.rpc("add_match_comment", {
        p_match_id: matchId,
        p_body: body,
        p_parent_comment_id: parentCommentId ?? null,
      });
      if (error) throw error;
      const parsed = data as unknown as AddResponse | null;
      if (!parsed?.comment_id) throw new Error("Malformed RPC response");
      return parsed;
    },
    onMutate: async (vars) => {
      const key = ["match-comments", vars.matchId] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<InfinitePages>(key);
      const placeholderId = optimisticPlaceholderId();
      const placeholder: MatchComment = {
        comment_id: placeholderId,
        parent_comment_id: vars.parentCommentId ?? null,
        depth: vars.parentCommentId ? (vars.parentDepth ?? 0) + 1 : 0,
        body: vars.body.trim(),
        user_id: user?.id ?? "optimistic-self",
        username: vars.authorProfile.username,
        display_name: vars.authorProfile.display_name,
        avatar_url: vars.authorProfile.avatar_url,
        created_at: new Date().toISOString(),
        updated_at: null,
        is_deleted: false,
      };
      if (prev?.pages?.length) {
        const next: InfinitePages = {
          ...prev,
          pages: prev.pages.map((page, i, arr) =>
            i === arr.length - 1 ? [...page, placeholder] : page,
          ),
        };
        qc.setQueryData(key, next);
      } else {
        qc.setQueryData<InfinitePages>(key, {
          pages: [[placeholder]],
          pageParams: [null],
        });
      }
      return { prev, key, placeholderId };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      console.error("[useAddCommentMutation] failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi"
            ? "Không thể đăng bình luận"
            : "Could not post comment",
        description:
          err instanceof Error
            ? err.message
            : language === "vi"
              ? "Lỗi không xác định"
              : "Unexpected error",
      });
    },
    onSuccess: (data, vars, ctx) => {
      // Replace the placeholder id with the server id so subsequent
      // edits/deletes target the real row. Don't invalidate the comments
      // query — the optimistic row is already in place; refetching would
      // briefly remove it then re-add. Just patch the id.
      const key = ctx?.key ?? (["match-comments", vars.matchId] as const);
      const placeholderId = ctx?.placeholderId;
      if (placeholderId) {
        qc.setQueryData<InfinitePages>(key, (curr) => {
          if (!curr?.pages) return curr;
          return {
            ...curr,
            pages: curr.pages.map((page) =>
              page.map((row) =>
                row.comment_id === placeholderId
                  ? { ...row, comment_id: data.comment_id, depth: data.depth }
                  : row,
              ),
            ),
          };
        });
      }
      // Feed comment_count just changed → trending order may shift.
      qc.invalidateQueries({ queryKey: ["feed", "trending"] });
      qc.invalidateQueries({ queryKey: ["feed", "following"] });
    },
  });
}

/* ─── Edit ────────────────────────────────────────────────────────────── */

interface EditArgs {
  matchId: string;
  commentId: string;
  body: string;
}

export function useEditCommentMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useI18n();

  return useMutation({
    mutationFn: async ({ commentId, body }: EditArgs) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await supabase.rpc("edit_match_comment", {
        p_comment_id: commentId,
        p_body: body,
      });
      if (error) throw error;
    },
    onMutate: async ({ matchId, commentId, body }) => {
      const key = ["match-comments", matchId] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<InfinitePages>(key);
      if (prev?.pages) {
        const trimmed = body.trim();
        const now = new Date().toISOString();
        const next: InfinitePages = {
          ...prev,
          pages: prev.pages.map((page) =>
            page.map((row) =>
              row.comment_id === commentId
                ? { ...row, body: trimmed, updated_at: now }
                : row,
            ),
          ),
        };
        qc.setQueryData(key, next);
      }
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      console.error("[useEditCommentMutation] failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi"
            ? "Không thể sửa bình luận"
            : "Could not edit comment",
        description: err instanceof Error ? err.message : "",
      });
    },
  });
}

/* ─── Delete (soft) ───────────────────────────────────────────────────── */

interface DeleteArgs {
  matchId: string;
  commentId: string;
}

export function useDeleteCommentMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { language } = useI18n();

  return useMutation({
    mutationFn: async ({ commentId }: DeleteArgs) => {
      if (!user) throw new Error("not_authenticated");
      const { error } = await supabase.rpc("delete_match_comment", {
        p_comment_id: commentId,
      });
      if (error) throw error;
    },
    onMutate: async ({ matchId, commentId }) => {
      const key = ["match-comments", matchId] as const;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<InfinitePages>(key);
      if (prev?.pages) {
        const next: InfinitePages = {
          ...prev,
          pages: prev.pages.map((page) =>
            page.map((row) =>
              row.comment_id === commentId
                ? {
                    ...row,
                    body: "[deleted]",
                    display_name: null,
                    avatar_url: null,
                    is_deleted: true,
                  }
                : row,
            ),
          ),
        };
        qc.setQueryData(key, next);
      }
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      console.error("[useDeleteCommentMutation] failed", err);
      toast({
        variant: "destructive",
        title:
          language === "vi"
            ? "Không thể xoá bình luận"
            : "Could not delete comment",
        description: err instanceof Error ? err.message : "",
      });
    },
    onSuccess: (_data, { matchId }) => {
      // comment_count drops by one → trending may re-rank.
      qc.invalidateQueries({ queryKey: ["feed", "trending"] });
      qc.invalidateQueries({ queryKey: ["feed", "following"] });
      // Also refresh the per-match thread to truth-up display_name nulling
      // (RPC masks server-side too).
      qc.invalidateQueries({ queryKey: ["match-comments", matchId] });
    },
  });
}
