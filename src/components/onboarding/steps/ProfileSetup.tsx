import { useState, useEffect, Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  value: "beginner" | "intermediate" | "advanced" | "pro";
  label: string;
  description: string;
}> = [
  {
    value: "beginner",
    label: "Người mới",
    description: "Mới bắt đầu, đang học",
  },
  {
    value: "intermediate",
    label: "Trung bình",
    description: "Đã chơi 3-12 tháng",
  },
  {
    value: "advanced",
    label: "Khá",
    description: "1+ năm, tham gia giải địa phương",
  },
  {
    value: "pro",
    label: "Chuyên nghiệp",
    description: "Top 100 VN hoặc tournament regular",
  },
];

export function ProfileSetup({ state, dispatch, userId }: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernamePreview, setUsernamePreview] = useState<string>("");

  // Live preview the slug as user types — actual collision check happens
  // at submit time via generateUsername's isAvailable predicate.
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
      // Generate a unique username — collision check via Supabase profiles.
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

      // Persist Step 1 fields. skill_level isn't yet a profiles column —
      // store it as the first kudos-like surface in onboarding_step state
      // for now; Phase 3B may add a dedicated column.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          username,
          onboarding_step: 1,
        })
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

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
    <section aria-labelledby="step-1-heading" className="space-y-6">
      <header>
        <h2 id="step-1-heading" className="text-xl font-semibold">
          Bắt đầu hồ sơ
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tên hiển thị + trình độ để cộng đồng nhận ra bạn.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="display_name">
            Tên hiển thị <span className="text-destructive">*</span>
          </Label>
          <Input
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
          />
          {usernamePreview && (
            <p className="text-xs text-muted-foreground">
              URL hồ sơ:{" "}
              <span className="font-mono text-foreground">
                thepicklehub.net/nguoi-choi/{usernamePreview}
              </span>
              <span className="ml-1 text-muted-foreground">
                (mã định danh sẽ thêm tự động nếu trùng)
              </span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            Trình độ <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-1 gap-2">
            {SKILL_LEVELS.map((skill) => (
              <button
                key={skill.value}
                type="button"
                onClick={() => handleSkillSelect(skill.value)}
                disabled={submitting}
                className={`text-left rounded-lg border-2 p-3 transition-colors ${
                  state.profile.skill_level === skill.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                <div className="font-medium">{skill.label}</div>
                <div className="text-xs text-muted-foreground">
                  {skill.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitting}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Tiếp tục
        </Button>
      </form>
    </section>
  );
}
