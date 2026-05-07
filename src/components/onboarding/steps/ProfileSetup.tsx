import { useState, useEffect, Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  generateUsername,
  slugifyDisplayName,
} from "@/lib/social/username-generator";
import type { OnboardingState } from "../OnboardingWizard";

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<{
    type: "SET_PROFILE" | "GO_NEXT";
    payload?: Partial<OnboardingState["profile"]>;
  }>;
  userId: string;
}

const SKILL_LEVELS: Array<{
  num: string;
  value: "beginner" | "intermediate" | "advanced" | "pro";
  label: string;
  description: string;
}> = [
  { num: "01", value: "beginner", label: "NGƯỜI MỚI", description: "Mới bắt đầu, đang học" },
  { num: "02", value: "intermediate", label: "TRUNG BÌNH", description: "Đã chơi 3-12 tháng" },
  { num: "03", value: "advanced", label: "KHÁ", description: "1+ năm, tham gia giải địa phương" },
  { num: "04", value: "pro", label: "CHUYÊN NGHIỆP", description: "Top 100 VN hoặc tournament regular" },
];

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

export function ProfileSetup({ state, dispatch, userId }: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernamePreview, setUsernamePreview] = useState<string>("");

  useEffect(() => {
    const slug = slugifyDisplayName(state.profile.display_name);
    setUsernamePreview(slug || "");
  }, [state.profile.display_name]);

  const handleDisplayNameChange = (value: string) => {
    dispatch({
      type: "SET_PROFILE",
      payload: { display_name: value },
    });
  };

  const handleSkillSelect = (
    value: OnboardingState["profile"]["skill_level"],
  ) => {
    dispatch({
      type: "SET_PROFILE",
      payload: { skill_level: value },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const displayName = state.profile.display_name.trim();
    if (displayName.length < 2) {
      setError("Tên hiển thị tối thiểu 2 ký tự");
      return;
    }
    if (displayName.length > 50) {
      setError("Tên hiển thị tối đa 50 ký tự");
      return;
    }
    if (!state.profile.skill_level) {
      setError("Vui lòng chọn trình độ");
      return;
    }

    setSubmitting(true);
    try {
      const username = await generateUsername(displayName, {
        isAvailable: async (candidate) => {
          const { data, error: lookupError } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", candidate)
            .maybeSingle();
          if (lookupError) throw lookupError;
          return data === null;
        },
      });

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          username,
          skill_level: state.profile.skill_level,
          onboarding_step: 1,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      dispatch({
        type: "SET_PROFILE",
        payload: { display_name: displayName, username },
      });
      dispatch({ type: "GO_NEXT" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(msg);
      toast({
        variant: "destructive",
        title: "Lưu hồ sơ thất bại",
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="step-1-heading">
      <h2
        id="step-1-heading"
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
        Bắt đầu hồ sơ.
      </h2>
      <p
        style={{
          fontSize: 16,
          color: "var(--tl-fg-2)",
          margin: "0 0 32px",
          lineHeight: 1.55,
        }}
      >
        Tên hiển thị + trình độ để cộng đồng nhận ra bạn.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 28 }}>
          <label htmlFor="display_name" style={labelStyle}>
            Tên hiển thị <span style={{ color: "var(--tl-green)" }}>*</span>
          </label>
          <input
            id="display_name"
            type="text"
            value={state.profile.display_name}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder="VD: Nguyễn Hoàng Nam"
            required
            minLength={2}
            maxLength={50}
            disabled={submitting}
            autoFocus
            style={inputStyle}
          />
          {usernamePreview && (
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 14,
                color: "var(--tl-fg-3)",
                marginTop: 8,
              }}
            >
              thepicklehub.net/nguoi-choi/
              <span style={{ color: "var(--tl-fg-2)" }}>{usernamePreview}</span>
            </p>
          )}
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={labelStyle}>
            Trình độ <span style={{ color: "var(--tl-green)" }}>*</span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {SKILL_LEVELS.map((skill, i) => {
              const active = state.profile.skill_level === skill.value;
              return (
                <li
                  key={skill.value}
                  style={{
                    borderTop: i === 0 ? "1px solid var(--tl-border)" : "none",
                    borderBottom: "1px solid var(--tl-border)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleSkillSelect(skill.value)}
                    disabled={submitting}
                    aria-pressed={active}
                    style={{
                      width: "100%",
                      background: active
                        ? "rgba(0, 185, 107, 0.06)"
                        : "transparent",
                      border: "none",
                      padding: "14px 0",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "baseline",
                      gap: 16,
                      color: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        color: active ? "var(--tl-green)" : "var(--tl-fg-3)",
                      }}
                    >
                      {skill.num}
                    </span>
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: 13,
                          letterSpacing: "0.06em",
                          color: active ? "var(--tl-fg)" : "var(--tl-fg-2)",
                          marginRight: 12,
                        }}
                      >
                        {skill.label}
                      </span>
                      <span style={{ color: "var(--tl-fg-3)", fontSize: 14 }}>
                        {skill.description}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        border: "1px solid",
                        borderColor: active ? "var(--tl-green)" : "var(--tl-border)",
                        background: active ? "var(--tl-green)" : "transparent",
                        flexShrink: 0,
                      }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
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
          style={{ width: "100%" }}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tiếp tục
        </button>
      </form>
    </section>
  );
}
