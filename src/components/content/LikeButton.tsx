import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLikesCount, useUserLiked } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  targetType: "video" | "livestream";
  targetId: string;
  className?: string;
}

export function LikeButton({ targetType, targetId, className }: LikeButtonProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isToggling, setIsToggling] = useState(false);

  const { data: likesCount = 0 } = useLikesCount(targetType, targetId);
  const { data: userLiked = false } = useUserLiked(targetType, targetId, user?.id);

  const handleToggleLike = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: t.auth.loginRequired,
      });
      return;
    }

    setIsToggling(true);

    try {
      if (userLiked) {
        // Remove like
        await supabase
          .from("likes")
          .delete()
          .eq("target_type", targetType)
          .eq("target_id", targetId)
          .eq("user_id", user.id);
      } else {
        // Add like
        await supabase.from("likes").insert({
          target_type: targetType,
          target_id: targetId,
          user_id: user.id,
        });
      }

      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ["likes-count", targetType, targetId] });
      queryClient.invalidateQueries({ queryKey: ["user-liked", targetType, targetId, user.id] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t.common.error,
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggleLike}
      disabled={isToggling}
      className={cn("gap-2", className)}
    >
      <Heart
        className={cn(
          "w-5 h-5 transition-colors",
          userLiked ? "fill-red-500 text-red-500" : "text-foreground-secondary"
        )}
      />
      <span className="text-sm">{likesCount}</span>
    </Button>
  );
}
