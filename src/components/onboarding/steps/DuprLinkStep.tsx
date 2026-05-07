import { useState, Dispatch } from "react";
import { Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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

export function DuprLinkStep({ state, dispatch }: Props) {
  const { toast } = useToast();
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
      // Persist onboarding_step = 2 regardless of save vs skip.
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
      const msg = err instanceof Error ? err.message : "Lỗi";
      setError(msg);
      toast({
        variant: "destructive",
        title: "Không thể chuyển bước",
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
      setError("Cần nhập điểm DUPR đôi (doubles) để lưu");
      return;
    }
    if (doublesNum < 2.0 || doublesNum > 7.0) {
      setError("Điểm DUPR phải trong khoảng 2.0 - 7.0");
      return;
    }
    let singlesNum: number | null = null;
    if (duprSingles.trim().length > 0) {
      singlesNum = parseFloat(duprSingles);
      if (Number.isNaN(singlesNum) || singlesNum < 2.0 || singlesNum > 7.0) {
        setError("Điểm DUPR đơn (singles) phải trong khoảng 2.0 - 7.0");
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
          toast({ title: "Đã lưu rating DUPR" });
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
          const errMsg = err.message ?? "Lỗi không xác định";
          if (err.code === "rate_limited") {
            setError("Đang xử lý, vui lòng đợi 60 giây.");
          } else if (err.code === "validation_failed") {
            setError(`Tỷ số không hợp lệ: ${err.details?.join(", ") ?? errMsg}`);
          } else {
            setError(errMsg);
          }
        },
      },
    );
  };

  const handleSkip = () => {
    advanceStep(
      {
        dupr_id: "",
        dupr_singles: null,
        dupr_doubles: null,
        saved: false,
      },
      true,
    );
  };

  const submitting = linkLoading || advancing;

  return (
    <section aria-labelledby="step-2-heading" className="space-y-6">
      <header>
        <h2 id="step-2-heading" className="text-xl font-semibold">
          Bạn có DUPR rating?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          DUPR là chuẩn rating quốc tế. Tự nhập rating để cộng đồng biết level.
        </p>
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          Auto-sync DUPR sắp ra mắt. Hiện tại nhập manual.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dupr_doubles">
            Điểm DUPR Doubles <span className="text-destructive">*</span>
          </Label>
          <Input
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dupr_singles">Điểm DUPR Singles (tùy chọn)</Label>
          <Input
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dupr_id">DUPR ID (tùy chọn)</Label>
          <Input
            id="dupr_id"
            type="text"
            value={duprId}
            onChange={(e) => setDuprId(e.target.value)}
            placeholder="VD: V6Y5XP"
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            Tìm trong URL DUPR profile của bạn (mở app DUPR → tap tên bạn).
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-2 pt-2">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lưu rating
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleSkip}
            disabled={submitting}
          >
            Bỏ qua bước này
          </Button>
        </div>
      </form>
    </section>
  );
}
