import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

// Environment toggle — set VITE_DUPR_ENV=prod to switch to dashboard.dupr.com.
// Default is UAT so dev builds always exercise the test sandbox.
const DUPR_ENV =
  (import.meta.env.VITE_DUPR_ENV as "uat" | "prod" | undefined) ?? "uat";

const DUPR_SSO_ORIGIN =
  DUPR_ENV === "prod" ? "https://dashboard.dupr.com" : "https://uat.dupr.gg";

const DUPR_CLIENT_KEY = import.meta.env.VITE_DUPR_CLIENT_KEY as string | undefined;

/** Shape DUPR JS emits to the parent window when SSO succeeds. */
interface DuprSsoMessage {
  userToken?: string;
  refreshToken?: string;
  id?: string | number;
  duprId?: string;
  stats?: { singles?: number | string | null; doubles?: number | string | null } | null;
}

export interface DuprSsoResult {
  dupr_id: string;
  dupr_user_id: string;
  display_name: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
  dupr_profile_url: string;
  connected_via: "sso";
  synced_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: DuprSsoResult) => void;
  onError?: (message: string) => void;
}

function isDuprSsoMessage(v: unknown): v is DuprSsoMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.userToken === "string" &&
    typeof m.refreshToken === "string" &&
    typeof m.duprId === "string"
  );
}

export function DuprSsoModal({ open, onClose, onSuccess, onError }: Props) {
  const { language } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const clientKeyEncoded = DUPR_CLIENT_KEY ? btoa(DUPR_CLIENT_KEY) : "";
  const iframeSrc = clientKeyEncoded
    ? `${DUPR_SSO_ORIGIN}/login-external-app/${clientKeyEncoded}`
    : "";

  useEffect(() => {
    if (!open) return;

    const handler = async (event: MessageEvent) => {
      if (event.origin !== DUPR_SSO_ORIGIN) return;
      if (!isDuprSsoMessage(event.data)) return;

      setSubmitting(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke<
          DuprSsoResult | { error: string; code?: string }
        >("dupr-sso-callback", {
          body: {
            userToken: event.data.userToken,
            refreshToken: event.data.refreshToken,
            id: event.data.id,
            duprId: event.data.duprId,
            stats: event.data.stats ?? null,
          },
        });

        if (invokeError) {
          // supabase-js v2 wraps non-2xx responses as FunctionsHttpError
          // with the upstream Response on error.context. The default
          // .message is the useless "Edge Function returned a non-2xx
          // status code" — pull the actual server-side reason instead.
          const ctx = (invokeError as { context?: Response }).context;
          let detail = invokeError.message ?? "callback_failed";
          if (ctx) {
            try {
              const body = await ctx.clone().json();
              detail = body.error ?? body.code ?? detail;
              if (body.details?.hint) detail = `${detail} — ${body.details.hint}`;
            } catch { /* keep default */ }
          }
          throw new Error(detail);
        }
        if (data && "error" in data) {
          throw new Error(data.error);
        }
        onSuccess(data as DuprSsoResult);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "callback_failed";
        setError(msg);
        onError?.(msg);
      } finally {
        setSubmitting(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [open, onSuccess, onError]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  // ─── ROOT-CAUSE FIX ────────────────────────────────────────────────
  // .tl-nav (TheLineLayout sticky header) has `backdrop-filter: blur(...)`.
  // Per CSS spec, any ancestor with backdrop-filter / filter / transform
  // creates a containing block for `position: fixed` descendants — so
  // when DuprSsoModal was mounted as a descendant of HeaderDuprBadge
  // (inside .tl-nav), `position: fixed; inset: 0` no longer escaped to
  // the viewport. It anchored to the ~60px-tall nav bar, leaving the
  // iframe with 0 visible height. Same component, same CSS — only the
  // mount location changed (header vs body).
  //
  // Portaling to document.body sidesteps every parent-scoped containing
  // block: the modal becomes a direct child of <body>, so `position:
  // fixed` always anchors to the viewport regardless of where the
  // <DuprSsoModal> JSX was rendered from.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={language === "vi" ? "Đăng nhập DUPR" : "Sign in with DUPR"}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#fff",
          borderRadius: 12,
          width: "min(560px, calc(100vw - 16px))",
          bottom: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fafafa",
            flex: "0 0 auto",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
            {language === "vi" ? "Kết nối DUPR" : "Connect DUPR"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "vi" ? "Đóng" : "Close"}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
              borderRadius: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {!clientKeyEncoded && (
          <div style={{ padding: 32, textAlign: "center", color: "#ef4444" }}>
            {language === "vi"
              ? "Thiếu cấu hình VITE_DUPR_CLIENT_KEY."
              : "Missing VITE_DUPR_CLIENT_KEY environment variable."}
          </div>
        )}

        {clientKeyEncoded && (
          <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="DUPR SSO"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
              }}
              allow="clipboard-write"
              scrolling="auto"
            />
            {submitting && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(255,255,255,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <Loader2 size={28} className="animate-spin" />
                <span style={{ fontSize: 14, color: "#6b7280" }}>
                  {language === "vi"
                    ? "Đang kết nối với DUPR..."
                    : "Connecting to DUPR..."}
                </span>
              </div>
            )}
            {error && (
              <div
                role="alert"
                style={{
                  position: "absolute",
                  left: 16,
                  right: 16,
                  bottom: 16,
                  padding: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  color: "#b91c1c",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
