import { useState, Dispatch } from "react";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  played_together: "Đã chơi cùng",
  same_city: "Cùng thành phố",
  verified_pro: "Pro verified",
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

    // Optimistic write to social_follows. If it errors we revert in the
    // hook; the wizard state may briefly disagree with DB state but the
    // final completion step re-syncs.
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
    <section aria-labelledby="step-4-heading" className="space-y-6">
      <header>
        <h2 id="step-4-heading" className="text-xl font-semibold">
          Theo dõi cộng đồng
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Theo dõi 5-10 người để xem trận đấu và kết nối.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
          Chưa có gợi ý ở khu vực bạn. Bạn có thể tìm và theo dõi sau từ trang
          hồ sơ.
        </p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((s) => {
            const isSelected = selected.includes(s.id);
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-muted overflow-hidden">
                  {s.avatar_url && (
                    <img
                      src={s.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.display_name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>@{s.username}</span>
                    {s.dupr_doubles && <span>· DUPR {s.dupr_doubles}</span>}
                  </div>
                  <span className="mt-1 inline-block rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {REASON_LABELS[s.reason] ?? s.reason}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant={isSelected ? "secondary" : "default"}
                  onClick={() => handleToggle(s.id)}
                  disabled={completing}
                  aria-pressed={isSelected}
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
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Đã chọn {selected.length} người
      </p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-2 pt-2">
        <Button
          type="button"
          className="w-full"
          size="lg"
          onClick={() => handleComplete(selected.length === 0)}
          disabled={completing}
        >
          {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Hoàn tất
        </Button>
      </div>
    </section>
  );
}
