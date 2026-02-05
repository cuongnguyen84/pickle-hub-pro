import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar, UserDisplayName } from "@/components/user";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { Link, useLocation } from "react-router-dom";
import { getLoginUrl } from "@/lib/auth-config";

interface CommentSectionProps {
  targetType: "video" | "livestream";
  targetId: string;
}

interface CommentUserInfo {
  displayName: string;
  avatarUrl: string | null;
  isCreator: boolean;
}

export function CommentSection({ targetType, targetId }: CommentSectionProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userInfoCache, setUserInfoCache] = useState<Record<string, CommentUserInfo>>({});

  const { data: comments = [], isLoading } = useComments(targetType, targetId);

  const MAX_COMMENT_LENGTH = 2000;

  // Fetch user info for commenters
  useEffect(() => {
    const userIds = [...new Set(comments.map(c => c.user_id))];
    const uncachedIds = userIds.filter(id => !(id in userInfoCache));
    
    if (uncachedIds.length === 0) return;

    const fetchUserInfo = async () => {
      const results: Record<string, CommentUserInfo> = {};
      
      await Promise.all(
        uncachedIds.map(async (userId) => {
          try {
            // Fetch profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("display_name, avatar_url")
              .eq("id", userId)
              .single();

            // Check if creator
            const { data: isCreator } = await supabase.rpc("is_user_creator", { _user_id: userId });

            results[userId] = {
              displayName: profile?.display_name || "User",
              avatarUrl: profile?.avatar_url || null,
              isCreator: !!isCreator,
            };
          } catch {
            results[userId] = {
              displayName: "User",
              avatarUrl: null,
              isCreator: false,
            };
          }
        })
      );
      
      setUserInfoCache(prev => ({ ...prev, ...results }));
    };

    fetchUserInfo();
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedContent = content.trim();
    
    if (!user || !trimmedContent) return;

    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      toast({
        variant: "destructive",
        title: `Comment too long (max ${MAX_COMMENT_LENGTH} characters)`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("comments").insert({
        target_type: targetType,
        target_id: targetId,
        user_id: user.id,
        content: trimmedContent,
      });

      if (error) throw error;

      setContent("");
      queryClient.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t.common.error,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({ title: t.comments.deleted });
      queryClient.invalidateQueries({ queryKey: ["comments", targetType, targetId] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t.common.error,
      });
    }
  };

  const dateLocale = language === "vi" ? vi : enUS;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageCircle className="w-5 h-5" />
        {t.comments.title} ({comments.length})
      </h3>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t.comments.placeholder}
            rows={3}
            maxLength={MAX_COMMENT_LENGTH}
            disabled={isSubmitting}
          />
          {content.length > 0 && (
            <p className={`text-xs ${content.length > MAX_COMMENT_LENGTH * 0.9 ? 'text-destructive' : 'text-foreground-muted'}`}>
              {content.length}/{MAX_COMMENT_LENGTH}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting || !content.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t.common.loading}
              </>
            ) : (
              t.comments.submit
            )}
          </Button>
        </form>
      ) : (
        <div className="bg-surface-elevated rounded-lg p-4 text-center">
          <p className="text-foreground-secondary mb-3">{t.comments.loginToComment}</p>
          <Link to={getLoginUrl(location.pathname + location.search)}>
            <Button variant="outline">{t.nav.login}</Button>
          </Link>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-foreground-secondary py-8">
          {t.comments.noComments}
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const userInfo = userInfoCache[comment.user_id];
            
            return (
              <div
                key={comment.id}
                className="bg-surface-elevated rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      avatarUrl={userInfo?.avatarUrl}
                      displayName={userInfo?.displayName}
                      isCreator={userInfo?.isCreator}
                      size="sm"
                      showBadge={false}
                    />
                    <div className="flex flex-col">
                      <UserDisplayName
                        displayName={userInfo?.displayName || "User"}
                        isCreator={userInfo?.isCreator}
                        className="text-sm font-medium"
                        badgeClassName="h-3.5 w-3.5"
                      />
                      <span className="text-xs text-foreground-muted">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </span>
                    </div>
                  </div>
                  {user?.id === comment.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                      className="text-foreground-muted hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-foreground pl-10">{comment.content}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
