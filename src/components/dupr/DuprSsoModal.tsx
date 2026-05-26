import { useEffect, useRef, useState } from "react";
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={language === "vi" ? "Đăng nhập DUPR" : "Sign in with DUPR"}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: 520,
          height: "min(780px, calc(100vh - 32px))",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header bar — no overlap with iframe content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fafafa",
            flexShrink: 0,
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
            onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
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
          <>
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="DUPR SSO"
              style={{ width: "100%", flex: 1, border: "none", minHeight: 0, display: "block" }}
              allow="clipboard-write"
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
                <span style={{ fontSize: 14, color: "var(--tl-fg-2)" }}>
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
                  padding: "12px 16px",
                  background: "var(--tl-red, #ef4444)",
                  color: "#fff",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
