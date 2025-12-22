import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
}

export const NotificationBell = ({ className }: NotificationBellProps) => {
  const { user } = useAuth();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(user?.id);

  if (!user) return null;

  return (
    <Link to="/notifications" className={className}>
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1 rounded-full",
              "bg-live text-foreground text-xs font-medium",
              "animate-pulse"
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
