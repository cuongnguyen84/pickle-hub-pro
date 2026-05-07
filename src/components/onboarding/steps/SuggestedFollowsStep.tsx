import { useState, Dispatch } from "react";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSuggestedFollows } from "@/hooks/onboarding/useSuggestedFollows";
import { useFollowToggle } from "@/hooks/onboarding/useFollowToggle";
import type { OnboardingState } from "../OnboardingWizard";

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<{
    type: "SET_FOLLOWS" | "GO_PREV";
    payload?: Partial<OnboardingState["follows"]>;
  }>;
  userId: string;
  onComplete: () => void;
}

const REASON_LABELS: Record<string, string> = {
  played_together: "ĐÃ CHƠI CÙNG",
  same_city: "CÙNG THÀNH PHỐ",
  verified_pro: "PRO VERIFIED",
};

export function SuggestedFollowsStep({
  state,
  dispatch,
  userId,
  onComplete,
}: Props) {
  const { toast } = useToast();
  const { data: suggestions, isLoading } = useSuggestedFollows(userId);
  const toggle = useFollowToggle(userId);

  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = state.follows.selected_user_ids;

  const handleToggle = (followedId: string) => {
    const isSelected = selected.includes(followedId);
    const next = isSelected
      ? selected.filter((id) => id !== followedId)
      : [...selected, followedId];

    dispatch({
      type: "SET_FOLLOWS",
      payload: { selected_user_ids: next },
    });
    toggle.mutate({ followedId, follow: !isSelected });
  };

  const handleComplete = async (skipped: boolean) => {
    setCompleting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          onboarding_step: 4,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      dispatch({
        type: "SET_FOLLOWS",
        payload: { skipped },
      });
      toast({ title: "Chào mừng bạn đến ThePickleHub!" });
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi";
      setError(msg);
      toast({
        variant: "destructive",
        title: "Không thể hoàn tất",
        description: msg,
      });
    } finally {
      setCompleting(false);
    }
  };

  return (
    <section aria-labelledby="step-4-heading">
      <h2
        id="step-4-heading"
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
        Theo dõi <span style={{ fontStyle: "normal" }}>cộng đồng.</span>
      </h2>
      <p
        style={{
          fontSize: 16,
          color: "var(--tl-fg-2)",
          margin: "0 0 32px",
          lineHeight: 1.55,
        }}
      >
        Theo dõi 5-10 người để xem trận đấu và kết nối.
      </p>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <Loader2
            className="h-5 w-5 animate-spin"
            style={{ color: "var(--tl-fg-3)" }}
          />
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <p
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            color: "var(--tl-fg-3)",
            fontSize: 16,
            padding: "16px 0",
          }}
        >
          Chưa có gợi ý ở khu vực bạn. Tìm và theo dõi sau từ trang hồ sơ.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {suggestions.map((s, i) => {
            const isSelected = selected.includes(s.id);
            return (
              <li
                key={s.id}
                style={{
                  borderTop: i === 0 ? "1px solid var(--tl-border)" : "none",
                  borderBottom: "1px solid var(--tl-border)",
                  padding: "14px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "var(--tl-surface, rgba(255,255,255,0.04))",
                    flexShrink: 0,
                  }}
                >
                  {s.avatar_url ? (
                    <img
                      src={s.avatar_url}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        width: "100%",
                        height: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'Instrument Serif', serif",
                        fontStyle: "italic",
                        color: "var(--tl-fg-3)",
                      }}
                    >
                      {(s.display_name || s.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      color: "var(--tl-fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.display_name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--tl-fg-3)",
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginTop: 2,
                    }}
                  >
                    <span>@{s.username}</span>
                    {s.dupr_doubles != null && (
                      <span>· DUPR {s.dupr_doubles}</span>
                    )}
                    <span style={{ color: "var(--tl-green)" }}>
                      · {REASON_LABELS[s.reason] ?? s.reason}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={isSelected ? "tl-btn primary" : "tl-btn"}
                  onClick={() => handleToggle(s.id)}
                  disabled={completing}
                  aria-pressed={isSelected}
                  style={{ flexShrink: 0, fontSize: 13, padding: "8px 12px" }}
                >
                  {isSelected ? (
                    <>
                      <UserCheck className="mr-1 h-4 w-4" />
                      Đã theo dõi
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1 h-4 w-4" />
                      Theo dõi
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--tl-fg-3)",
          textAlign: "center",
          margin: "20px 0",
        }}
      >
        ĐÃ CHỌN {selected.length} NGƯỜI
      </p>

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
        type="button"
        className="tl-btn primary"
        onClick={() => handleComplete(selected.length === 0)}
        disabled={completing}
        style={{ width: "100%" }}
      >
        {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Hoàn tất
      </button>
    </section>
  );
}
