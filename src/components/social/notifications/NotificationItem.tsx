// ============================================================================
// NotificationItem — Sprint 2 Phase 3B.2
// Type-specific icon + title + body + time-ago + unread dot.
// ============================================================================

import { Bell, CheckCircle2, AlertTriangle, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVietnameseTimeAgo } from "@/lib/social";
import type { SocialNotification } from "@/hooks/social";

interface IconConf {
  Icon: typeof Bell;
  className: string;
}

const TYPE_ICON: Record<string, IconConf> = {
  match_confirm_needed: { Icon: Bell,         className: "text-yellow-600 dark:text-yellow-400" },
  match_verified:        { Icon: CheckCircle2, className: "text-blue-600 dark:text-blue-400" },
  match_disputed:        { Icon: AlertTriangle,className: "text-destructive" },
  kudos_received:        { Icon: Heart,        className: "text-pink-600 dark:text-pink-400" },
  comment_received:      { Icon: MessageCircle,className: "text-social-primary" },
};

const DEFAULT_ICON: IconConf = { Icon: Bell, className: "text-muted-foreground" };

interface NotificationItemProps {
  notification: SocialNotification;
  onClick: () => void;
}

export const NotificationItem = ({ notification, onClick }: NotificationItemProps) => {
  const conf = TYPE_ICON[notification.type] ?? DEFAULT_ICON;
  const { Icon } = conf;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
        "hover:bg-accent",
        !notification.is_read && "bg-social-primary/5",
      )}
      aria-label={notification.title}
    >
      <div className={cn("mt-0.5 shrink-0", conf.className)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("text-sm leading-tight", !notification.is_read && "font-semibold")}>
            {notification.title}
          </div>
          {!notification.is_read && (
            <span
              aria-label="Chưa đọc"
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-social-primary"
            />
          )}
        </div>
        {notification.body && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </div>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatVietnameseTimeAgo(notification.created_at)}
        </div>
      </div>
    </button>
  );
};

export default NotificationItem;
