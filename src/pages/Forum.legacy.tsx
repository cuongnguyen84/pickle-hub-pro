import { useState, useMemo } from "react";
import { useI18n } from "@/i18n";
import { useForumPosts } from "@/hooks/useForumPosts";
import { PostCard, ForumCategoryNav, TagFilter } from "@/components/forum";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/lib/auth-config";
import MainLayout from "@/components/layout/MainLayout";
import { DynamicMeta, HreflangTags } from "@/components/seo";

/**
 * Legacy Forum page — archived 2026-04-27 during sub-route cutover.
 * Accessible at /forum-legacy for 14-day rollback. Cleanup 2026-05-09.
 */
const ForumLegacy = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || undefined;
  const activeTag = searchParams.get("tag") || undefined;

  const { data: posts = [], isLoading } = useForumPosts({ categorySlug, tag: activeTag });

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    posts.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 20);
  }, [posts]);

  const handleCategorySelect = (slug: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (slug) params.set("category", slug);
    else params.delete("category");
    setSearchParams(params);
  };

  const handleTagSelect = (tag: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (tag) params.set("tag", tag);
    else params.delete("tag");
    setSearchParams(params);
  };

  return (
    <MainLayout>
      <DynamicMeta
        title={`${t.forum.title} - ThePickleHub`}
        description="Diễn đàn cộng đồng Pickleball Việt Nam. Thảo luận kỹ thuật, chia sẻ kinh nghiệm, tìm bạn chơi pickleball. Join the Vietnamese pickleball community forum."
      />
      <HreflangTags enPath="/forum" viPath="/vi/forum" />
      <div className="container-wide py-6 space-y-4 w-full min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-gradient-brand">{t.forum.title}</h1>
          </div>
          {user ? (
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/forum/new">
                <Plus className="w-4 h-4" />
                {t.forum.createPost}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to={getLoginUrl("/forum")}>{t.forum.loginToPost}</Link>
            </Button>
          )}
        </div>

        {/* Category navigation */}
        <ForumCategoryNav activeSlug={categorySlug} onSelect={handleCategorySelect} />

        {/* Tag filter */}
        {allTags.length > 0 && (
          <TagFilter tags={allTags} activeTag={activeTag} onSelectTag={handleTagSelect} />
        )}

        {/* Post list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{t.forum.noPostsYet}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ForumLegacy;
