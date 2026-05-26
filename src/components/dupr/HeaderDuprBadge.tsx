// ============================================================================
// HeaderDuprBadge — header widget for DUPR connect/rating state
// ----------------------------------------------------------------------------
// Mounted in TheLineLayout next to the avatar. Two states:
//
//   - Not connected: green outline button "Kết nối DUPR" / "Connect DUPR"
//     → opens the SSO modal directly (no /dupr roundtrip).
//
//   - Connected: pill "DUPR 4.27 / 4.41" (singles/doubles). Clicking opens
//     /dupr so user can see profile + disconnect.
//
// Hides entirely for anonymous users (let TheLineLayout's sign-in CTA win).
// ============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plug } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { useI18n } from "@/i18n";
import { DuprSsoModal, type DuprSsoResult } from "./DuprSsoModal";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function HeaderDuprBadge() {
  const { user } = useAuth();
  const { language } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: conn, isLoading } = useDuprConnection();
  const vi = language === "vi";

  if (!user) return null;
  if (isLoading) {
    return (
      <span className="inline-flex items-center" style={{ color: "var(--tl-fg-3)", padding: "0 8px" }}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }

  // Connected → show rating pill
  if (conn?.ssoConnected) {
    const s = conn.singles != null ? conn.singles.toFixed(2) : "—";
    const d = conn.doubles != null ? conn.doubles.toFixed(2) : "—";
    return (
      <button
        type="button"
        onClick={() => navigate("/dupr")}
        title={vi ? "Xem hồ sơ DUPR của anh" : "View your DUPR profile"}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:opacity-80 transition-opacity"
        style={{
          borderColor: "rgba(34,197,94,0.4)",
          background: "rgba(34,197,94,0.08)",
          color: "rgb(34,197,94)",
          fontFamily: "'Geist Mono', monospace",
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ color: "var(--tl-fg-3)" }}>DUPR</span>
        <span>{s}</span>
        <span style={{ color: "var(--tl-fg-3)" }}>/</span>
        <span>{d}</span>
      </button>
    );
  }

  // Not connected → show Connect button
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={vi ? "Kết nối DUPR để rating tự đồng bộ" : "Connect DUPR to sync your rating"}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:opacity-80 transition-opacity"
        style={{
          borderColor: "rgba(34,197,94,0.5)",
          color: "rgb(34,197,94)",
          fontWeight: 500,
        }}
      >
        <Plug className="h-3 w-3" />
        {vi ? "Kết nối DUPR" : "Connect DUPR"}
      </button>

      <DuprSsoModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={(result: DuprSsoResult) => {
          setOpen(false);
          toast({
            title: vi ? "Đã kết nối DUPR" : "DUPR connected",
            description: result.dupr_singles != null
              ? `${vi ? "Singles" : "Singles"} ${result.dupr_singles.toFixed(2)}${result.dupr_doubles != null ? ` · Doubles ${result.dupr_doubles.toFixed(2)}` : ""}`
              : (vi ? "Sẵn sàng log match!" : "Ready to log matches!"),
          });
          qc.invalidateQueries({ queryKey: ["dupr-connection"] });
          qc.invalidateQueries({ queryKey: ["dupr"], exact: false });
        }}
        onError={(msg) => {
          toast({
            variant: "destructive",
            title: vi ? "Kết nối thất bại" : "Connection failed",
            description: msg,
          });
        }}
      />
    </>
  );
}
