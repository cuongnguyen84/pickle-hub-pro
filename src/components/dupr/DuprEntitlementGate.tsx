import type { ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { useI18n } from "@/i18n";
import { useDuprEntitlements } from "@/hooks/useDuprEntitlements";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { DuprConnectButton } from "./DuprConnectButton";

interface Props {
  /** Required entitlement. Default BASIC_L1 (baseline platform access). */
  required?: "BASIC_L1" | "PREMIUM_L1" | "VERIFIED_L1";
  /** DUPR resource. Default "tournaments" (only one in use today). */
  resource?: string;
  /** What to render when the user passes the gate. */
  children: ReactNode;
  /** Optional override for the not-connected / missing-entitlement UI. */
  fallback?: ReactNode;
}

/**
 * Wraps actions that require a DUPR entitlement (BASIC_L1 by default).
 *
 * Per DUPR RaaS spec: every platform action requires BASIC_L1 on the
 * `tournaments` resource. DUPR+ restricted tournaments require PREMIUM_L1.
 *
 * Behavior:
 * - Loading entitlements → spinner
 * - Not SSO-connected     → connect prompt
 * - Missing entitlement   → restricted banner (with DUPR profile link)
 * - All good              → render children
 */
export function DuprEntitlementGate({
  required = "BASIC_L1",
  resource = "tournaments",
  children,
  fallback,
}: Props) {
  const { language } = useI18n();
  const { data: conn, isLoading: connLoading } = useDuprConnection();
  const ent = useDuprEntitlements();
  const vi = language === "vi";

  if (connLoading || ent.loading) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: "var(--tl-fg-3)" }}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {vi ? "Đang kiểm tra DUPR…" : "Checking DUPR…"}
      </div>
    );
  }

  if (!conn?.ssoConnected) {
    if (fallback) return <>{fallback}</>;
    return (
      <div
        className="rounded-md border p-4 text-sm"
        style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg-2)" }}
      >
        <div className="mb-2 flex items-center gap-2 font-medium">
          <Lock className="h-4 w-4" />
          {vi
            ? "Cần kết nối DUPR để tiếp tục"
            : "DUPR connection required to continue"}
        </div>
        <p className="mb-3" style={{ color: "var(--tl-fg-3)" }}>
          {vi
            ? "ThePickleHub xác thực người chơi qua DUPR. Vui lòng kết nối tài khoản DUPR của bạn."
            : "ThePickleHub verifies players via DUPR. Please connect your DUPR account."}
        </p>
        <DuprConnectButton variant="secondary" />
      </div>
    );
  }

  if (!ent.has(required, resource)) {
    if (fallback) return <>{fallback}</>;
    const isBasic = required === "BASIC_L1";
    return (
      <div
        className="rounded-md border p-4 text-sm"
        style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg-2)" }}
      >
        <div className="mb-2 flex items-center gap-2 font-medium">
          <Lock className="h-4 w-4" />
          {vi
            ? isBasic
              ? "Tài khoản DUPR chưa có quyền cơ bản"
              : `Cần gói DUPR+ (${required})`
            : isBasic
              ? "DUPR account missing baseline access"
              : `DUPR+ subscription required (${required})`}
        </div>
        <p className="mb-3" style={{ color: "var(--tl-fg-3)" }}>
          {vi
            ? "Vui lòng kiểm tra hồ sơ DUPR của bạn hoặc liên hệ DUPR để biết thêm chi tiết."
            : "Please check your DUPR profile or contact DUPR for details."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {conn.duprProfileUrl && (
            <a
              href={conn.duprProfileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm underline"
            >
              {vi ? "Mở hồ sơ DUPR" : "Open DUPR profile"}
            </a>
          )}
          <button
            type="button"
            onClick={() => ent.refresh()}
            disabled={ent.refreshing}
            className="text-sm underline disabled:opacity-50"
          >
            {ent.refreshing
              ? vi ? "Đang làm mới…" : "Refreshing…"
              : vi ? "Làm mới" : "Refresh"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
