import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { Radio, Calendar, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import {
  useNotifications,
  useMarkAsRead,
  useDeleteNotification,
  type Notification,
} from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/content";
import { cn } from "@/lib/utils";

export const NotificationList = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useNotifications(user?.id);
  const markAsRead = useMarkAsRead();
  const deleteNotification = useDeleteNotification();

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read && user) {
      markAsRead.mutate({ notificationId: notification.id, userId: user.id });
    }

    // Navigate to related content
    if (notification.related_id) {
      navigate(`/live/${notification.related_id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation();
    if (user) {
      deleteNotification.mutate({ notificationId: notification.id, userId: user.id });
    }
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "livestream_live":
        return <Radio className="w-5 h-5 text-live" />;
      case "livestream_scheduled":
        return <Calendar className="w-5 h-5 text-primary" />;
      default:
        return <Radio className="w-5 h-5" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 p-4 rounded-lg bg-background-surface">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title={t.notifications.noNotifications}
        description={t.notifications.noNotificationsDesc}
      />
    );
  }

  return (
    <div className="space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            "flex gap-3 p-4 rounded-lg cursor-pointer transition-colors",
            "border border-border-subtle hover:border-border",
            notification.is_read
              ? "bg-background-surface"
              : "bg-primary/5 border-primary/20"
          )}
        >
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            {getIcon(notification.type)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium line-clamp-2",
                notification.is_read ? "text-foreground" : "text-foreground"
              )}
            >
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-sm text-foreground-muted line-clamp-1 mt-0.5">
                {notification.message}
              </p>
            )}
            <p className="text-xs text-foreground-muted mt-1">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
                locale: language === "vi" ? vi : enUS,
              })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-start gap-1">
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground-muted hover:text-destructive"
              onClick={(e) => handleDelete(e, notification)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationList;
