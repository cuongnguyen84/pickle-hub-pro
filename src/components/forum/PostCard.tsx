import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { ForumPost } from "@/hooks/useForumPosts";
import { Heart, MessageCircle, Pin, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";

interface PostCardProps {
  post: ForumPost;
}

const PostCard = ({ post }: PostCardProps) => {
  const { t, language } = useI18n();
  const locale = language === "vi" ? vi : enUS;

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale,
  });

  const excerpt = post.content.length > 200 
    ? post.content.substring(0, 200) + "..." 
    : post.content;

  return (
    <Link
      to={`/forum/post/${post.id}`}
      className="block glass-card p-4"
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          avatarUrl={post.author_avatar}
          displayName={post.author_name}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {post.is_pinned && (
              <Pin className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
            {post.is_qa && (
              <Badge variant="outline" className="text-xs py-0 px-1.5 gap-0.5">
                <HelpCircle className="w-3 h-3" />
                {t.forum.qa}
              </Badge>
            )}
            <h3 className="font-semibold text-foreground line-clamp-2 text-sm sm:text-base">
              {post.title}
            </h3>
          </div>

          <p className="text-sm text-foreground-secondary line-clamp-2 mb-2">
            {excerpt}
          </p>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs py-0">
                  #{tag}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{post.tags.length - 3}</span>
              )}
            </div>
          )}

          {post.image_urls.length > 0 && (
            <div className="flex gap-1 mb-2">
              {post.image_urls.slice(0, 3).map((url, i) => (
                <div key={i} className="w-16 h-16 rounded-md overflow-hidden bg-muted">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{post.author_name}</span>
            <span>{timeAgo}</span>
            {post.category_name && (
              <Badge variant="outline" className="text-xs py-0">
                {post.category_name}
              </Badge>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <Heart className="w-3.5 h-3.5" />
              <span>{post.like_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{post.comment_count}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default PostCard;
