import { useState } from "react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useForumComments, useCreateForumComment, useToggleBestAnswer, useDeleteForumComment, ForumComment } from "@/hooks/useForumPost";
import { useForumLike } from "@/hooks/useForumLike";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user";
import { Heart, CheckCircle2, Trash2 } from "lucide-react";
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
}: {
  comment: ForumComment;
  postUserId: string;
  isQA: boolean;
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

  const handleSubmit = () => {
    if (!content.trim() || !user) return;
    createComment.mutate(
      { post_id: postId, user_id: user.id, content: content.trim() },
      { onSuccess: () => setContent("") }
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">
        {t.forum.comments} ({comments.length})
      </h3>

      {user ? (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.forum.writeComment}
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
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PostCommentSection;
