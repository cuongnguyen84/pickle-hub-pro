import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";

/**
 * Loud Log-Match call-to-action that lives at the top of the home page
 * for authed users. Two states:
 *
 *   1. Not DUPR-connected → big "Connect DUPR + Log match" path,
 *      explains the flow up front so the user understands why we want
 *      the link.
 *   2. Connected → straight-to-the-point "Log a match" CTA with the
 *      DUPR-rating callout next to it.
 *
 * Renders nothing for anonymous visitors — the home page already has
 * its own marketing hero for them.
 *
 * 2026-05-26 mobile fix: rebuilt the 2-column layout with Tailwind
 * responsive utilities so on narrow screens the CTA stacks BELOW the
 * headline (full-width, centered) instead of fighting for horizontal
 * space. Title clamp lowered (28px min) and chips wrap cleanly.
 */
export function HomeLogMatchCTA() {
  const { language } = useI18n();
  const { user, loading } = useAuth();
  const { data: conn, isLoading: connLoading } = useDuprConnection();
  const vi = language === "vi";

  if (loading || connLoading) return null;
  if (!user) return null;

  const connected = !!conn?.ssoConnected;

  return (
    <section
      aria-label={vi ? "Log trận đấu" : "Log a match"}
      style={{
        background: "var(--tl-bg)",
        borderTop: "1px solid var(--tl-border)",
        borderBottom: "1px solid var(--tl-border)",
      }}
    >
      <div
        className="tl-shell grid grid-cols-1 md:grid-cols-[1fr_auto] items-stretch md:items-end gap-6 md:gap-8 px-4 md:px-0 py-8 md:py-12"
      >
        {/* Headline + explainer */}
        <div>
          <div
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--tl-green)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--tl-green)",
                boxShadow: "0 0 12px rgba(163, 230, 53, 0.5)",
              }}
            />
            <span>{vi ? "Sân chính · sau trận đấu" : "Center court · after the match"}</span>
          </div>

          <h2
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              // Mobile-friendly clamp: down to 28px so 3-word headline
              // doesn't break into ugly wrapping like "Vừa thi đấu /
              // xong? / Log trận / đấu." on narrow viewports.
              fontSize: "clamp(28px, 8vw, 72px)",
              lineHeight: 1.0,
              letterSpacing: "-0.025em",
              margin: "0 0 14px",
              color: "var(--tl-fg)",
            }}
          >
            {vi ? (
              <>
                Vừa thi đấu xong?{" "}
                <span style={{ fontStyle: "normal", color: "var(--tl-green)" }}>
                  Log trận đấu.
                </span>
              </>
            ) : (
              <>
                Just played?{" "}
                <span style={{ fontStyle: "normal", color: "var(--tl-green)" }}>
                  Log it.
                </span>
              </>
            )}
          </h2>

          <p
            style={{
              margin: 0,
              maxWidth: "56ch",
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--tl-fg-2)",
            }}
          >
            {vi
              ? "Nhập tỉ số, đối thủ xác nhận, club admin duyệt — trận đấu được gửi lên DUPR để chấm rating chính thức. Mất 15 giây."
              : "Enter the score, your opponent confirms, the club admin approves — the match is pushed to DUPR for official rating. Takes 15 seconds."}
          </p>

          {/* Flow chips — hidden on mobile to save vertical space.
              The 4-step flow with arrows takes ~3 lines on mobile and
              repeats info already in the explainer paragraph above. */}
          <div
            className="hidden md:flex"
            style={{
              gap: 8,
              marginTop: 20,
              flexWrap: "wrap",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--tl-fg-3)",
            }}
          >
            <FlowChip label={vi ? "Anh nhập tỉ số" : "You enter score"} />
            <span style={{ color: "var(--tl-fg-4)", alignSelf: "center" }}>→</span>
            <FlowChip label={vi ? "Đối thủ xác nhận" : "Opponent confirms"} />
            <span style={{ color: "var(--tl-fg-4)", alignSelf: "center" }}>→</span>
            <FlowChip label={vi ? "Admin duyệt + DUPR" : "Admin approves + DUPR"} />
            <span style={{ color: "var(--tl-fg-4)", alignSelf: "center" }}>→</span>
            <FlowChip label={vi ? "Rating cập nhật" : "Rating updates"} accent />
          </div>
        </div>

        {/* CTA — connected vs not-yet.
            Mobile: full-width, items align to start (left).
            Desktop ≥768px: fixed 260px column, items align to end (right). */}
        <div className="flex flex-col items-stretch md:items-end gap-3 md:gap-3.5 w-full md:min-w-[260px]">
          {connected ? (
            <>
              <span
                className="self-start md:self-end"
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--tl-green)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--tl-green)",
                  }}
                />
                {vi ? "DUPR đã kết nối" : "DUPR connected"}
                {conn?.duprId && (
                  <span style={{ color: "var(--tl-fg-3)", marginLeft: 4 }}>·  {conn.duprId}</span>
                )}
              </span>
              <Link
                to="/match/new"
                className="tl-btn primary w-full md:w-auto"
                style={{
                  padding: "16px 32px",
                  fontSize: 13,
                  minWidth: 0,
                  textAlign: "center",
                  justifyContent: "center",
                  letterSpacing: "0.16em",
                }}
              >
                + {vi ? "Log trận đấu" : "Log a match"}
              </Link>
              <Link
                to="/match"
                className="self-start md:self-end"
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--tl-fg-2)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--tl-fg-4)",
                  paddingBottom: 2,
                }}
              >
                {vi ? "Xem các trận đang chờ →" : "See pending matches →"}
              </Link>
            </>
          ) : (
            <>
              <span
                className="self-start md:self-end"
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--tl-amber)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--tl-amber)",
                  }}
                />
                {vi ? "Cần kết nối DUPR trước" : "Connect DUPR first"}
              </span>
              <Link
                to="/dupr"
                className="tl-btn primary w-full md:w-auto"
                style={{
                  padding: "16px 32px",
                  fontSize: 13,
                  minWidth: 0,
                  textAlign: "center",
                  justifyContent: "center",
                  letterSpacing: "0.16em",
                }}
              >
                {vi ? "Kết nối DUPR — 30s" : "Connect DUPR — 30s"}
              </Link>
              <span
                className="self-start md:self-end md:text-right"
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--tl-fg-3)",
                  maxWidth: "32ch",
                  lineHeight: 1.55,
                }}
              >
                {vi
                  ? "Rồi anh có thể log trận đấu để DUPR chấm rating."
                  : "Then you can log matches and have DUPR rate them."}
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function FlowChip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      style={{
        padding: "5px 10px 4px",
        borderRadius: 2,
        border: "1px solid",
        borderColor: accent ? "var(--tl-green-dim)" : "var(--tl-border-strong)",
        color: accent ? "var(--tl-green)" : "var(--tl-fg-3)",
        background: accent ? "var(--tl-green-glow)" : "transparent",
      }}
    >
      {label}
    </span>
  );
}
