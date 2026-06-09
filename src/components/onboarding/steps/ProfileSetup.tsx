import { useState, useEffect, useMemo, Dispatch } from "react";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  generateUsername,
  slugifyDisplayName,
} from "@/lib/social/username-generator";
import type { OnboardingState, OnboardingAction } from "../OnboardingWizard";

// Sprint A5 — username validation rules. Mirror the URL_SAFE_USERNAME_RE
// from functions/_lib/sitemap-helpers.ts so anything that passes here will
// also pass the sitemap-players generator. Lowercase letters, digits,
// hyphens; cannot start/end with a hyphen; 3–32 chars.
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;
const USERNAME_DEBOUNCE_MS = 350;

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<OnboardingAction>;
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

  // Sprint A5 — user-pick username instead of auto-generate. Starts with
  // a suggestion derived from display_name; user can edit before saving.
  // Real-time availability check (debounced) hits username_is_available
  // RPC (migration 20260528040000).
  const [username, setUsername] = useState<string>(state.profile.username ?? "");
  const [userEditedUsername, setUserEditedUsername] = useState(false);
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  // Auto-suggest from display_name unless user has typed their own.
  useEffect(() => {
    if (userEditedUsername) return;
    const suggested = slugifyDisplayName(state.profile.display_name) || "";
    setUsername(suggested);
  }, [state.profile.display_name, userEditedUsername]);

  // Debounced availability check.
  useEffect(() => {
    if (!username) {
      setAvailability("idle");
      return;
    }
    if (!USERNAME_RE.test(username)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    const handle = setTimeout(async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "username_is_available",
          { p_candidate: username },
        );
        if (rpcError) throw rpcError;
        // Self-bypass: user re-onboarding their own row should see their
        // current username as "available".
        if (data === false) {
          const { data: ownRow } = await supabase
            .from("profiles")
            .select("id")
            .eq("username", username)
            .eq("id", userId)
            .maybeSingle();
          setAvailability(ownRow ? "available" : "taken");
        } else {
          setAvailability("available");
        }
      } catch {
        setAvailability("idle");
      }
    }, USERNAME_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [username, userId]);

  const availabilityLabel = useMemo(() => {
    if (!username) return "";
    switch (availability) {
      case "checking":
        return language === "vi" ? "Đang kiểm tra…" : "Checking…";
      case "available":
        return language === "vi" ? "Còn trống" : "Available";
      case "taken":
        return language === "vi" ? "Đã có người dùng" : "Already taken";
      case "invalid":
        return language === "vi"
          ? "Chỉ chữ thường, số, dấu gạch ngang (3–32 ký tự)"
          : "Lowercase letters, digits, hyphens only (3–32 chars)";
      default:
        return "";
    }
  }, [availability, username, language]);

  const handleDisplayNameChange = (value: string) => {
    dispatch({
      type: "SET_PROFILE",
      payload: { display_name: value },
    });
  };

  const handleUsernameChange = (raw: string) => {
    // Normalize as the user types — keep it permissive (don't strip while
    // they're mid-type) but lowercase and trim leading whitespace.
    const next = raw.toLowerCase().replace(/\s+/g, "-");
    setUsername(next);
    setUserEditedUsername(true);
  };

  const handleSuggestFromDisplayName = () => {
    const suggested = slugifyDisplayName(state.profile.display_name) || "";
    setUsername(suggested);
    setUserEditedUsername(false);
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

    // Sprint A5 — validate the user-picked username before submit.
    const candidate = username.trim();
    if (!USERNAME_RE.test(candidate)) {
      setError(
        language === "vi"
          ? "Username chỉ gồm chữ thường, số, dấu gạch ngang (3–32 ký tự)"
          : "Username must be lowercase letters, digits, or hyphens (3–32 chars)",
      );
      return;
    }
    if (availability === "taken") {
      setError(
        language === "vi"
          ? "Username này đã có người dùng — chọn username khác"
          : "That username is taken — pick a different one",
      );
      return;
    }
    if (availability === "invalid") {
      setError(
        language === "vi"
          ? "Username không hợp lệ"
          : "Username is invalid",
      );
      return;
    }

    setSubmitting(true);
    try {
      // Final atomic check: try the candidate; on collision (race condition
      // between the debounced check and submit), fall back to the legacy
      // generateUsername helper which appends a suffix.
      let finalUsername = candidate;
      const { data: collision } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", candidate)
        .neq("id", userId)
        .maybeSingle();
      if (collision) {
        // Race lost — auto-append suffix and notify the user.
        finalUsername = await generateUsername(displayName, {
          isAvailable: async (cand) => {
            const { data, error: lookupError } = await supabase
              .from("profiles")
              .select("id")
              .eq("username", cand)
              .neq("id", userId)
              .maybeSingle();
            if (lookupError) throw lookupError;
            return data === null;
          },
        });
        toast({
          title:
            language === "vi"
              ? `Username "${candidate}" vừa bị người khác chọn — dùng "${finalUsername}"`
              : `"${candidate}" was just taken — using "${finalUsername}"`,
        });
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          username: finalUsername,
          skill_level: state.profile.skill_level,
          onboarding_step: 1,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      dispatch({
        type: "SET_PROFILE",
        payload: { display_name: displayName, username: finalUsername },
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
        </div>

        {/* Sprint A5 — user-pick username */}
        <div style={{ marginBottom: 28 }}>
          <label htmlFor="username" style={labelStyle}>
            {language === "vi" ? "Username (URL hồ sơ)" : "Username (profile URL)"}{" "}
            <span style={{ color: "var(--tl-green)" }}>*</span>
          </label>
          <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                fontSize: 16,
                color: "var(--tl-fg-3)",
                whiteSpace: "nowrap",
              }}
            >
              thepicklehub.net/nguoi-choi/
            </span>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="nguyen-hoang-nam"
              required
              minLength={3}
              maxLength={32}
              disabled={submitting}
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputStyle,
                flex: 1,
                fontSize: 16,
                paddingLeft: 4,
              }}
              aria-describedby="username-availability"
              aria-invalid={availability === "taken" || availability === "invalid"}
            />
          </div>
          <div
            id="username-availability"
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.04em",
              color:
                availability === "available"
                  ? "var(--tl-green)"
                  : availability === "taken" || availability === "invalid"
                    ? "var(--tl-red, #ef4444)"
                    : "var(--tl-fg-3)",
              minHeight: 18,
            }}
          >
            {availability === "checking" && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {availability === "available" && <Check className="h-3 w-3" />}
            {(availability === "taken" || availability === "invalid") && (
              <X className="h-3 w-3" />
            )}
            <span>{availabilityLabel}</span>
            {userEditedUsername && state.profile.display_name && (
              <button
                type="button"
                onClick={handleSuggestFromDisplayName}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "none",
                  color: "var(--tl-fg-3)",
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {language === "vi" ? "Gợi ý từ tên" : "Suggest from name"}
              </button>
            )}
          </div>
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
