import { Loader2, CheckCheck, Bell } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import {
  useUnifiedNotifications,
  useUnifiedUnreadCount,
  useMarkUnifiedAsRead,
  useMarkAllUnifiedAsRead,
  type UnifiedNotification,
} from "@/hooks/social";
import NotificationItem from "@/components/social/notifications/NotificationItem";
import { getLoginUrl } from "@/lib/auth-config";

/**
 * /thong-bao + /vi/thong-bao + /notifications + /vi/notifications
 *
 * Sprint 5 follow-up to PR #27. Replaces the legacy MainLayout +
 * legacy NotificationList implementation with TheLineLayout chrome
 * + the social_notifications source already in use by the bell.
 *
 * Renders the 10 most recent unified notifications (legacy
 * `notifications` + Sprint 1+ `social_notifications` merged behind
 * useUnifiedNotifications). Title rendering is bilingual via the
 * NotificationItem component (which calls resolveNotificationTitle
 * from PR #25).
 *
 * Realtime is mounted at the App.tsx root via
 * NotificationsRealtimeInitializer (PR #27 Codex P2 fix), so this
 * page's list auto-refreshes when new notifications arrive without
 * the page itself having to subscribe.
 *
 * Per CLAUDE.md memory directive (2026-05-10): TheLineLayout is the
 * default chrome for every user-facing page. No legacy MainLayout.
 */

const Notifications = () => {
  const { language } = useI18n();
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: items = [], isLoading: listLoading } = useUnifiedNotifications();
  const { data: unreadCount = 0 } = useUnifiedUnreadCount();
  const markRead = useMarkUnifiedAsRead();
  const markAll = useMarkAllUnifiedAsRead();

  const pageTitle = language === "vi" ? "Thông báo" : "Notifications";
  const pageDescription =
    language === "vi"
      ? "Theo dõi mới, kudo, bình luận và lời nhắc đến từ cộng đồng pickleball Việt Nam."
      : "New follows, kudos, comments, and mentions from the Vietnamese pickleball community.";

  // Auth gate. Loading guard prevents the redirect from firing during
  // the brief auth-loading window after a fresh tab open.
  if (loading) {
    return (
      <TheLineLayout title={pageTitle} description={pageDescription} noindex>
        <div className="tl-shell" style={{ paddingBottom: 56 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "120px 0",
            }}
          >
            <Loader2
              className="h-5 w-5 animate-spin"
              style={{ color: "var(--tl-fg-3)" }}
            />
          </div>
        </div>
      </TheLineLayout>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={getLoginUrl(location.pathname + location.search)}
        replace
      />
    );
  }

  const handleNotificationClick = (notification: UnifiedNotification) => {
    if (!notification.is_read) {
      markRead.mutate({ id: notification.id, source: notification.source });
    }
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  return (
    <TheLineLayout
      title={pageTitle}
      description={pageDescription}
      noindex
    >
      <div className="tl-shell" style={{ paddingBottom: 80 }}>
        {/* Page head — eyebrow + italic-serif headline */}
        <header className="tl-page-head" style={{ padding: "48px 0 28px" }}>
          <div className="tl-eyebrow" aria-hidden="true">
            <span className="pip" />
            <span>{language === "vi" ? "THÔNG BÁO" : "NOTIFICATIONS"}</span>
            {unreadCount > 0 && (
              <>
                <span className="sep">·</span>
                <span>
                  {unreadCount}{" "}
                  {language === "vi"
                    ? unreadCount === 1
                      ? "CHƯA ĐỌC"
                      : "CHƯA ĐỌC"
                    : unreadCount === 1
                      ? "UNREAD"
                      : "UNREAD"}
                </span>
              </>
            )}
          </div>
          <h1
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontSize: "clamp(48px, 7vw, 96px)",
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
              margin: "0 0 16px",
              color: "var(--tl-fg)",
            }}
          >
            {language === "vi" ? (
              <>
                <em>Cộng đồng</em>
                <br />
                <span style={{ color: "var(--tl-green)" }}>
                  <em>đang nói</em>.
                </span>
              </>
            ) : (
              <>
                <em>What the community</em>
                <br />
                <span style={{ color: "var(--tl-green)" }}>
                  <em>is saying</em>.
                </span>
              </>
            )}
          </h1>
          <p
            style={{
              fontSize: 16,
              color: "var(--tl-fg-2)",
              maxWidth: "56ch",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {language === "vi"
              ? "Theo dõi mới, kudo trên trận của bạn, bình luận và lời nhắc đến — tất cả ở một chỗ."
              : "New follows, kudos on your matches, comments, and mentions — all in one place."}
          </p>
        </header>

        {/* Sub-actions row — Mark all read */}
        {unreadCount > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 20,
              maxWidth: 720,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "transparent",
                border: "1px solid var(--tl-border)",
                borderRadius: 4,
                color: "var(--tl-fg-2)",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: markAll.isPending ? "default" : "pointer",
              }}
            >
              {markAll.isPending ? (
                <Loader2
                  className="animate-spin"
                  style={{ width: 13, height: 13 }}
                  aria-hidden="true"
                />
              ) : (
                <CheckCheck style={{ width: 13, height: 13 }} aria-hidden="true" />
              )}
              {language === "vi"
                ? "Đánh dấu tất cả đã đọc"
                : "Mark all as read"}
            </button>
          </div>
        )}

        {/* List */}
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            border: "1px solid var(--tl-border)",
            borderRadius: 4,
            background: "var(--tl-bg-2, transparent)",
            overflow: "hidden",
          }}
        >
          {listLoading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "64px 0",
              }}
            >
              <Loader2
                className="h-5 w-5 animate-spin"
                style={{ color: "var(--tl-fg-3)" }}
              />
            </div>
          ) : items.length === 0 ? (
            <NotificationsEmptyState language={language} />
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {items.map((n) => (
                <li
                  key={`${n.source}:${n.id}`}
                  style={{
                    borderBottom: "1px solid var(--tl-border)",
                  }}
                >
                  <NotificationItem
                    notification={n}
                    onClick={() => handleNotificationClick(n)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Foot — clarify that page shows 10 most recent (full pagination
            is Sprint 6+ work; the bell + this page share the same query
            with LIST_LIMIT=10). */}
        {items.length > 0 && (
          <p
            style={{
              maxWidth: 720,
              margin: "20px auto 0",
              textAlign: "center",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--tl-fg-3)",
            }}
          >
            {language === "vi"
              ? "Hiển thị 10 thông báo gần nhất"
              : "Showing 10 most recent"}
          </p>
        )}
      </div>
    </TheLineLayout>
  );
};

/* ─── Empty state ─────────────────────────────────────────────────────── */

function NotificationsEmptyState({
  language,
}: {
  language: "vi" | "en";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "80px 24px",
      }}
    >
      <Bell
        style={{
          width: 32,
          height: 32,
          color: "var(--tl-fg-4)",
          marginBottom: 16,
        }}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <h2
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 24,
          color: "var(--tl-fg)",
          margin: "0 0 8px",
        }}
      >
        {language === "vi"
          ? "Chưa có thông báo nào."
          : "Nothing here yet."}
      </h2>
      <p
        style={{
          fontSize: 14,
          color: "var(--tl-fg-3)",
          maxWidth: "44ch",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {language === "vi"
          ? "Khi có người theo dõi bạn, thích trận đấu hoặc bình luận của bạn — bạn sẽ thấy ở đây."
          : "You'll see follows, kudos on your matches, replies, and mentions land here as the community engages."}
      </p>
    </div>
  );
}

export default Notifications;
