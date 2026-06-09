import { useState, Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useSuggestedFollows } from "@/hooks/onboarding/useSuggestedFollows";
import { FollowButton } from "@/components/social/FollowButton";
import { buildFollowsBatchRows } from "../follows-batch";
import type { OnboardingState, OnboardingAction } from "../OnboardingWizard";

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<OnboardingAction>;
  userId: string;
  onComplete: () => void;
}

const REASON_LABELS_VI: Record<string, string> = {
  played_together: "ĐÃ CHƠI CÙNG",
  same_city: "CÙNG THÀNH PHỐ",
  verified_pro: "PRO VERIFIED",
};
const REASON_LABELS_EN: Record<string, string> = {
  played_together: "PLAYED TOGETHER",
  same_city: "SAME CITY",
  verified_pro: "VERIFIED PRO",
};

export function SuggestedFollowsStep({
  state,
  dispatch,
  userId,
  onComplete,
}: Props) {
  const { toast } = useToast();
  const { language } = useI18n();
  const REASON_LABELS = language === "vi" ? REASON_LABELS_VI : REASON_LABELS_EN;
  const { data: suggestions, isLoading } = useSuggestedFollows(userId);

  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = state.follows.selected_user_ids;

  // FollowButton owns the actual social_follows mutation now (Phase 3C).
  // We dispatch a TOGGLE_FOLLOW action so the wizard reducer derives the
  // next selected array from its OWN current state — never from a stale
  // closure snapshot. Two async onFollowChange callbacks resolving close
  // together each get the latest state via the reducer (Codex P1 fix).
  const handleFollowChange = (followedId: string, isFollowing: boolean) => {
    dispatch({ type: "TOGGLE_FOLLOW", followedId, isFollowing });
  };

  const handleComplete = async (skipped: boolean) => {
    setCompleting(true);
    setError(null);
    try {
      // Reconcile DB state with the wizard's final selection. FollowButton
      // already emits per-click inserts, but a navigate("/") unmount can
      // abort an in-flight fetch and leave selected ids in the wizard
      // counter without a corresponding social_follows row. Idempotent
      // upsert: existing rows hit the (follower_id, followed_id) PK and
      // are silently ignored. (Codex P1 follow-up; commit 8 PR #15.)
      const followsBatch = buildFollowsBatchRows(userId, selected);
      if (followsBatch.length > 0) {
        const { error: followsError } = await supabase
          .from("social_follows")
          .upsert(followsBatch, {
            onConflict: "follower_id,followed_id",
            ignoreDuplicates: true,
          });
        if (followsError) {
          // Don't block onboarding — partial follow state is recoverable
          // (PlayerProfile FollowButtons remain wired up). Surface in dev
          // tools for diagnostic; no user-facing toast since it's silent
          // best-effort reconciliation.
          console.error(
            "[SuggestedFollowsStep] follow reconcile failed",
            followsError,
          );
        }
      }

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
      toast({
        title:
          language === "vi"
            ? "Chào mừng bạn đến ThePickleHub!"
            : "Welcome to ThePickleHub!",
      });
      onComplete();
    } catch (err) {
      const fallback = language === "vi" ? "Lỗi" : "Error";
      const msg = err instanceof Error ? err.message : fallback;
      setError(msg);
      toast({
        variant: "destructive",
        title:
          language === "vi" ? "Không thể hoàn tất" : "Couldn't finish",
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
        {language === "vi" ? "Theo dõi " : "Follow the "}
        <span style={{ fontStyle: "normal" }}>
          {language === "vi" ? "cộng đồng." : "community."}
        </span>
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
          ? "Theo dõi 5-10 người để xem trận đấu và kết nối."
          : "Follow 5-10 people to see their matches and connect."}
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
          {language === "vi"
            ? "Chưa có gợi ý ở khu vực bạn. Tìm và theo dõi sau từ trang hồ sơ."
            : "No suggestions in your area yet. Find and follow players from their profile pages later."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {suggestions.map((s, i) => {
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
                <div style={{ flexShrink: 0 }}>
                  <FollowButton
                    targetUserId={s.id}
                    targetUsername={s.username}
                    variant="default"
                    size="sm"
                    onFollowChange={(isFollowing) =>
                      handleFollowChange(s.id, isFollowing)
                    }
                  />
                </div>
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
        {language === "vi"
          ? `ĐÃ CHỌN ${selected.length} NGƯỜI`
          : `${selected.length} SELECTED`}
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
        {language === "vi" ? "Hoàn tất" : "Finish"}
      </button>
    </section>
  );
}
