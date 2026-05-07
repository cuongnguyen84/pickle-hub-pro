import { useState, useEffect, Dispatch } from "react";
import { Loader2, Check } from "lucide-react";
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

  const handleSkip = () => advanceStep(null, true);

  return (
    <section aria-labelledby="step-3-heading">
      <h2
        id="step-3-heading"
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
        Sân yêu thích.
      </h2>
      <p
        style={{
          fontSize: 16,
          color: "var(--tl-fg-2)",
          margin: "0 0 32px",
          lineHeight: 1.55,
        }}
      >
        Chọn sân bạn hay chơi nhất. Cộng đồng dễ tìm bạn cùng sân.
      </p>

      {state.venue.venue_id && state.venue.venue_name ? (
        <div
          style={{
            borderTop: "1px solid var(--tl-green)",
            borderBottom: "1px solid var(--tl-border)",
            padding: "16px 0",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Check
            className="h-5 w-5"
            style={{ color: "var(--tl-green)", flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "var(--tl-green)",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Đã chọn
            </div>
            <div style={{ fontSize: 16, color: "var(--tl-fg)" }}>
              {state.venue.venue_name}
            </div>
          </div>
          <button
            type="button"
            className="tl-btn"
            onClick={handleClear}
            style={{ fontSize: 13 }}
          >
            Đổi
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <label htmlFor="venue_search" style={labelStyle}>
              Tìm sân
            </label>
            <input
              id="venue_search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên sân, quận, thành phố..."
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {isLoading && debouncedQuery && (
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                color: "var(--tl-fg-3)",
                fontSize: 14,
              }}
            >
              Đang tìm...
            </p>
          )}

          {!isLoading && venues && venues.length === 0 && debouncedQuery && (
            <p
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontStyle: "italic",
                color: "var(--tl-fg-3)",
                fontSize: 16,
                padding: "16px 0",
              }}
            >
              Không tìm thấy sân nào. Có thể bỏ qua bước này.
            </p>
          )}

          {venues && venues.length > 0 && (
            <ul
              style={{ listStyle: "none", margin: "16px 0 0", padding: 0 }}
              role="listbox"
            >
              {venues.map((v, i) => (
                <li
                  key={v.id}
                  style={{
                    borderTop: i === 0 ? "1px solid var(--tl-border)" : "none",
                    borderBottom: "1px solid var(--tl-border)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(v.id, v.name_vi || v.name)}
                    disabled={submitting}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: "14px 0",
                      cursor: "pointer",
                      textAlign: "left",
                      color: "inherit",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        color: "var(--tl-fg)",
                        marginBottom: 2,
                      }}
                    >
                      {v.name_vi || v.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--tl-fg-3)",
                      }}
                    >
                      {[v.district, v.city].filter(Boolean).join(" · ")}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && (
        <p
          role="alert"
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontStyle: "italic",
            color: "var(--tl-red, #ef4444)",
            fontSize: 16,
            margin: "16px 0 0",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ marginTop: 28 }}>
        <button
          type="button"
          className="tl-btn primary"
          onClick={handleSave}
          disabled={submitting || !state.venue.venue_id}
          style={{ width: "100%", marginBottom: 8 }}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Lưu sân yêu thích
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
          Bỏ qua
        </button>
      </div>
    </section>
  );
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
