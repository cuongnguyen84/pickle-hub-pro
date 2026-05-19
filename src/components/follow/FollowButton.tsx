import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Heart, HeartOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useFollow, useToggleFollow } from "@/hooks/useFollowData";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getLoginUrl } from "@/lib/auth-config";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface FollowButtonProps {
  targetType: "organization" | "tournament";
  targetId: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export const FollowButton = ({
  targetType,
  targetId,
  variant = "outline",
  size = "sm",
  className,
}: FollowButtonProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOptimistic, setIsOptimistic] = useState<boolean | null>(null);
  // Push permission is now requested automatically on app start

  const { data: isFollowing, isLoading } = useFollow(targetType, targetId, user?.id);
  const toggleFollow = useToggleFollow();

  const displayFollowing = isOptimistic ?? isFollowing ?? false;

  const handleClick = async () => {
    if (!user) {
      toast.info(t.auth.loginRequired);
      navigate(getLoginUrl(location.pathname + location.search));
      return;
    }

    // Optimistic update
    setIsOptimistic(!displayFollowing);

    try {
      await toggleFollow.mutateAsync({
        targetType,
        targetId,
        userId: user.id,
        isCurrentlyFollowing: displayFollowing,
      });

      // Push permission is now requested automatically on app start
    } catch (error) {
      // Revert optimistic update on error
      setIsOptimistic(null);
      toast.error(t.common.error);
    } finally {
      setIsOptimistic(null);
    }
  };

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled className={className}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={displayFollowing ? "default" : variant}
      size={size}
      onClick={handleClick}
      disabled={toggleFollow.isPending}
      className={cn(
        "gap-1.5 transition-all",
        displayFollowing && "bg-primary text-primary-foreground",
        className
      )}
    >
      {displayFollowing ? (
        <>
          <HeartOff className="w-4 h-4" />
          <span className="hidden sm:inline">{t.follow.following}</span>
        </>
      ) : (
        <>
          <Heart className="w-4 h-4" />
          <span className="hidden sm:inline">{t.follow.follow}</span>
        </>
      )}
    </Button>
  );
};

export default FollowButton;
