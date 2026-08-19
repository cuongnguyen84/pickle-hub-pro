import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { DuprConnectButton } from "./DuprConnectButton";

/**
 * Slim sticky-feeling banner shown at the top of authed surfaces when
 * the user hasn't connected DUPR yet. One sentence, one CTA, dismissible
 * per-session.
 *
 * Reappears on the next sign-in / session so the connect prompt isn't
 * gone forever for users who tapped Close. Once connected, the banner
 * disappears for good (driven by useDuprConnection).
 */
const SESSION_KEY = "tph.dupr-banner-dismissed";
// CLS INC2 (proposal cls-attribution): the banner sits ABOVE {children} on
// every page, so late-mounting it after auth+conn resolve pushed the whole
// page down (~60-80px) on each navigation for signed-in unlinked users.
// Remember last decision per session: when it said "show", render the same
// markup invisible during loading so the slot is reserved from first paint.
// Ceiling: the very first impression of a session still shifts once —
// per-navigation shifts (the repeated case) go to zero.
const SHOWN_KEY = "tph.dupr-banner-shown";

export function ConnectDuprBanner() {
  const { user, loading } = useAuth();
  const { language } = useI18n();
  const { data: conn, isLoading: connLoading } = useDuprConnection();
  const vi = language === "vi";
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [expectBanner] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SHOWN_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch { /* ignore */ }
    }
  }, [dismissed]);

  const pending = loading || connLoading;
  const show = !pending && !dismissed && !!user && !conn?.ssoConnected;

  useEffect(() => {
    if (pending) return;
    try {
      sessionStorage.setItem(SHOWN_KEY, show ? "1" : "0");
    } catch { /* ignore */ }
  }, [pending, show]);

  if (pending ? !expectBanner : !show) return null;
  const reserving = pending && expectBanner;

  return (
    <div
      role="region"
      aria-label={vi ? "Lời mời kết nối DUPR" : "Connect DUPR prompt"}
      aria-hidden={reserving || undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: 16,
        alignItems: "center",
        padding: "12px 20px",
        background: "var(--tl-bg)",
        borderTop: "1px solid var(--tl-border)",
        borderBottom: "1px solid var(--tl-border)",
        // Reserved slot while auth/conn resolve — same markup, no paint.
        visibility: reserving ? "hidden" : undefined,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "1px solid var(--tl-green-dim)",
          color: "var(--tl-green)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        D
      </span>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.4,
          color: "var(--tl-fg-2)",
        }}
      >
        {vi ? (
          <>
            <strong style={{ color: "var(--tl-fg)" }}>Kết nối DUPR</strong>{" "}
            để xem rating chính thức và đẩy kết quả trận đấu lên DUPR.
          </>
        ) : (
          <>
            <strong style={{ color: "var(--tl-fg)" }}>Connect DUPR</strong>{" "}
            to see your official rating and push match results to DUPR.
          </>
        )}
      </p>
      <DuprConnectButton
        label={vi ? "Kết nối" : "Connect"}
        variant="primary"
      />
      <button
        type="button"
        aria-label={vi ? "Đóng" : "Dismiss"}
        onClick={() => setDismissed(true)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--tl-fg-3)",
          cursor: "pointer",
          padding: 6,
          display: "inline-flex",
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
