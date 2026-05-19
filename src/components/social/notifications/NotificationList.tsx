// ============================================================================
// NotificationList — Sprint 2 Phase 3B.2 (unified)
// ----------------------------------------------------------------------------
// Top 10 of legacy + social merged + sorted DESC. Tap → mark read on the
// CORRECT table (via source) + navigate.
// ============================================================================

import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUnifiedNotifications,
  useUnifiedUnreadCount,
  useMarkUnifiedAsRead,
  useMarkAllUnifiedAsRead,
} from "@/hooks/social";
import NotificationItem from "./NotificationItem";

interface NotificationListProps {
  onClose: () => void;
}

export const NotificationList = ({ onClose }: NotificationListProps) => {
  const navigate = useNavigate();
  const { data: items, isLoading } = useUnifiedNotifications();
  const { data: unreadCount = 0 } = useUnifiedUnreadCount();
  const markRead = useMarkUnifiedAsRead();
  const markAll = useMarkAllUnifiedAsRead();

  const handleClick = (id: string, source: "legacy" | "social", link?: string | null) => {
    markRead.mutate({ id, source });
    if (link) navigate(link);
    onClose();
  };

  return (
    <div className="flex flex-col" data-testid="unified-notification-list">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">Thông báo</span>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            className="h-7 gap-1 px-2 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Đánh dấu đã đọc
          </Button>
        )}
      </div>
      <ScrollArea className="max-h-[60vh] sm:max-h-[400px]">
        {isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : items && items.length > 0 ? (
          <div className="divide-y">
            {items.map((n) => (
              <NotificationItem
                key={`${n.source}:${n.id}`}
                notification={n}
                onClick={() => handleClick(n.id, n.source, n.link_url)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Chưa có thông báo</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default NotificationList;
