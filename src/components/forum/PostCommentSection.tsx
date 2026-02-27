import { useState, useRef } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useForumComments, useCreateForumComment, useToggleBestAnswer, useDeleteForumComment, ForumComment } from "@/hooks/useForumPost";
import { useForumLike } from "@/hooks/useForumLike";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user";
import { Heart, CheckCircle2, Trash2, Reply, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { Link } from "react-router-dom";
import { getLoginUrl } from "@/lib/auth-config";

interface PostCommentSectionProps {
  postId: string;
  postUserId: string;
  isQA: boolean;
}

const CommentItem = ({
  comment,
  postUserId,
  isQA,
  onReply,
}: {
  comment: ForumComment;
  postUserId: string;
  isQA: boolean;
  onReply: (comment: ForumComment) => void;
}) => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const locale = language === "vi" ? vi : enUS;
  const { isLiked, toggleLike, isToggling } = useForumLike("comment", comment.id);
  const toggleBestAnswer = useToggleBestAnswer();
  const deleteComment = useDeleteForumComment();
  const isPostOwner = user?.id === postUserId;
  const isCommentOwner = user?.id === comment.user_id;

  return (
    <div
      className={`p-3 rounded-lg ${
        comment.is_best_answer ? "bg-green-500/10 border border-green-500/30" : "bg-muted/50"
      }`}
    >
      {comment.is_best_answer && (
        <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium mb-2">
          <CheckCircle2 className="w-4 h-4" />
          {t.forum.bestAnswer}
        </div>
      )}

      {/* Quoted parent comment */}
      {comment.parent_id && comment.parent_content && (
        <div className="mb-2 pl-3 border-l-2 border-primary/30 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">{comment.parent_author_name}</span>
          <p className="line-clamp-2 mt-0.5">{comment.parent_content}</p>
        </div>
      )}

      <div className="flex items-start gap-2">
        <UserAvatar avatarUrl={comment.author_avatar} displayName={comment.author_name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale })}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => toggleLike()}
              disabled={!user || isToggling}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? "fill-primary text-primary" : ""}`} />
              {comment.like_count}
            </button>
            {user && (
              <button
                onClick={() => onReply(comment)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                {t.forum.reply}
              </button>
            )}
            {isQA && isPostOwner && (
              <button
                onClick={() =>
                  toggleBestAnswer.mutate({
                    commentId: comment.id,
                    isBestAnswer: comment.is_best_answer,
                    postId: comment.post_id,
                  })
                }
                className="text-xs text-muted-foreground hover:text-green-600 transition-colors"
              >
                {comment.is_best_answer ? t.forum.unmarkBestAnswer : t.forum.markBestAnswer}
              </button>
            )}
            {isCommentOwner && (
              <button
                onClick={() => deleteComment.mutate({ commentId: comment.id, postId: comment.post_id })}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PostCommentSection = ({ postId, postUserId, isQA }: PostCommentSectionProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: comments = [] } = useForumComments(postId);
  const createComment = useCreateForumComment();
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<ForumComment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReply = (comment: ForumComment) => {
    setReplyTo(comment);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSubmit = () => {
    if (!content.trim() || !user) return;
    createComment.mutate(
      { post_id: postId, user_id: user.id, content: content.trim(), parent_id: replyTo?.id || null },
      {
        onSuccess: () => {
          setContent("");
          setReplyTo(null);
        },
      }
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        {t.forum.comments} ({comments.length})
      </h3>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">{t.forum.noCommentsYet}</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postUserId={postUserId}
              isQA={isQA}
              onReply={handleReply}
            />
          ))}
        </div>
      )}

      {user ? (
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <Reply className="w-3.5 h-3.5 text-primary" />
              <span>{t.forum.replyingTo} <strong className="text-foreground">{replyTo.author_name}</strong></span>
              <span className="flex-1 truncate text-muted-foreground/70">"{replyTo.content}"</span>
              <button onClick={() => setReplyTo(null)} className="hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={replyTo ? `${t.forum.reply} @${replyTo.author_name}...` : t.forum.writeComment}
            rows={3}
          />
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || createComment.isPending}
            size="sm"
          >
            {createComment.isPending ? t.forum.publishing : t.comments.submit}
          </Button>
        </div>
      ) : (
        <Link
          to={getLoginUrl("/forum/post/" + postId)}
          className="block p-3 text-center text-sm text-muted-foreground bg-muted rounded-lg hover:bg-muted/80"
        >
          {t.forum.loginToComment}
        </Link>
      )}
    </div>
  );
};

export default PostCommentSection;
