import { useState, Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useDuprLink } from "@/hooks/onboarding/useDuprLink";
import type { OnboardingState } from "../OnboardingWizard";

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<{
    type: "SET_DUPR" | "GO_NEXT" | "GO_PREV";
    payload?: Partial<OnboardingState["dupr"]>;
  }>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid var(--tl-border)",
  borderRadius: 0,
  padding: "10px 0",
  fontSize: 18,
  fontFamily: "inherit",
  color: "var(--tl-fg)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "'Geist Mono', monospace",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-fg-3)",
  marginBottom: 8,
};

export function DuprLinkStep({ state, dispatch }: Props) {
  const { toast } = useToast();
  const { language } = useI18n();
  const { mutate: callDuprLink, loading: linkLoading } = useDuprLink();

  const [duprId, setDuprId] = useState(state.dupr.dupr_id);
  const [duprDoubles, setDuprDoubles] = useState<string>(
    state.dupr.dupr_doubles?.toString() ?? "",
  );
  const [duprSingles, setDuprSingles] = useState<string>(
    state.dupr.dupr_singles?.toString() ?? "",
  );
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const doublesNum = parseFloat(duprDoubles);
    if (!duprDoubles || Number.isNaN(doublesNum)) {
      setError(
        language === "vi"
          ? "Cần nhập điểm DUPR đôi (doubles) để lưu"
          : "Doubles DUPR rating is required",
      );
      return;
    }
    if (doublesNum < 2.0 || doublesNum > 7.0) {
      setError(
        language === "vi"
          ? "Điểm DUPR phải trong khoảng 2.0 - 7.0"
          : "DUPR rating must be between 2.0 and 7.0",
      );
      return;
    }
    let singlesNum: number | null = null;
    if (duprSingles.trim().length > 0) {
      singlesNum = parseFloat(duprSingles);
      if (Number.isNaN(singlesNum) || singlesNum < 2.0 || singlesNum > 7.0) {
        setError(
          language === "vi"
            ? "Điểm DUPR đơn (singles) phải trong khoảng 2.0 - 7.0"
            : "Singles DUPR must be between 2.0 and 7.0",
        );
        return;
      }
    }

    const trimmedId = duprId.trim();
    callDuprLink(
      {
        dupr_id: trimmedId.length > 0 ? trimmedId : null,
        dupr_doubles: doublesNum,
        dupr_singles: singlesNum,
        dupr_profile_url: null,
      },
      {
        onSuccess: (data) => {
          toast({
            title:
              language === "vi" ? "Đã lưu rating DUPR" : "DUPR rating saved",
          });
          advanceStep(
            {
              dupr_id: data.dupr_id ?? "",
              dupr_doubles: data.dupr_doubles,
              dupr_singles: data.dupr_singles,
              saved: true,
            },
            false,
          );
        },
        onError: (err) => {
          const fallbackErr =
            language === "vi" ? "Lỗi không xác định" : "Unexpected error";
          const errMsg = err.message ?? fallbackErr;
          if (err.code === "rate_limited") {
            setError(
              language === "vi"
                ? "Đang xử lý, vui lòng đợi 60 giây."
                : "Processing, please wait 60 seconds.",
            );
          } else if (err.code === "validation_failed") {
            setError(
              `${language === "vi" ? "Tỷ số không hợp lệ" : "Invalid rating"}: ${err.details?.join(", ") ?? errMsg}`,
            );
          } else {
            setError(errMsg);
          }
        },
      },
    );
  };

  const handleSkip = () => {
    advanceStep(
      { dupr_id: "", dupr_singles: null, dupr_doubles: null, saved: false },
      true,
    );
  };

  const submitting = linkLoading || advancing;

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
        {language === "vi" ? "Liên kết " : "Link "}
        <span style={{ fontStyle: "normal" }}>DUPR.</span>
      </h2>
      <p style={{ fontSize: 16, color: "var(--tl-fg-2)", margin: "0 0 8px", lineHeight: 1.55 }}>
        {language === "vi"
          ? "Tự nhập rating để cộng đồng biết level của bạn."
          : "Enter your rating so the community knows your level."}
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
          ? "◆ Auto-sync DUPR sắp ra mắt — hiện tại nhập manual."
          : "◆ DUPR auto-sync coming soon — manual entry for now."}
      </p>

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 24 }}>
          <label htmlFor="dupr_doubles" style={labelStyle}>
            {language === "vi" ? "Điểm DUPR Doubles" : "DUPR Doubles rating"}{" "}
            <span style={{ color: "var(--tl-green)" }}>*</span>
          </label>
          <input
            id="dupr_doubles"
            type="number"
            step="0.01"
            min="2.0"
            max="7.0"
            inputMode="decimal"
            value={duprDoubles}
            onChange={(e) => setDuprDoubles(e.target.value)}
            placeholder="VD: 4.20"
            disabled={submitting}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="dupr_singles" style={labelStyle}>
            {language === "vi"
              ? "Điểm DUPR Singles (tùy chọn)"
              : "DUPR Singles rating (optional)"}
          </label>
          <input
            id="dupr_singles"
            type="number"
            step="0.01"
            min="2.0"
            max="7.0"
            inputMode="decimal"
            value={duprSingles}
            onChange={(e) => setDuprSingles(e.target.value)}
            placeholder="VD: 4.05"
            disabled={submitting}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label htmlFor="dupr_id" style={labelStyle}>
            {language === "vi" ? "DUPR ID (tùy chọn)" : "DUPR ID (optional)"}
          </label>
          <input
            id="dupr_id"
            type="text"
            value={duprId}
            onChange={(e) => setDuprId(e.target.value)}
            placeholder={language === "vi" ? "VD: V6Y5XP" : "e.g., V6Y5XP"}
            disabled={submitting}
            style={inputStyle}
          />
          <p
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              fontSize: 14,
              color: "var(--tl-fg-3)",
              marginTop: 8,
            }}
          >
            {language === "vi"
              ? "Tìm trong URL DUPR profile của bạn."
              : "Find this in your DUPR profile URL."}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              fontFamily: "'Instrument Serif', serif",
              fontStyle: "italic",
              color: "var(--tl-red, #ef4444)",
              fontSize: 16,
              margin: "0 0 16px",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="tl-btn primary"
          disabled={submitting}
          style={{ width: "100%", marginBottom: 8 }}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {language === "vi" ? "Lưu rating" : "Save rating"}
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={handleSkip}
          disabled={submitting}
          style={{
            width: "100%",
            border: "none",
            fontStyle: "italic",
            fontFamily: "'Instrument Serif', serif",
            fontSize: 16,
          }}
        >
          {language === "vi" ? "Bỏ qua bước này" : "Skip this step"}
        </button>
      </form>
    </section>
  );
}
