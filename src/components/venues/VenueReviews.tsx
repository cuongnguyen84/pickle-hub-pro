import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

interface VenueReviewsProps {
  venueId: string;
  language: "vi" | "en";
}

interface ReviewRow {
  id: string;
  created_by: string;
  rating: number;
  body: string | null;
  created_at: string;
  authorName: string;
}

const MAX_BODY = 1000;

const t = (language: "vi" | "en", vi: string, en: string) => (language === "vi" ? vi : en);

function Stars({ value }: { value: number }) {
  const clamped = Math.max(1, Math.min(5, value));
  return (
    <span aria-label={`${clamped}/5`} className="tracking-wide text-amber-400">
      {"★".repeat(clamped)}
      <span className="text-muted-foreground">{"★".repeat(5 - clamped)}</span>
    </span>
  );
}

async function fetchReviews(venueId: string): Promise<ReviewRow[]> {
  const { data, error } = await supabase
    .from("venue_reviews")
    .select("id, created_by, rating, body, created_at")
    .eq("venue_id", venueId)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as Omit<ReviewRow, "authorName">[];
  if (rows.length === 0) return [];

  // Resolve author display names in one batched query (no FK to embed on).
  const ids = Array.from(new Set(rows.map((r) => r.created_by)));
  const { data: profiles } = await supabase
    .from("public_profiles")
    .select("id, display_name")
    .in("id", ids);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? ""]));
  return rows.map((r) => ({ ...r, authorName: nameById.get(r.created_by) || "" }));
}

export function VenueReviews({ venueId, language }: VenueReviewsProps) {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["venue-reviews", venueId], [venueId]);

  const { data: reviews = [], isLoading } = useQuery<ReviewRow[]>({
    queryKey,
    queryFn: () => fetchReviews(venueId),
    staleTime: 30_000,
  });

  const mine = user ? reviews.find((r) => r.created_by === user.id) : undefined;
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");

  // Prefill the form once the user's existing review is known.
  const effectiveRating = rating || mine?.rating || 0;
  const effectiveBody = body || (rating === 0 && !body ? mine?.body ?? "" : body);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("not-authenticated");
      const chosen = rating || mine?.rating || 0;
      if (chosen < 1 || chosen > 5) throw new Error("invalid-rating");
      const text = (body || mine?.body || "").trim().slice(0, MAX_BODY);
      const { error } = await supabase.from("venue_reviews").upsert(
        {
          venue_id: venueId,
          created_by: user.id,
          rating: chosen,
          body: text || null,
          status: "published",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "venue_id,created_by" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: mine
          ? t(language, "Đã cập nhật đánh giá", "Review updated")
          : t(language, "Cảm ơn đánh giá của bạn!", "Thanks for your review!"),
      });
      setRating(0);
      setBody("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast({
        title: t(language, "Không lưu được đánh giá", "Couldn't save your review"),
        variant: "destructive",
      });
    },
  });

  const heading = t(language, "Đánh giá từ cộng đồng", "Community reviews");
  const avg =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;

  return (
    <section className="mb-6" aria-labelledby="venue-reviews-heading">
      <h2 id="venue-reviews-heading" className="text-lg font-semibold mb-2">
        {heading}
      </h2>

      {avg != null && (
        <p className="mb-3">
          <Stars value={Math.round(avg)} /> <strong>{avg}</strong> ·{" "}
          {reviews.length} {t(language, "đánh giá", reviews.length === 1 ? "review" : "reviews")}
        </p>
      )}

      {/* Write / edit — auth-gated */}
      {!authLoading &&
        (user ? (
          <form
            className="mb-4 p-3 rounded-lg border"
            onSubmit={(e) => {
              e.preventDefault();
              submit.mutate();
            }}
          >
            <div className="mb-2" role="radiogroup" aria-label={t(language, "Chọn số sao", "Choose a rating")}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`${n}`}
                  aria-checked={effectiveRating === n}
                  role="radio"
                  onClick={() => setRating(n)}
                  className={`cursor-pointer border-0 bg-transparent text-2xl leading-none ${
                    n <= effectiveRating ? "text-amber-400" : "text-muted-foreground"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={effectiveBody}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              rows={3}
              placeholder={t(
                language,
                "Chia sẻ trải nghiệm chơi ở sân này (không bắt buộc)…",
                "Share your experience playing here (optional)…",
              )}
              className="w-full p-2 rounded border mb-2"
            />
            <Button type="submit" variant="tl-primary" disabled={submit.isPending || effectiveRating < 1}>
              {submit.isPending
                ? t(language, "Đang lưu…", "Saving…")
                : mine
                  ? t(language, "Cập nhật đánh giá", "Update review")
                  : t(language, "Gửi đánh giá", "Post review")}
            </Button>
          </form>
        ) : (
          <p className="mb-4">
            <Button asChild variant="outline">
              <Link to="/login">
                {t(language, "Đăng nhập để đánh giá sân", "Sign in to review this court")}
              </Link>
            </Button>
          </p>
        ))}

      {/* List */}
      {isLoading ? (
        <p>{t(language, "Đang tải đánh giá…", "Loading reviews…")}</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm opacity-70">
          {t(language, "Chưa có đánh giá nào. Hãy là người đầu tiên!", "No reviews yet. Be the first!")}
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="border-b pb-2">
              <div className="flex items-center gap-2 text-sm">
                <Stars value={r.rating} />
                <span className="font-medium">
                  {r.authorName || t(language, "Người chơi", "A player")}
                </span>
                <time dateTime={r.created_at.slice(0, 10)} className="opacity-60">
                  {r.created_at.slice(0, 10)}
                </time>
              </div>
              {r.body && <p className="mt-1 text-sm">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
