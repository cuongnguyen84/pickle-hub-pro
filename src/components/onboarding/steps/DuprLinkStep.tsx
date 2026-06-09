import { useState, Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { DuprConnectButton } from "@/components/dupr/DuprConnectButton";
import type { DuprSsoResult } from "@/components/dupr/DuprSsoModal";
import type { OnboardingState, OnboardingAction } from "../OnboardingWizard";

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<OnboardingAction>;
}

export function DuprLinkStep({ state: _state, dispatch }: Props) {
  const { toast } = useToast();
  const { language } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const advanceStep = async (
    payload: Partial<OnboardingState["dupr"]>,
    skipped: boolean,
  ) => {
    setAdvancing(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("Not authenticated");
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ onboarding_step: 2 })
        .eq("id", userData.user.id);
      if (updateError) throw updateError;

      dispatch({ type: "SET_DUPR", payload: { ...payload, skipped } });
      dispatch({ type: "GO_NEXT" });
    } catch (err) {
      const fallback = language === "vi" ? "Lỗi" : "Error";
      const msg = err instanceof Error ? err.message : fallback;
      setError(msg);
      toast({
        variant: "destructive",
        title:
          language === "vi" ? "Không thể chuyển bước" : "Couldn't continue",
        description: msg,
      });
    } finally {
      setAdvancing(false);
    }
  };

  const handleConnected = (result: DuprSsoResult) => {
    advanceStep(
      {
        dupr_id: result.dupr_id,
        dupr_doubles: result.dupr_doubles,
        dupr_singles: result.dupr_singles,
        saved: true,
      },
      false,
    );
  };

  const handleSkip = () => {
    advanceStep(
      { dupr_id: "", dupr_singles: null, dupr_doubles: null, saved: false },
      true,
    );
  };

  return (
    <section aria-labelledby="step-2-heading">
      <h2
        id="step-2-heading"
        style={{
          fontFamily: "'Instrument Serif', serif",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "clamp(36px, 5vw, 56px)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: "var(--tl-fg)",
          margin: "0 0 12px",
        }}
      >
        {language === "vi" ? "Kết nối " : "Connect "}
        <span style={{ fontStyle: "normal" }}>DUPR.</span>
      </h2>
      <p style={{ fontSize: 16, color: "var(--tl-fg-2)", margin: "0 0 8px", lineHeight: 1.55 }}>
        {language === "vi"
          ? "Đăng nhập DUPR để rating của bạn hiển thị và tự động cập nhật."
          : "Sign in with DUPR so your rating shows and stays up-to-date automatically."}
      </p>
      <p
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--tl-fg-4)",
          margin: "0 0 32px",
        }}
      >
        {language === "vi"
          ? "◆ Kết nối qua DUPR chính thức — rating tự động sync."
          : "◆ Official DUPR integration — rating auto-syncs."}
      </p>

      <DuprConnectButton
        onConnected={handleConnected}
        disabled={advancing}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <button
        type="button"
        className="tl-btn"
        onClick={handleSkip}
        disabled={advancing}
        style={{
          width: "100%",
          border: "none",
          fontStyle: "italic",
          fontFamily: "'Instrument Serif', serif",
          fontSize: 16,
        }}
      >
        {advancing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {language === "vi" ? "Bỏ qua bước này" : "Skip this step"}
      </button>

      {error && (
        <p
          role="alert"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            color: "var(--tl-red, #ef4444)",
            fontSize: 16,
            margin: "16px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
