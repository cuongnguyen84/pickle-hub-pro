import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { NotificationList } from "@/components/notifications";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useMarkAllAsRead, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { CheckCheck } from "lucide-react";
import { Navigate } from "react-router-dom";

const Notifications = () => {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const markAllAsRead = useMarkAllAsRead();
  const { data: unreadCount = 0 } = useUnreadNotificationCount(user?.id);

  const handleMarkAllRead = () => {
    if (user) {
      markAllAsRead.mutate(user.id);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
            <div className="h-24 bg-muted rounded" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <MainLayout>
      <DynamicMeta title={t.notifications.title} noindex={true} />
      <div className="container-wide py-8 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">{t.notifications.title}</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-foreground-muted mt-1">
                {unreadCount} {t.notifications.unread}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllAsRead.isPending}
              className="gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              {t.notifications.markAllRead}
            </Button>
          )}
        </div>

        {/* Notification List */}
        <NotificationList />
      </div>
    </MainLayout>
  );
};

export default Notifications;
