import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNotificationCount, useNotificationRealtime } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell = ({ className }: NotificationBellProps) => {
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(user?.id);
  const [hasNewNotification, setHasNewNotification] = useState(false);

  // Enable realtime subscription
  useNotificationRealtime(user?.id);

  // Animate when count increases
  useEffect(() => {
    if (unreadCount > 0) {
      setHasNewNotification(true);
      const timer = setTimeout(() => setHasNewNotification(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  if (!user) return null;

  return (
    <Link to="/notifications" className={className}>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative",
          hasNewNotification && "animate-bounce"
        )}
      >
        <Bell className={cn("w-5 h-5", hasNewNotification && "text-primary")} />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1 rounded-full",
              "bg-live text-foreground text-xs font-medium",
              hasNewNotification && "animate-pulse"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>
    </Link>
  );
};

export default NotificationBell;
