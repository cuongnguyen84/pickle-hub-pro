import { useState, useEffect, Dispatch } from "react";
import { Loader2, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useVenueSearch } from "@/hooks/onboarding/useVenueSearch";
import type { OnboardingState } from "../OnboardingWizard";

interface Props {
  state: OnboardingState;
  dispatch: Dispatch<{
    type: "SET_VENUE" | "GO_NEXT" | "GO_PREV";
    payload?: Partial<OnboardingState["venue"]>;
  }>;
  userId: string;
}

export function VenueSelectStep({ state, dispatch, userId }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query, 300);
  const { data: venues, isLoading } = useVenueSearch(debouncedQuery);

  const advanceStep = async (
    venue: { id: string; name: string } | null,
    skipped: boolean,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      // favorite_venue_id added by 20260508000000_sprint3_phase3a migration.
      // On skip we explicitly null it out so a user who selected then changed
      // their mind doesn't get a stale FK from a previous step entry.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          favorite_venue_id: venue?.id ?? null,
          onboarding_step: 3,
        })
        .eq("id", userId);
      if (updateError) throw updateError;

      dispatch({
        type: "SET_VENUE",
        payload: {
          venue_id: venue?.id ?? null,
          venue_name: venue?.name ?? null,
          skipped,
        },
      });
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
      setSubmitting(false);
    }
  };

  const handleSelect = (venueId: string, venueName: string) => {
    dispatch({
      type: "SET_VENUE",
      payload: { venue_id: venueId, venue_name: venueName, skipped: false },
    });
  };

  const handleClear = () => {
    dispatch({
      type: "SET_VENUE",
      payload: { venue_id: null, venue_name: null, skipped: false },
    });
  };

  const handleSave = () => {
    if (!state.venue.venue_id || !state.venue.venue_name) {
      setError("Vui lòng chọn sân");
      return;
    }
    advanceStep(
      { id: state.venue.venue_id, name: state.venue.venue_name },
      false,
    );
  };

  const handleSkip = () => {
    advanceStep(null, true);
  };

  return (
    <section aria-labelledby="step-3-heading" className="space-y-6">
      <header>
        <h2 id="step-3-heading" className="text-xl font-semibold">
          Sân pickleball yêu thích?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chọn sân bạn hay chơi nhất. Cộng đồng dễ tìm bạn cùng sân.
        </p>
      </header>

      {state.venue.venue_id && state.venue.venue_name ? (
        <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="font-medium">{state.venue.venue_name}</div>
              <div className="text-xs text-muted-foreground">Đã chọn</div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              Đổi
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="venue_search">Tìm sân</Label>
            <Input
              id="venue_search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên sân, quận, thành phố..."
              disabled={submitting}
            />
          </div>

          {isLoading && debouncedQuery && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tìm...
            </div>
          )}

          {!isLoading && venues && venues.length === 0 && debouncedQuery && (
            <p className="text-sm text-muted-foreground">
              Không tìm thấy sân nào. Có thể bỏ qua bước này.
            </p>
          )}

          {venues && venues.length > 0 && (
            <ul className="space-y-2" role="listbox">
              {venues.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(v.id, v.name_vi || v.name)}
                    disabled={submitting}
                    className="w-full rounded-lg border-2 border-border p-3 text-left transition-colors hover:border-foreground/30"
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">
                          {v.name_vi || v.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[v.district, v.city].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
          onClick={handleSave}
          disabled={submitting || !state.venue.venue_id}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lưu sân yêu thích
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleSkip}
          disabled={submitting}
        >
          Bỏ qua
        </Button>
      </div>
    </section>
  );
}

/** Tiny in-file debouncer — 300ms feels right for typeahead UX. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
