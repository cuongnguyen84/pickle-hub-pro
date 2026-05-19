import { useState, useEffect, Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
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

type SkillValue = "beginner" | "intermediate" | "advanced" | "pro";
interface SkillLevel {
  num: string;
  value: SkillValue;
  label: string;
  description: string;
}
const SKILL_LEVELS_VI: SkillLevel[] = [
  { num: "01", value: "beginner", label: "NGƯỜI MỚI", description: "Mới bắt đầu, đang học" },
  { num: "02", value: "intermediate", label: "TRUNG BÌNH", description: "Đã chơi 3-12 tháng" },
  { num: "03", value: "advanced", label: "KHÁ", description: "1+ năm, tham gia giải địa phương" },
  { num: "04", value: "pro", label: "CHUYÊN NGHIỆP", description: "Top 100 VN hoặc tournament regular" },
];
const SKILL_LEVELS_EN: SkillLevel[] = [
  { num: "01", value: "beginner", label: "BEGINNER", description: "Just starting out, still learning" },
  { num: "02", value: "intermediate", label: "INTERMEDIATE", description: "3-12 months of experience" },
  { num: "03", value: "advanced", label: "ADVANCED", description: "1+ year, plays local tournaments" },
  { num: "04", value: "pro", label: "PRO", description: "Top 100 VN or tournament regular" },
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
  const { language } = useI18n();
  const SKILL_LEVELS = language === "vi" ? SKILL_LEVELS_VI : SKILL_LEVELS_EN;
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
      setError(
        language === "vi"
          ? "Tên hiển thị tối thiểu 2 ký tự"
          : "Display name needs at least 2 characters",
      );
      return;
    }
    if (displayName.length > 50) {
      setError(
        language === "vi"
          ? "Tên hiển thị tối đa 50 ký tự"
          : "Display name limited to 50 characters",
      );
      return;
    }
    if (!state.profile.skill_level) {
      setError(
        language === "vi" ? "Vui lòng chọn trình độ" : "Please pick a skill level",
      );
      return;
    }

    setSubmitting(true);
    try {
      const username = await generateUsername(displayName, {
        isAvailable: async (candidate) => {
          // Exclude self so re-onboarding the same user doesn't treat
          // their existing profile row as a collision and append a -XXXX
          // suffix. Pattern observed Sprint 3-4: user "Phạm Quang"
          // onboards → username "pham-quang"; reset state + re-onboard
          // → without this neq, isAvailable returned false (their own
          // row matched) → suffix "-obhx" appended unnecessarily.
          const { data, error: lookupError } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", candidate)
            .neq("id", userId)
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
      const fallback =
        language === "vi" ? "Lỗi không xác định" : "Unexpected error";
      const msg = err instanceof Error ? err.message : fallback;
      setError(msg);
      toast({
        variant: "destructive",
        title:
          language === "vi" ? "Lưu hồ sơ thất bại" : "Failed to save profile",
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
        {language === "vi" ? "Bắt đầu hồ sơ." : "Start your profile."}
      </h2>
      <p
        style={{
          fontSize: 16,
          color: "var(--tl-fg-2)",
          margin: "0 0 32px",
          lineHeight: 1.55,
        }}
      >
        {language === "vi"
          ? "Tên hiển thị + trình độ để cộng đồng nhận ra bạn."
          : "Display name + skill level so the community knows you."}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 28 }}>
          <label htmlFor="display_name" style={labelStyle}>
            {language === "vi" ? "Tên hiển thị" : "Display name"}{" "}
            <span style={{ color: "var(--tl-green)" }}>*</span>
          </label>
          <input
            id="display_name"
            type="text"
            value={state.profile.display_name}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            placeholder={
              language === "vi" ? "VD: Nguyễn Hoàng Nam" : "e.g., Cuong Nguyen"
            }
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
            {language === "vi" ? "Trình độ" : "Skill level"}{" "}
            <span style={{ color: "var(--tl-green)" }}>*</span>
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
          {language === "vi" ? "Tiếp tục" : "Continue"}
        </button>
      </form>
    </section>
  );
}
