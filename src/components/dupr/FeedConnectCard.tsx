import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { DuprConnectButton } from "./DuprConnectButton";

/**
 * Editorial-styled "first card" on /feed that prompts unconnected users
 * to link DUPR. Inserted above the timeline only when the viewer is
 * authenticated AND not yet connected. Disappears once connected.
 *
 * Differs from ConnectDuprBanner (slim top-of-page strip) by carrying
 * the full pitch — rationale + CTA + secondary hint. The two are
 * complementary: the banner reminds, the card explains.
 */
export function FeedConnectCard() {
  const { user, loading } = useAuth();
  const { language } = useI18n();
  const { data: conn, isLoading: connLoading } = useDuprConnection();
  const vi = language === "vi";

  if (loading || connLoading) return null;
  if (!user) return null;
  if (conn?.ssoConnected) return null;

  return (
    <section
      aria-label={vi ? "Kết nối DUPR" : "Connect DUPR"}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 48,
        alignItems: "end",
        padding: "48px 0",
        borderBottom: "1px solid var(--tl-border)",
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            fontSize: "clamp(36px, 5vw, 56px)",
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            margin: "0 0 16px",
            color: "var(--tl-fg)",
          }}
        >
          {vi ? (
            <>
              <em>Rating của anh,</em>
              <br />
              vẽ{" "}
              <span style={{ fontStyle: "normal", color: "var(--tl-green)" }}>
                chính xác.
              </span>
            </>
          ) : (
            <>
              <em>Your rating,</em>
              <br />
              drawn{" "}
              <span style={{ fontStyle: "normal", color: "var(--tl-green)" }}>
                precisely.
              </span>
            </>
          )}
        </h2>
        <p
          style={{
            margin: 0,
            maxWidth: "52ch",
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--tl-fg-2)",
          }}
        >
          {vi
            ? "Kết nối DUPR một lần — rating doubles/singles tự cập nhật sau mỗi trận, lịch sử trận đầy đủ, đủ điều kiện đăng ký giải đấu trên ThePickleHub."
            : "Connect DUPR once — your doubles/singles rating updates automatically after each match, full match history, and you become eligible to register for tournaments on ThePickleHub."}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--tl-fg-3)",
          }}
        >
          {vi ? "30 giây · không cần mật khẩu mới" : "30 sec · no new password"}
        </span>
        <DuprConnectButton
          label={vi ? "Kết nối với DUPR ↗" : "Connect with DUPR ↗"}
          variant="primary"
          style={{ minWidth: 240, justifyContent: "center" }}
        />
      </div>
    </section>
  );
}
