import { useContext, useMemo, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuthOptional } from "@/hooks/useAuth";
import {
  buildCommentTree,
  type ThreadedComment,
} from "@/lib/social/comment-helpers";
import {
  resolveDeletePermission,
  type ModerationContext,
} from "@/lib/social/comment-moderation";
import type { EngagementTargetType } from "@/lib/social/engagement";
import {
  useAddTargetCommentMutation,
  useDeleteTargetCommentMutation,
  useEditTargetCommentMutation,
  useTargetComments,
  useTargetModerationContext,
  type TargetComment,
} from "@/hooks/social/useTargetComments";
import { CommentInput } from "./CommentInput";

/**
 * Comment thread for non-match feed targets (2026-11-24): same
 * social_comments module, same rules as the match thread (auth to
 * write, threading to depth 4, soft-delete tombstones, moderation
 * delete paths), rendered inline under a feed card.
 *
 * The wrapper renders nothing without a QueryClient: article pages
 * also mount in bare test trees with mocked data hooks and no
 * providers, where the thread's queries would throw. The real app
 * always provides one.
 */
export function TargetCommentThread(props: {
  targetType: EngagementTargetType;
  targetId: string;
}) {
  const queryClient = useContext(QueryClientContext);
  if (!queryClient) return null;
  return <TargetCommentThreadInner {...props} />;
}

function TargetCommentThreadInner({
  targetType,
  targetId,
}: {
  targetType: EngagementTargetType;
  targetId: string;
}) {
  const { language } = useI18n();
  const user = useAuthOptional()?.user ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const moderationContext = useTargetModerationContext();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useTargetComments(targetType, targetId);
  const addMutation = useAddTargetCommentMutation(targetType, targetId);
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);

  const flat: TargetComment[] = useMemo(
    () => data?.pages.flatMap((p) => p) ?? [],
    [data],
  );
  const tree = useMemo(() => buildCommentTree(flat), [flat]);

  const handleSignInRedirect = () => {
    const redirect = encodeURIComponent(location.pathname + location.search);
    navigate(`/login?redirect=${redirect}`);
  };

  return (
    <div style={{ padding: "4px 0 8px" }}>
      {user ? (
        <div style={{ marginBottom: 16 }}>
          <CommentInput
            isSubmitting={addMutation.isPending}
            onSubmit={async (body) => {
              await addMutation.mutateAsync({ body, parentCommentId: null });
            }}
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
            padding: "12px 16px",
            marginBottom: 16,
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
          {language === "vi" ? "Đăng nhập để bình luận" : "Sign in to comment"}
        </button>
      )}

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
          <Loader2
            className="animate-spin"
            style={{ width: 20, height: 20, color: "var(--tl-fg-3)" }}
          />
        </div>
      ) : tree.length === 0 ? (
        <p
          style={{
            padding: "12px 0",
            textAlign: "center",
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: 15,
            color: "var(--tl-fg-3)",
            margin: 0,
          }}
        >
          {language === "vi"
            ? "Chưa có bình luận. Hãy là người đầu tiên."
            : "No comments yet. Be the first."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {tree.map((node) => (
            <TargetCommentTreeNode
              key={node.comment_id}
              node={node}
              targetType={targetType}
              targetId={targetId}
              viewerId={user?.id ?? null}
              moderationContext={moderationContext}
              openReplyId={openReplyId}
              setOpenReplyId={setOpenReplyId}
            />
          ))}
        </ul>
      )}

      {hasNextPage && (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            style={{
              background: "transparent",
              border: "1px solid var(--tl-border)",
              borderRadius: 999,
              padding: "7px 16px",
              fontSize: 13,
              color: "var(--tl-fg-2)",
              cursor: "pointer",
            }}
          >
            {isFetchingNextPage
              ? language === "vi"
                ? "Đang tải…"
                : "Loading…"
              : language === "vi"
                ? "Xem thêm bình luận"
                : "Load more comments"}
          </button>
        </div>
      )}
    </div>
  );
}

function TargetCommentTreeNode({
  node,
  targetType,
  targetId,
  viewerId,
  moderationContext,
  openReplyId,
  setOpenReplyId,
}: {
  node: ThreadedComment;
  targetType: EngagementTargetType;
  targetId: string;
  viewerId: string | null;
  moderationContext: ModerationContext;
  openReplyId: string | null;
  setOpenReplyId: (id: string | null) => void;
}) {
  return (
    <li>
      <TargetCommentRow
        comment={node}
        targetType={targetType}
        targetId={targetId}
        viewerId={viewerId}
        moderationContext={moderationContext}
        isReplyOpen={openReplyId === node.comment_id}
        onToggleReply={() =>
          setOpenReplyId(openReplyId === node.comment_id ? null : node.comment_id)
        }
        onReplySubmitted={() => setOpenReplyId(null)}
      />
      {node.children.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            marginLeft: 20,
            borderLeft: "1px solid var(--tl-border)",
            paddingLeft: 14,
          }}
        >
          {node.children.map((child) => (
            <TargetCommentTreeNode
              key={child.comment_id}
              node={child}
              targetType={targetType}
              targetId={targetId}
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

function TargetCommentRow({
  comment,
  targetType,
  targetId,
  viewerId,
  moderationContext,
  isReplyOpen,
  onToggleReply,
  onReplySubmitted,
}: {
  comment: TargetComment;
  targetType: EngagementTargetType;
  targetId: string;
  viewerId: string | null;
  moderationContext: ModerationContext;
  isReplyOpen: boolean;
  onToggleReply: () => void;
  onReplySubmitted: () => void;
}) {
  const { language } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const addMutation = useAddTargetCommentMutation(targetType, targetId);
  const editMutation = useEditTargetCommentMutation(targetType, targetId);
  const deleteMutation = useDeleteTargetCommentMutation(targetType, targetId);

  const isOwn = viewerId !== null && viewerId === comment.user_id;
  const deleteActor = comment.is_deleted
    ? null
    : resolveDeletePermission(moderationContext, comment.user_id);
  const canReply = !!viewerId && !comment.is_deleted && comment.depth < 4;
  const name = comment.display_name ?? comment.username ?? "";
  const wasEdited =
    !!comment.updated_at && comment.updated_at !== comment.created_at;

  return (
    <div
      style={{
        borderTop: "1px solid var(--tl-border)",
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            overflow: "hidden",
            flex: "0 0 auto",
            background: "var(--tl-surface, rgba(255,255,255,0.05))",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {comment.avatar_url && !comment.is_deleted ? (
            <img
              src={comment.avatar_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          ) : (
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--tl-fg-3)",
              }}
            >
              {(name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        {comment.username && !comment.is_deleted ? (
          <Link
            to={`/nguoi-choi/${comment.username}`}
            style={{
              fontSize: 13.5,
              fontWeight: 550,
              color: "var(--tl-fg)",
              textDecoration: "none",
            }}
          >
            {name}
          </Link>
        ) : (
          <span style={{ fontSize: 13.5, fontWeight: 550, color: "var(--tl-fg-3)" }}>
            {comment.is_deleted ? (language === "vi" ? "Đã xóa" : "Deleted") : name}
          </span>
        )}
        <time
          dateTime={comment.created_at}
          style={{ fontSize: 12, color: "var(--tl-fg-3)" }}
        >
          {formatRelative(comment.created_at, language)}
          {wasEdited ? (language === "vi" ? " · đã sửa" : " · edited") : ""}
        </time>
      </header>

      {isEditing ? (
        <CommentInput
          initialBody={comment.body}
          autoFocus
          isSubmitting={editMutation.isPending}
          submitLabel={language === "vi" ? "Lưu" : "Save"}
          onSubmit={async (body) => {
            await editMutation.mutateAsync({
              commentId: comment.comment_id,
              body,
            });
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: 14.5,
            lineHeight: 1.55,
            color: comment.is_deleted ? "var(--tl-fg-3)" : "var(--tl-fg)",
            fontStyle: comment.is_deleted ? "italic" : "normal",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {comment.is_deleted
            ? language === "vi"
              ? "Bình luận đã bị xóa."
              : "This comment was deleted."
            : comment.body}
        </p>
      )}

      {!isEditing && !comment.is_deleted && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 8,
          }}
        >
          {canReply && (
            <RowAction
              onClick={onToggleReply}
              icon={<MessageCircle style={{ width: 13, height: 13 }} />}
              label={language === "vi" ? "Trả lời" : "Reply"}
            />
          )}
          {isOwn && (
            <RowAction
              onClick={() => setIsEditing(true)}
              icon={<Pencil style={{ width: 13, height: 13 }} />}
              label={language === "vi" ? "Sửa" : "Edit"}
            />
          )}
          {deleteActor && (
            <RowAction
              onClick={() => deleteMutation.mutate(comment.comment_id)}
              icon={<Trash2 style={{ width: 13, height: 13 }} />}
              label={language === "vi" ? "Xóa" : "Delete"}
              danger={deleteActor === "owner"}
            />
          )}
        </div>
      )}

      {isReplyOpen && !comment.is_deleted && (
        <div style={{ marginTop: 10 }}>
          <CommentInput
            autoFocus
            isSubmitting={addMutation.isPending}
            onSubmit={async (body) => {
              await addMutation.mutateAsync({
                body,
                parentCommentId: comment.comment_id,
              });
              onReplySubmitted();
            }}
            onCancel={onToggleReply}
            placeholder={
              language === "vi" ? "Viết trả lời…" : "Write a reply…"
            }
          />
        </div>
      )}
    </div>
  );
}

function RowAction({
  onClick,
  icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "transparent",
        border: "none",
        padding: 0,
        fontSize: 12.5,
        cursor: "pointer",
        color: danger ? "var(--tl-red, #e5484d)" : "var(--tl-fg-3)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function formatRelative(iso: string, language: "vi" | "en"): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return language === "vi" ? "vừa xong" : "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}${language === "vi" ? " phút" : "m"}`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}${language === "vi" ? " giờ" : "h"}`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}${language === "vi" ? " ngày" : "d"}`;
  return new Date(iso).toLocaleDateString(
    language === "vi" ? "vi-VN" : "en-US",
    { day: "numeric", month: "numeric", year: "numeric" },
  );
}
