import { useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Trash2, MessageCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import { parseMentions } from "@/lib/social/comment-helpers";
import type { MatchComment } from "@/hooks/social/useComments";
import {
  useAddCommentMutation,
  useEditCommentMutation,
  useDeleteCommentMutation,
} from "@/hooks/social/useComments";
import { CommentInput } from "./CommentInput";
import { useViewerProfile } from "./viewer-profile";

const MAX_DEPTH = 4;

interface CommentRowProps {
  comment: MatchComment;
  matchId: string;
  /** Current viewer id, or null when anonymous. Drives edit/delete visibility. */
  viewerId: string | null;
  /** Toggle reply form visibility — owned by parent (CommentThread) so only
   *  one reply form is open at a time across the tree. */
  isReplyOpen: boolean;
  onToggleReply: () => void;
  /** Called when reply submit succeeds — parent closes the form. */
  onReplySubmitted: () => void;
}

const isOptimisticId = (id: string) => id.startsWith("optimistic-");

/**
 * One comment row — header (avatar + name + meta), body with mention
 * linkify, action buttons (reply / edit / delete). Soft-deleted rows
 * render a tombstone but keep their position in the thread so children
 * remain anchored.
 */
export function CommentRow({
  comment,
  matchId,
  viewerId,
  isReplyOpen,
  onToggleReply,
  onReplySubmitted,
}: CommentRowProps) {
  const { language } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const editMutation = useEditCommentMutation();
  const deleteMutation = useDeleteCommentMutation();

  const isOwn = viewerId !== null && viewerId === comment.user_id;
  const canReply = !comment.is_deleted && comment.depth < MAX_DEPTH;
  // Hide write actions on optimistic rows (server hasn't assigned a real id
  // yet — editing/deleting them would target a placeholder).
  const isOptimistic = isOptimisticId(comment.comment_id);

  const wasEdited =
    !comment.is_deleted &&
    comment.updated_at !== null &&
    comment.updated_at !== comment.created_at;

  const handleEditSubmit = async (body: string) => {
    await editMutation.mutateAsync({
      matchId,
      commentId: comment.comment_id,
      body,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (
      window.confirm(
        language === "vi"
          ? "Xoá bình luận này?"
          : "Delete this comment?",
      )
    ) {
      deleteMutation.mutate({ matchId, commentId: comment.comment_id });
    }
  };

  return (
    <article
      aria-label={
        comment.is_deleted
          ? language === "vi"
            ? "Bình luận đã xoá"
            : "Deleted comment"
          : `${comment.display_name ?? comment.username ?? "Anonymous"}: ${comment.body}`
      }
      style={{
        marginLeft: comment.depth * 24,
        paddingLeft: comment.depth > 0 ? 12 : 0,
        borderLeft:
          comment.depth > 0
            ? "1px solid var(--tl-border, rgba(255,255,255,0.12))"
            : "none",
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 6,
        }}
      >
        <CommentAvatar
          username={comment.username}
          displayName={comment.display_name}
          avatarUrl={comment.avatar_url}
          isDeleted={comment.is_deleted}
        />
        <CommentByline
          username={comment.username}
          displayName={comment.display_name}
          isDeleted={comment.is_deleted}
        />
        <CommentTimeMeta
          createdAt={comment.created_at}
          edited={wasEdited}
          language={language}
        />
      </header>

      {/* Body or inline edit form */}
      {isEditing ? (
        <CommentInput
          initialBody={comment.body}
          autoFocus
          isSubmitting={editMutation.isPending}
          submitLabel={language === "vi" ? "Lưu" : "Save"}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <CommentBody body={comment.body} isDeleted={comment.is_deleted} />
      )}

      {/* Action row — reply / edit / delete */}
      {!isEditing && !comment.is_deleted && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 8,
          }}
        >
          {canReply && (
            <ActionButton
              onClick={onToggleReply}
              icon={<MessageCircle style={{ width: 13, height: 13 }} />}
              label={language === "vi" ? "Trả lời" : "Reply"}
              ariaPressed={isReplyOpen}
            />
          )}
          {isOwn && !isOptimistic && (
            <>
              <ActionButton
                onClick={() => setIsEditing(true)}
                icon={<Pencil style={{ width: 13, height: 13 }} />}
                label={language === "vi" ? "Sửa" : "Edit"}
              />
              <ActionButton
                onClick={handleDelete}
                icon={<Trash2 style={{ width: 13, height: 13 }} />}
                label={language === "vi" ? "Xoá" : "Delete"}
                tone="danger"
                disabled={deleteMutation.isPending}
              />
            </>
          )}
        </div>
      )}

      {/* Reply composer (rendered inline beneath the row, before children) */}
      {isReplyOpen && !comment.is_deleted && (
        <div style={{ marginTop: 12 }}>
          <ReplyComposer
            matchId={matchId}
            parentCommentId={comment.comment_id}
            parentDepth={comment.depth}
            onCancel={onToggleReply}
            onSubmitted={onReplySubmitted}
          />
        </div>
      )}
    </article>
  );
}

/* ─── Reply composer (own mutation) ───────────────────────────────────── */

interface ReplyComposerProps {
  matchId: string;
  parentCommentId: string;
  parentDepth: number;
  onCancel: () => void;
  onSubmitted: () => void;
}

function ReplyComposer({
  matchId,
  parentCommentId,
  parentDepth,
  onCancel,
  onSubmitted,
}: ReplyComposerProps) {
  const { language } = useI18n();
  const profile = useViewerProfile();
  const mutation = useAddCommentMutation();

  const handleSubmit = async (body: string) => {
    await mutation.mutateAsync({
      matchId,
      body,
      parentCommentId,
      parentDepth,
      authorProfile: profile,
    });
    onSubmitted();
  };

  return (
    <CommentInput
      autoFocus
      isSubmitting={mutation.isPending}
      placeholder={
        language === "vi" ? "Trả lời bình luận…" : "Write a reply…"
      }
      submitLabel={language === "vi" ? "Trả lời" : "Reply"}
      onSubmit={handleSubmit}
      onCancel={onCancel}
    />
  );
}

/* ─── Sub-pieces ──────────────────────────────────────────────────────── */

function CommentAvatar({
  username,
  displayName,
  avatarUrl,
  isDeleted,
}: {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isDeleted: boolean;
}) {
  const fallback = (displayName ?? username ?? "?").trim().charAt(0).toUpperCase();
  const dim = isDeleted;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: dim
          ? "var(--tl-bg-3, rgba(255,255,255,0.06))"
          : "var(--tl-bg-2, rgba(255,255,255,0.08))",
        overflow: "hidden",
        flexShrink: 0,
        fontFamily: "'Geist Mono', monospace",
        fontSize: 11,
        color: dim ? "var(--tl-fg-4)" : "var(--tl-fg-2)",
      }}
    >
      {avatarUrl && !isDeleted ? (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

function CommentByline({
  username,
  displayName,
  isDeleted,
}: {
  username: string | null;
  displayName: string | null;
  isDeleted: boolean;
}) {
  const { language } = useI18n();
  if (isDeleted) {
    return (
      <span
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--tl-fg-4)",
        }}
      >
        {language === "vi" ? "Đã xoá" : "Deleted"}
      </span>
    );
  }
  const name = displayName ?? username ?? "Unknown";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 16,
          color: "var(--tl-fg)",
        }}
      >
        {name}
      </span>
      {username && (
        <Link
          to={`/nguoi-choi/${username}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            color: "var(--tl-fg-3)",
            textDecoration: "none",
          }}
        >
          @{username}
        </Link>
      )}
    </span>
  );
}

function CommentTimeMeta({
  createdAt,
  edited,
  language,
}: {
  createdAt: string;
  edited: boolean;
  language: "vi" | "en";
}) {
  return (
    <span
      style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10.5,
        color: "var(--tl-fg-4)",
        marginLeft: "auto",
      }}
    >
      <time dateTime={createdAt}>{formatRelative(createdAt, language)}</time>
      {edited && (
        <span
          style={{
            fontStyle: "italic",
            marginLeft: 6,
            color: "var(--tl-fg-3)",
            fontFamily: "'Instrument Serif', serif",
            fontSize: 12,
          }}
        >
          {language === "vi" ? "(đã sửa)" : "(edited)"}
        </span>
      )}
    </span>
  );
}

function CommentBody({
  body,
  isDeleted,
}: {
  body: string;
  isDeleted: boolean;
}) {
  if (isDeleted) {
    return (
      <p
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 14,
          color: "var(--tl-fg-4)",
          margin: 0,
        }}
      >
        [deleted]
      </p>
    );
  }
  const segments = parseMentions(body);
  return (
    <p
      style={{
        fontSize: 14,
        lineHeight: 1.55,
        color: "var(--tl-fg-1, var(--tl-fg))",
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {segments.map((s, i) =>
        s.type === "text" ? (
          <span key={i}>{s.value}</span>
        ) : (
          <Link
            key={i}
            to={`/nguoi-choi/${s.username}`}
            onClick={(e) => e.stopPropagation()}
            style={{ color: "var(--tl-green)", textDecoration: "none" }}
          >
            @{s.username}
          </Link>
        ),
      )}
    </p>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  ariaPressed,
  tone,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  ariaPressed?: boolean;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={ariaPressed}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 6px",
        background: "transparent",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "'Geist Mono', monospace",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color:
          tone === "danger"
            ? "var(--tl-live, #ff4136)"
            : "var(--tl-fg-3)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─── Relative time formatter ─────────────────────────────────────────── */

function formatRelative(iso: string, language: "vi" | "en"): string {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) return iso;
  const diffSec = Math.floor((Date.now() - created) / 1000);
  if (diffSec < 60) return language === "vi" ? "vừa xong" : "just now";
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return language === "vi" ? `${m} phút trước` : `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return language === "vi" ? `${h} giờ trước` : `${h}h ago`;
  }
  if (diffSec < 86400 * 30) {
    const d = Math.floor(diffSec / 86400);
    return language === "vi" ? `${d} ngày trước` : `${d}d ago`;
  }
  // Fall back to short date for older comments.
  return new Date(iso).toLocaleDateString(
    language === "vi" ? "vi-VN" : "en-US",
    { day: "2-digit", month: "short", year: "numeric" },
  );
}

export default CommentRow;
