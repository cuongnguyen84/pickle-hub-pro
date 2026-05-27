// ============================================================================
// EventDuprLinkCard — registered-player DUPR connection card.
// ----------------------------------------------------------------------------
// Authenticated users connect DUPR qua SSO (DuprConnectButton →
// DuprSsoModal → dupr-sso-callback edge function). Connection lưu trên
// profiles.dupr_id + profiles.dupr_connected_via='sso'.
//
// list_social_event_matches RPC tự động fallback profiles.dupr_id khi
// event_registrations.dupr_id NULL, nên không cần copy thủ công vào
// registration. Card này chỉ làm 2 việc:
//   1. Hiển thị trạng thái kết nối hiện tại (đã connect → DUPR ID + rating).
//   2. Nút "Kết nối DUPR" mở SSO modal khi chưa connect.
//
// Guest path (magic_token, không auth): hiển thị hint "Đăng nhập để kết
// nối DUPR" — guest không thể SSO vì SSO callback đòi auth.uid().
// ============================================================================

import { Trophy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { DuprConnectButton } from "@/components/dupr/DuprConnectButton";

interface Props {
  eventId: string;
  /** Magic token from localStorage (guest path). */
  magicToken?: string | null;
  /** auth.uid() — when set, the SSO path is enabled. */
  authedProfileId?: string | null;
}

function formatRating(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

export function EventDuprLinkCard({ magicToken, authedProfileId }: Props) {
  const { t, language } = useI18n();
  const copy = t.socialEvents.eventDupr;

  const { data: conn, isLoading } = useDuprConnection();
  const isGuest = !authedProfileId && Boolean(magicToken);

  return (
    <Card className="p-5 mb-6">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Trophy className="h-4 w-4" style={{ color: "var(--tl-green, #16a34a)" }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
          {copy.linkHeading}
        </h3>
      </div>
      <p style={{ fontSize: 14, color: "var(--tl-fg-3)", marginBottom: 14 }}>
        {copy.linkBody}
      </p>

      {isGuest ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "var(--tl-surface, rgba(0,0,0,0.03))",
            border: "1px solid var(--tl-border)",
            fontSize: 13,
            color: "var(--tl-fg-2)",
            lineHeight: 1.5,
          }}
        >
          {language === "vi"
            ? "Vui lòng đăng nhập tài khoản ThePickleHub để kết nối DUPR. Đăng ký SĐT của anh sẽ tự động được liên kết với tài khoản sau khi đăng nhập."
            : "Sign in to your ThePickleHub account to connect DUPR. Your phone registration will be linked to the account automatically after sign-in."}
        </div>
      ) : isLoading ? (
        <div style={{ fontSize: 13, color: "var(--tl-fg-3)" }}>
          {t.common.loading}
        </div>
      ) : conn?.ssoConnected ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 8,
            background: "rgba(22, 163, 74, 0.08)",
            border: "1px solid rgba(22, 163, 74, 0.3)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Check className="h-4 w-4" style={{ color: "rgb(22, 163, 74)" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
                {copy.linkedAsLabel} (SSO)
              </div>
              <code
                style={{
                  fontSize: 14,
                  fontFamily: "'Geist Mono', monospace",
                  wordBreak: "break-all",
                }}
              >
                {conn.duprId}
              </code>
              {(formatRating(conn.singles) || formatRating(conn.doubles)) && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--tl-fg-3)",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {formatRating(conn.singles) && (
                    <span>S {formatRating(conn.singles)}</span>
                  )}
                  {formatRating(conn.singles) && formatRating(conn.doubles) && " · "}
                  {formatRating(conn.doubles) && (
                    <span>D {formatRating(conn.doubles)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          {conn.duprProfileUrl && (
            <a
              href={conn.duprProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tl-btn"
              style={{ fontSize: 12, padding: "5px 11px" }}
            >
              {language === "vi" ? "Xem DUPR ↗" : "View DUPR ↗"}
            </a>
          )}
        </div>
      ) : (
        <div>
          <DuprConnectButton
            label={language === "vi" ? "Kết nối DUPR" : "Connect DUPR"}
            variant="primary"
          />
          {conn?.needsReconnect && (
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--tl-orange, #d97706)",
                lineHeight: 1.5,
              }}
            >
              {language === "vi"
                ? "Anh đã có DUPR rating trên ThePickleHub trước đây. Kết nối lại để cập nhật chính thức từ DUPR."
                : "You had a DUPR rating on ThePickleHub previously. Reconnect to sync the official rating from DUPR."}
            </p>
          )}
        </div>
      )}

      <p
        style={{
          marginTop: 12,
          fontSize: 12,
          color: "var(--tl-fg-3)",
          lineHeight: 1.5,
        }}
      >
        {copy.privacyHint}
      </p>
    </Card>
  );
}
