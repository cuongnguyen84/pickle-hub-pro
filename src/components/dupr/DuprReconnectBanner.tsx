import { AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { DuprConnectButton } from "./DuprConnectButton";

/**
 * Renders a banner prompting users who linked DUPR manually (pre-PR1) to
 * reconnect via official SSO so ratings auto-update via webhooks.
 *
 * Hides itself when:
 *   - User has no DUPR data at all
 *   - User is already SSO-connected
 *   - User loaded for the first time but query is still loading
 */
export function DuprReconnectBanner() {
  const { language } = useI18n();
  const { data, isLoading } = useDuprConnection();

  if (isLoading || !data) return null;
  if (!data.needsReconnect) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 16px",
        background: "var(--tl-yellow-soft, #fff7d6)",
        border: "1px solid var(--tl-yellow, #f0c850)",
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      <AlertCircle
        size={20}
        style={{ color: "var(--tl-yellow-fg, #8a6f00)", flexShrink: 0, marginTop: 2 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: "var(--tl-fg)" }}>
          {language === "vi"
            ? "Kết nối lại với DUPR để tự động cập nhật rating"
            : "Reconnect with DUPR to auto-update your rating"}
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--tl-fg-2)",
            margin: "0 0 12px",
            lineHeight: 1.45,
          }}
        >
          {language === "vi"
            ? "Rating hiện tại bạn nhập manual sẽ vẫn hiển thị, nhưng không tự động cập nhật khi DUPR thay đổi điểm của bạn. Đăng nhập qua DUPR để bật auto-sync."
            : "Your current manual rating still shows, but won't update automatically when DUPR recalculates. Sign in with DUPR to enable auto-sync."}
        </p>
        <DuprConnectButton variant="secondary" />
      </div>
    </div>
  );
}
