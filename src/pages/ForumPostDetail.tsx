import { useParams, Link, useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useForumPost } from "@/hooks/useForumPost";
import { useDeleteForumPost, useTogglePinPost } from "@/hooks/useForumPosts";
import { useToggleHidePost } from "@/hooks/useForumPost";
import { useForumLike } from "@/hooks/useForumLike";
import { PostCommentSection } from "@/components/forum";
import { UserAvatar } from "@/components/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Pin, HelpCircle, Trash2, MoreVertical, EyeOff, Eye, Flag } from "lucide-react";
import { ReportDialog } from "@/components/report";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import MainLayout from "@/components/layout/MainLayout";
import { DynamicMeta } from "@/components/seo";
import { toast } from "@/hooks/use-toast";

const ForumPostDetail = () => {
  const { postId } = useParams();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const locale = language === "vi" ? vi : enUS;

  const { data: post, isLoading } = useForumPost(postId);
  const { isLiked, toggleLike, isToggling } = useForumLike("post", postId || "");
  const deletePost = useDeleteForumPost();
  const togglePin = useTogglePinPost();
  const toggleHide = useToggleHidePost();

  const isOwner = user?.id === post?.user_id;
  const canManage = isOwner || isAdmin;

  const handleDelete = () => {
    if (!postId || !confirm(t.forum.deletePostConfirm)) return;
    deletePost.mutate(postId, {
      onSuccess: () => {
        toast({ title: t.forum.deletePost });
        navigate("/forum");
      },
    });
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container-wide py-6">
          <div className="h-64 rounded-xl bg-muted animate-pulse" />
        </div>
      </MainLayout>
    );
  }

  if (!post) {
    return (
      <MainLayout>
        <div className="container-wide py-12 text-center text-muted-foreground">Post not found</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta title={`${post.title} - ${t.forum.title}`} description={post.content.substring(0, 160)} />
      <div className="container-wide max-w-3xl py-6 space-y-6">
        {/* Back */}
        <Link to="/forum" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          {t.forum.backToForum}
        </Link>

        {/* Post */}
        <article className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {post.is_pinned && <Pin className="w-4 h-4 text-primary" />}
              {post.is_qa && (
                <Badge variant="outline" className="gap-0.5">
                  <HelpCircle className="w-3 h-3" />
                  {t.forum.qa}
                </Badge>
              )}
              {post.category_name && (
                <Badge variant="secondary">{post.category_name}</Badge>
              )}
            </div>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => togglePin.mutate({ postId: post.id, isPinned: post.is_pinned })}>
                      <Pin className="w-4 h-4 mr-2" />
                      {post.is_pinned ? t.forum.unpinPost : t.forum.pinPost}
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => toggleHide.mutate({ postId: post.id, isHidden: !!(post as any).is_hidden })}>
                      {(post as any).is_hidden ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                      {(post as any).is_hidden ? "Hiện bài" : "Ẩn bài"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t.forum.deletePost}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <h1 className="text-2xl font-bold">{post.title}</h1>

          <div className="flex items-center gap-3">
            <UserAvatar avatarUrl={post.author_avatar} displayName={post.author_name} size="sm" />
            <div>
              <span className="text-sm font-medium">{post.author_name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale })}
              </span>
            </div>
          </div>

          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
            {post.content}
          </div>

          {post.image_urls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {post.image_urls.map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="rounded-lg w-full object-cover max-h-64" />
              ))}
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag: string) => (
                <Link key={tag} to={`/forum?tag=${tag}`}>
                  <Badge variant="secondary" className="text-xs cursor-pointer">
                    #{tag}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <button
              onClick={() => toggleLike()}
              disabled={!user || isToggling}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Heart className={`w-5 h-5 ${isLiked ? "fill-primary text-primary" : ""}`} />
              {post.like_count} {t.forum.likes}
            </button>
            <ReportDialog contentType="forum_post" contentId={post.id} contentTitle={post.title} />
          </div>
        </article>

        {/* Comments */}
        <PostCommentSection postId={post.id} postUserId={post.user_id} isQA={post.is_qa} />
      </div>
    </MainLayout>
  );
};

export default ForumPostDetail;
