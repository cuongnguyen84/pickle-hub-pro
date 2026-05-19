import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import {
  useMatchComments,
  useAddCommentMutation,
  type MatchComment,
} from "@/hooks/social/useComments";
import {
  buildCommentTree,
  type ThreadedComment,
} from "@/lib/social/comment-helpers";
import { useMatchModerationContext } from "@/hooks/social/useMatchModerationContext";
import type { ModerationContext } from "@/lib/social/comment-moderation";
import { CommentRow } from "./CommentRow";
import { CommentInput } from "./CommentInput";
import { useViewerProfile } from "./viewer-profile";

interface CommentThreadProps {
  matchId: string;
}

/**
 * Full comment surface for MatchPage. Owns:
 *   - infinite query → flat list → tree
 *   - root-level composer (always visible for signed-in viewers)
 *   - which row's reply form is currently open (only one across the tree)
 *   - "Load more" pagination button when the RPC returned a full page
 *
 * Anchor id="comments" is set on the wrapper so /tran-dau/<slug>#comments
 * deep-links from FeedMatchCard scroll here.
 */
export function CommentThread({ matchId }: CommentThreadProps) {
  const { language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useViewerProfile();
  const addMutation = useAddCommentMutation();
  const moderationContext = useMatchModerationContext(matchId);
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMatchComments(matchId);

  const [openReplyId, setOpenReplyId] = useState<string | null>(null);

  const flat: MatchComment[] = useMemo(
    () => data?.pages.flatMap((p) => p) ?? [],
    [data],
  );
  const tree: ThreadedComment[] = useMemo(
    () => buildCommentTree(flat),
    [flat],
  );

  const heading = language === "vi" ? "BÌNH LUẬN" : "COMMENTS";
  const totalCount = flat.filter((c) => !c.is_deleted).length;

  const handleSignInRedirect = () => {
    const redirect = encodeURIComponent(
      location.pathname + (location.hash || "#comments"),
    );
    navigate(`/login?redirect=${redirect}`);
  };

  const handleRootSubmit = async (body: string) => {
    await addMutation.mutateAsync({
      matchId,
      body,
      parentCommentId: null,
      authorProfile: profile,
    });
  };

  return (
    <section
      id="comments"
      aria-label={heading}
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid var(--tl-border, rgba(255,255,255,0.12))",
      }}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          margin: 0,
          marginBottom: 20,
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--tl-fg-2)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--tl-green, #00b96b)",
          }}
        />
        {heading}
        {totalCount > 0 && (
          <span
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 18,
              color: "var(--tl-fg-3)",
              marginLeft: 4,
            }}
          >
            {totalCount}
          </span>
        )}
      </h2>

      {/* Root composer or sign-in nudge */}
      {user ? (
        <div style={{ marginBottom: 24 }}>
          <CommentInput
            isSubmitting={addMutation.isPending}
            onSubmit={handleRootSubmit}
            placeholder={
              language === "vi" ? "Viết bình luận…" : "Write a comment…"
            }
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleSignInRedirect}
          style={{
            display: "block",
            width: "100%",
            padding: "14px 16px",
            marginBottom: 24,
            background: "transparent",
            border: "1px dashed var(--tl-border)",
            borderRadius: 4,
            color: "var(--tl-fg-2)",
            fontFamily: "'Geist Mono', monospace",
            fontSize: 12,
            textAlign: "center",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          {language === "vi"
            ? "Đăng nhập để bình luận"
            : "Sign in to comment"}
        </button>
      )}

      {/* List */}
      {isLoading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Loader2
            className="animate-spin"
            style={{ width: 20, height: 20, color: "var(--tl-fg-3)" }}
          />
        </div>
      ) : tree.length === 0 ? (
        <p
          style={{
            padding: "20px 0",
            textAlign: "center",
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 16,
            color: "var(--tl-fg-3)",
          }}
        >
          {language === "vi"
            ? "Chưa có bình luận. Hãy là người đầu tiên."
            : "No comments yet. Be the first."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {tree.map((node) => (
            <CommentTreeNode
              key={node.comment_id}
              node={node}
              matchId={matchId}
              viewerId={user?.id ?? null}
              moderationContext={moderationContext}
              openReplyId={openReplyId}
              setOpenReplyId={setOpenReplyId}
            />
          ))}
        </ul>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid var(--tl-border)",
              borderRadius: 4,
              color: "var(--tl-fg-2)",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              cursor: isFetchingNextPage ? "default" : "pointer",
            }}
          >
            {isFetchingNextPage
              ? language === "vi"
                ? "Đang tải…"
                : "Loading…"
              : language === "vi"
                ? "Tải thêm"
                : "Load more"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ─── Recursive renderer ──────────────────────────────────────────────── */

interface NodeProps {
  node: ThreadedComment;
  matchId: string;
  viewerId: string | null;
  moderationContext: ModerationContext;
  openReplyId: string | null;
  setOpenReplyId: (id: string | null) => void;
}

function CommentTreeNode({
  node,
  matchId,
  viewerId,
  moderationContext,
  openReplyId,
  setOpenReplyId,
}: NodeProps) {
  const isReplyOpen = openReplyId === node.comment_id;
  return (
    <li style={{ listStyle: "none" }}>
      <CommentRow
        comment={node}
        matchId={matchId}
        viewerId={viewerId}
        moderationContext={moderationContext}
        isReplyOpen={isReplyOpen}
        onToggleReply={() =>
          setOpenReplyId(isReplyOpen ? null : node.comment_id)
        }
        onReplySubmitted={() => setOpenReplyId(null)}
      />
      {node.children.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {node.children.map((child) => (
            <CommentTreeNode
              key={child.comment_id}
              node={child}
              matchId={matchId}
              viewerId={viewerId}
              moderationContext={moderationContext}
              openReplyId={openReplyId}
              setOpenReplyId={setOpenReplyId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default CommentThread;
