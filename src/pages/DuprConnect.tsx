// ============================================================================
// /dupr — DUPR connection status (user-facing)
// ----------------------------------------------------------------------------
// Simple page showing the user their DUPR connection state + rating, with
// connect / disconnect actions. No technical jargon — operator-grade
// tooling lives at /admin/dupr (admin role only).
// ============================================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ExternalLink, CheckCircle2, Plug } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useDuprConnection } from "@/hooks/useDuprConnection";
import { useDuprRatingHistory } from "@/hooks/social/useDuprRatingHistory";
import { DuprSsoModal, type DuprSsoResult } from "@/components/dupr/DuprSsoModal";
import { DuprRatingChart } from "@/components/social/player/DuprRatingChart";

export default function DuprConnect() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useI18n();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const vi = language === "vi";

  const { data: conn, isLoading, refetch } = useDuprConnection();
  // 30-day rating history for the connected user. Hook is cheap (RLS
  // public-read on dupr_rating_history) and returns [] until profile id
  // resolves, so it's safe to call unconditionally.
  const { data: history = [], isLoading: historyLoading } =
    useDuprRatingHistory(user?.id, 30);
  const [ssoOpen, setSsoOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm(vi ? "Ngắt kết nối DUPR?" : "Disconnect from DUPR?")) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("dupr-disconnect", { body: {} });
      if (error) throw error;
      toast({ title: vi ? "Đã ngắt kết nối" : "Disconnected" });
      qc.invalidateQueries({ queryKey: ["dupr-connection"] });
      qc.invalidateQueries({ queryKey: ["dupr"], exact: false });
    } catch (e) {
      toast({
        variant: "destructive",
        title: vi ? "Lỗi" : "Disconnect failed",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (authLoading) {
    return (
      <TheLineLayout>
        <div className="mx-auto max-w-2xl p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        </div>
      </TheLineLayout>
    );
  }

  if (!user) {
    return (
      <TheLineLayout>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <h1 className="text-2xl font-semibold mb-3">
            {vi ? "Cần đăng nhập" : "Sign in required"}
          </h1>
          <p style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Anh đăng nhập ThePickleHub rồi quay lại trang này để kết nối DUPR."
              : "Sign in to ThePickleHub, then come back to connect DUPR."}
          </p>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <h1
            className="text-3xl font-semibold mb-2"
            style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic" }}
          >
            DUPR
          </h1>
          <p style={{ color: "var(--tl-fg-3)" }}>
            {vi
              ? "Kết nối tài khoản DUPR của anh để rating tự đồng bộ và trận đấu được ghi nhận chính thức."
              : "Connect your DUPR account so your rating syncs automatically and your matches count officially."}
          </p>
        </header>

        {isLoading ? (
          <div className="rounded-md border p-6 text-center"
               style={{ borderColor: "var(--tl-border)" }}>
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : conn?.ssoConnected ? (
          // ─── Connected state ────────────────────────────────────────────
          <div className="rounded-md border p-5"
               style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.05)" }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5" style={{ color: "rgb(34,197,94)" }} />
              <span className="font-semibold">
                {vi ? "Đã kết nối DUPR" : "Connected to DUPR"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded border p-3"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--tl-fg-3)" }}>
                  {vi ? "Điểm đơn" : "Singles"}
                </div>
                <div className="text-2xl font-semibold font-mono">
                  {conn.singles != null ? conn.singles.toFixed(2) : "—"}
                </div>
              </div>
              <div className="rounded border p-3"
                   style={{ borderColor: "var(--tl-border)", background: "var(--tl-bg)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--tl-fg-3)" }}>
                  {vi ? "Điểm đôi" : "Doubles"}
                </div>
                <div className="text-2xl font-semibold font-mono">
                  {conn.doubles != null ? conn.doubles.toFixed(2) : "—"}
                </div>
              </div>
            </div>

            <div className="text-xs mb-4" style={{ color: "var(--tl-fg-3)" }}>
              {vi ? "DUPR ID" : "DUPR ID"}: <span className="font-mono">{conn.duprId}</span>
              {conn.connectedAt && (
                <>
                  {" · "}
                  {vi ? "Kết nối lúc" : "Connected"}: {new Date(conn.connectedAt).toLocaleDateString()}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="tl-btn"
                onClick={() => navigate("/match/new")}
              >
                {vi ? "Log trận mới →" : "Log a match →"}
              </button>
              {conn.duprProfileUrl && (
                <a
                  href={conn.duprProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="tl-btn inline-flex items-center gap-1"
                >
                  {vi ? "Xem trên DUPR" : "View on DUPR"} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                className="tl-btn"
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ color: "rgb(239,68,68)" }}
              >
                {disconnecting && <Loader2 className="h-3 w-3 animate-spin" />}
                {vi ? "Ngắt kết nối" : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          // ─── Not connected state ────────────────────────────────────────
          <div className="rounded-md border p-5"
               style={{ borderColor: "var(--tl-border)" }}>
            <h2 className="text-lg font-semibold mb-2">
              {vi ? "Chưa kết nối DUPR" : "DUPR not connected"}
            </h2>
            <p className="mb-4" style={{ color: "var(--tl-fg-3)" }}>
              {vi
                ? "Bấm nút bên dưới để đăng nhập DUPR. Một lần là xong, rating sẽ tự cập nhật mỗi khi anh chơi xong trận."
                : "Sign in with DUPR below. One-time setup — your rating will auto-update each time you play."}
            </p>

            <button
              type="button"
              className="tl-btn primary inline-flex items-center gap-2"
              onClick={() => setSsoOpen(true)}
            >
              <Plug className="h-4 w-4" />
              {vi ? "Kết nối DUPR" : "Connect DUPR"}
            </button>

            <p className="mt-4 text-xs" style={{ color: "var(--tl-fg-3)" }}>
              {vi
                ? "Chưa có tài khoản DUPR? "
                : "Don't have a DUPR account yet? "}
              <a
                href="https://dupr.com/register"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {vi ? "Đăng ký miễn phí" : "Sign up free"} <ExternalLink className="inline h-3 w-3" />
              </a>
            </p>
          </div>
        )}

        {/* Rating history chart — only shown when SSO-connected and we
            have at least 2 snapshots. The chart component handles its
            own loading + empty-state messaging via the section eyebrow,
            so we can mount it unconditionally as long as the user is
            connected. */}
        {conn?.ssoConnected && (
          <div className="mt-6">
            <DuprRatingChart history={history} loading={historyLoading} />
          </div>
        )}

        <DuprSsoModal
          open={ssoOpen}
          onClose={() => setSsoOpen(false)}
          onSuccess={() => {
            setSsoOpen(false);
            toast({ title: vi ? "Đã kết nối DUPR" : "DUPR connected" });
            qc.invalidateQueries({ queryKey: ["dupr-connection"] });
            qc.invalidateQueries({ queryKey: ["dupr"], exact: false });
            refetch();
          }}
          onError={(msg) => {
            toast({
              variant: "destructive",
              title: vi ? "Lỗi kết nối" : "Connection failed",
              description: msg,
            });
          }}
        />
      </div>
    </TheLineLayout>
  );
}
