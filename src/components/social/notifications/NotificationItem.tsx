// ============================================================================
// NotificationItem — Sprint 2 Phase 3B.2 (unified)
// ----------------------------------------------------------------------------
// Source-specific + type-specific icon + title + body + time-ago + unread dot.
// Consumes UnifiedNotification (legacy + social merged).
// ============================================================================

import { Bell, CheckCircle2, AlertTriangle, Heart, MessageCircle, Radio, Calendar, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVietnameseTimeAgo } from "@/lib/social";
import type { UnifiedNotification } from "@/hooks/social";

interface IconConf {
  Icon: typeof Bell;
  className: string;
}

// Source 'social' — match-related types
const SOCIAL_ICON: Record<string, IconConf> = {
  match_confirm_needed: { Icon: Bell,          className: "text-yellow-600 dark:text-yellow-400" },
  match_verified:        { Icon: CheckCircle2, className: "text-blue-600 dark:text-blue-400" },
  match_disputed:        { Icon: AlertTriangle,className: "text-destructive" },
  match_expired:         { Icon: Trophy,       className: "text-muted-foreground" },
  kudos_received:        { Icon: Heart,        className: "text-pink-600 dark:text-pink-400" },
  comment_received:      { Icon: MessageCircle,className: "text-social-primary" },
};

// Source 'legacy' — livestream / forum types
const LEGACY_ICON: Record<string, IconConf> = {
  livestream_live:       { Icon: Radio,        className: "text-destructive" },
  livestream_scheduled:  { Icon: Calendar,     className: "text-primary" },
  forum_reply:           { Icon: MessageCircle,className: "text-primary" },
};

const DEFAULT_ICON: IconConf = { Icon: Bell, className: "text-muted-foreground" };

function pickIcon(n: UnifiedNotification): IconConf {
  const map = n.source === "legacy" ? LEGACY_ICON : SOCIAL_ICON;
  return map[n.type] ?? DEFAULT_ICON;
}

interface NotificationItemProps {
  notification: UnifiedNotification;
  onClick: () => void;
}

export const NotificationItem = ({ notification, onClick }: NotificationItemProps) => {
  const conf = pickIcon(notification);
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
