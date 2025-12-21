import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useComments } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { Link } from "react-router-dom";

interface CommentSectionProps {
  targetType: "video" | "livestream";
  targetId: string;
}

export function CommentSection({ targetType, targetId }: CommentSectionProps) {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: comments = [], isLoading } = useComments(targetType, targetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !content.trim()) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("comments").insert({
        target_type: targetType,
        target_id: targetId,
        user_id: user.id,
        content: content.trim(),
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
            disabled={isSubmitting}
          />
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
          <Link to="/login">
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
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-surface-elevated rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">U</span>
                  </div>
                  <span className="text-sm text-foreground-secondary">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
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
              <p className="text-foreground">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
